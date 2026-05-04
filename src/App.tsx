/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Truck, 
  LayoutDashboard, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  User,
  Phone,
  Hash,
  Activity,
  FileText
} from 'lucide-react';
import { 
  format, 
  addMinutes, 
  startOfDay, 
  addHours, 
  isSameDay, 
  parseISO, 
  setHours, 
  setMinutes 
} from 'date-fns';
import { Booking, Dock, TimeSlot } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { extractPlanningFromText } from './services/geminiService';

const WORKING_HOURS_START = 7;
const WORKING_HOURS_END = 15;
const SLOT_DURATION_MINS = 15;
const TRUCKS_PER_SLOT = 2;

const DOCKS: Dock[] = [
  { id: 'dock-1', name: 'Dock 01', capacity: TRUCKS_PER_SLOT },
  { id: 'dock-2', name: 'Dock 02', capacity: TRUCKS_PER_SLOT },
  { id: 'dock-3', name: 'Dock 03', capacity: TRUCKS_PER_SLOT },
  { id: 'dock-4', name: 'Dock 04', capacity: TRUCKS_PER_SLOT },
];

export default function App() {
  const [view, setView] = useState<'requester' | 'inbound'>('requester');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]); // Mock state until Firebase
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ dockId: string, time: Date } | null>(null);

  // Generate time slots for the day
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    let current = setMinutes(setHours(startOfDay(selectedDate), WORKING_HOURS_START), 0);
    const end = setHours(startOfDay(selectedDate), WORKING_HOURS_END);

    while (current < end) {
      slots.push(new Date(current));
      current = addMinutes(current, SLOT_DURATION_MINS);
    }
    return slots;
  }, [selectedDate]);

  const handleBooking = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return;

    const formData = new FormData(e.currentTarget);
    const truckCount = parseInt(formData.get('truckCount') as string) || 1;
    const bookingTime = selectedSlot.time;
    const newBookings: Booking[] = [];

    for (let i = 0; i < truckCount; i++) {
      // Group trucks into slots based on capacity (TRUCKS_PER_SLOT = 2)
      const slotOffset = Math.floor(i / TRUCKS_PER_SLOT);
      const startTime = addMinutes(bookingTime, slotOffset * SLOT_DURATION_MINS);
      const endTime = addMinutes(startTime, SLOT_DURATION_MINS);
      
      const booking: Booking = {
        id: Math.random().toString(36).substr(2, 9),
        dockId: selectedSlot.dockId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        requesterName: formData.get('requesterName') as string,
        // If there are multiple trucks, we append a sequence number to the reference
        truckReference: truckCount > 1 ? `${formData.get('truckReference')} (#${i+1})` : formData.get('truckReference') as string,
        driverName: formData.get('driverName') as string,
        driverPhone: formData.get('driverPhone') as string,
        licensePlate: formData.get('licensePlate') as string,
        type: 'manual',
        createdAt: new Date().toISOString(),
      };
      newBookings.push(booking);
    }

    setBookings(prev => [...prev, ...newBookings]);
    setIsBookingModalOpen(false);
    setSelectedSlot(null);
  };

  const handleAIExtract = async () => {
    setIsExtracting(true);
    try {
      const extracted = await extractPlanningFromText(aiInput);
      const newBookings: Booking[] = extracted.map(e => ({
        id: Math.random().toString(36).substr(2, 9),
        dockId: DOCKS[Math.floor(Math.random() * DOCKS.length)].id, // Auto-assign to a dock
        startTime: `${e.suggestedDate}T${e.suggestedTime}:00Z`,
        endTime: addMinutes(parseISO(`${e.suggestedDate}T${e.suggestedTime}:00Z`), SLOT_DURATION_MINS).toISOString(),
        requesterName: e.requesterName,
        truckReference: e.truckReference,
        driverName: e.driverName || 'N/A',
        driverPhone: e.driverPhone || 'N/A',
        licensePlate: e.licensePlate || 'N/A',
        type: 'automatic',
        createdAt: new Date().toISOString(),
      }));
      setBookings(prev => [...prev, ...newBookings]);
      setIsAIModalOpen(false);
      setAiInput('');
    } catch (error) {
      alert("Failed to extract planning. Make sure GEMINI_API_KEY is set.");
    } finally {
      setIsExtracting(false);
    }
  };

  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;

  const todayBookingsCount = bookings.filter(b => isSameDay(parseISO(b.startTime), selectedDate)).length;
  const maxSlots = DOCKS.length * timeSlots.length * TRUCKS_PER_SLOT;
  const workloadPercent = Math.min(Math.round((todayBookingsCount / maxSlots) * 100), 100);

  return (
    <div className="min-h-screen bg-zinc-100 text-slate-900 font-sans p-6 text-slate-900">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 uppercase">Dock Scheduler</h1>
          <p className="text-sm text-slate-500 font-medium">Terminal Hub • {format(selectedDate, 'EEEE, MMM do')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${bookings.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              {bookings.length > 0 ? 'DATA STREAM: ACTIVE' : 'SYSTEM IDLE'}
            </span>
          </div>

          <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm p-1">
            <button 
              onClick={() => setView('requester')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'requester' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              BOOKING
            </button>
            <button 
              onClick={() => setView('inbound')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'inbound' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              INBOUND
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setSelectedDate(d => addMinutes(d, -1440))} className="p-1.5 hover:bg-slate-50 rounded-lg"><ChevronLeft className="w-4 h-4 text-slate-400" /></button>
            <button onClick={() => setSelectedDate(d => addMinutes(d, 1440))} className="p-1.5 hover:bg-slate-50 rounded-lg"><ChevronRight className="w-4 h-4 text-slate-400" /></button>
          </div>
        </div>
      </header>

      {/* Main Bento Layout */}
      <div className="grid grid-cols-12 grid-rows-6 gap-4 h-[calc(100vh-140px)]">
        
        {/* Left Column: Stats & Logs */}
        <div className="col-span-3 row-span-6 flex flex-col gap-4">
          {/* Workload Snapshot */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Today's Workload</h3>
              <div className="text-3xl font-black text-indigo-600">{todayBookingsCount} <span className="text-lg font-normal text-slate-400">/ {maxSlots}</span></div>
              <p className="text-[10px] text-slate-500 mt-1">Confirmed bookings across all docks</p>
            </div>
            <div className="space-y-2 mt-4">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${workloadPercent}%` }}></div>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>07:00 AM</span>
                <span>{workloadPercent}% Utilization</span>
                <span>03:00 PM</span>
              </div>
            </div>
          </div>

          {/* AI Import Trigger (Sync Status variant) */}
          <div className="flex-1 bg-emerald-500 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-80">AI Integration</h3>
                <div className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">Ready</div>
              </div>
              <p className="text-xs font-medium leading-tight mb-4">Automatically extract bookings from planning notes or container lists.</p>
            </div>
            
            <button 
              onClick={() => setIsAIModalOpen(true)}
              className="w-full bg-white text-emerald-600 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-50 transition-colors"
            >
              SYNC FROM DOCUMENT
            </button>
          </div>

          {/* Planning Logs */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Operations Log</h3>
            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
              {bookings.slice(-5).reverse().map(b => (
                <div key={b.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className={`w-1.5 h-1.5 mt-1.5 rounded-full ${b.type === 'automatic' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                  <div>
                    <p className="text-[10px] leading-tight text-slate-600"><span className="font-bold">{format(parseISO(b.createdAt), 'HH:mm')}</span> Slot {format(parseISO(b.startTime), 'HH:mm')} (Dock {b.dockId.split('-')[1]}) {b.type === 'automatic' ? 'synced' : 'booked'}</p>
                    <p className="text-[9px] text-slate-400 uppercase mt-0.5">{b.licensePlate}</p>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && <p className="text-[10px] italic text-slate-400">Waiting for activity...</p>}
            </div>
          </div>
        </div>

        {/* Center Column: Main Schedule Grid */}
        <div className="col-span-6 row-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dock Availability (15m Intervals)</h3>
            <div className="flex gap-4 text-[9px] font-bold text-slate-500 tracking-wider">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]"></span> AVAILABLE</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]"></span> PARTIAL</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-400 shadow-[0_0_8px_rgba(248,113,113,0.3)]"></span> FULL</div>
            </div>
          </div>

          <div className="grid grid-cols-[80px_repeat(4,1fr)] bg-slate-50/30 border-b border-slate-100">
            <div className="p-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100 italic">TIME</div>
            {DOCKS.map(dock => (
              <div key={dock.id} className="p-2 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 last:border-r-0">
                {dock.name}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 relative">
            {isWeekend && (
              <div className="absolute inset-0 z-20 bg-slate-50/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Terminal Closed</h4>
                <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">Dock operations are only available Monday through Friday (07:00 - 15:00).</p>
              </div>
            )}
            {timeSlots.map(time => (
              <div key={time.toISOString()} className="grid grid-cols-[80px_repeat(4,1fr)] border-b border-slate-100 last:border-0 group min-h-[48px]">
                <div className={`p-4 font-mono text-[10px] font-bold items-center justify-center flex border-r border-slate-100 transition-colors ${format(time, 'HH:mm') === format(new Date(), 'HH:mm') ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50/30 text-slate-400'}`}>
                  {format(time, 'HH:mm')}
                </div>
                {DOCKS.map(dock => {
                  const currentBookings = bookings.filter(b => b.dockId === dock.id && isSameDay(parseISO(b.startTime), time) && format(parseISO(b.startTime), 'HH:mm') === format(time, 'HH:mm'));
                  const isFull = currentBookings.length >= dock.capacity;
                  const isPartial = currentBookings.length > 0 && currentBookings.length < dock.capacity;
                  const isSelected = selectedSlot?.dockId === dock.id && format(selectedSlot.time, 'HH:mm') === format(time, 'HH:mm');
                  const occupancyRatio = currentBookings.length / dock.capacity;

                  return (
                    <div 
                      key={dock.id} 
                      className={`p-1 border-r border-slate-100 last:border-r-0 relative group/slot transition-all ${isSelected ? 'bg-indigo-50/50' : ''}`}
                    >
                      {currentBookings.length > 0 ? (
                        <div className="h-full w-full flex flex-col gap-1">
                          {view === 'inbound' ? (
                            <div className="h-full w-full flex flex-col justify-center px-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className={`text-[7px] font-black uppercase ${isFull ? 'text-red-600' : 'text-amber-600'}`}>
                                  {isFull ? 'OCCUPIED' : 'PARTIAL'}
                                </span>
                                <span className="text-[7px] font-bold text-slate-400">{currentBookings.length}/{dock.capacity}</span>
                              </div>
                              <div className="flex gap-0.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                {Array.from({ length: dock.capacity }).map((_, i) => (
                                  <div 
                                    key={i} 
                                    className={`flex-1 h-full ${i < currentBookings.length ? (isFull ? 'bg-red-500' : 'bg-amber-500') : 'bg-transparent'}`}
                                  />
                                ))}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-0.5">
                                {currentBookings.map(b => (
                                  <div key={b.id} className="text-[6px] font-bold truncate max-w-full text-slate-500 bg-white/50 px-0.5 rounded cursor-help" title={b.requesterName}>
                                    {b.requesterName}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            currentBookings.map(b => (
                              <motion.div 
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                key={b.id} 
                                className={`flex-1 p-1 rounded border flex items-center justify-center text-[8px] font-black uppercase transition-all shadow-sm ${
                                  isFull ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                                }`}
                              >
                                {b.requesterName}
                              </motion.div>
                            ))
                          )}
                          {!isFull && view === 'requester' && (
                            <button 
                              onClick={() => { setSelectedSlot({ dockId: dock.id, time }); setIsBookingModalOpen(true); }}
                              className="flex-1 border border-dashed border-slate-300 rounded opacity-0 group-hover/slot:opacity-100 bg-white/50 flex items-center justify-center transition-opacity"
                            >
                              <Plus className="w-2.5 h-2.5 text-slate-400" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          {view === 'requester' ? (
                            <button 
                              onClick={() => { setSelectedSlot({ dockId: dock.id, time }); setIsBookingModalOpen(true); }}
                              className="w-full h-full bg-emerald-50/30 rounded opacity-0 group-hover/slot:opacity-100 hover:bg-emerald-100/50 flex items-center justify-center transition-all cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-emerald-500" />
                            </button>
                          ) : (
                            <div className="h-full w-full flex flex-col justify-center px-1 opacity-40">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[7px] font-black uppercase text-emerald-600">AVAILABLE</span>
                                <span className="text-[7px] font-bold text-slate-400">0/{dock.capacity}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full border border-slate-200/50" />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-600 border border-indigo-700 rounded-sm z-[2] flex flex-col items-center justify-center text-[8px] font-black text-white uppercase shadow-lg">
                          SELECTED
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Detail Panel */}
        <div className="col-span-3 row-span-6 flex flex-col gap-4">
          <div className="flex-[2] bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="mb-6">
              <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Slot Intelligence</h3>
              <div className="text-xl font-bold tracking-tight">Active Selection</div>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Terminal Operations Center</p>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto">
              {selectedSlot ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                   <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Slot</label>
                    <div className="text-sm font-bold flex items-center gap-2">
                       <Clock className="w-3.5 h-3.5 text-indigo-400" />
                       {format(selectedSlot.time, 'HH:mm')} - {format(addMinutes(selectedSlot.time, SLOT_DURATION_MINS), 'HH:mm')}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                       <LayoutDashboard className="w-3.5 h-3.5" />
                       {DOCKS.find(d => d.id === selectedSlot.dockId)?.name}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Occupancy</label>
                    {bookings.filter(b => b.dockId === selectedSlot.dockId && format(parseISO(b.startTime), 'HH:mm') === format(selectedSlot.time, 'HH:mm')).length === 0 ? (
                      <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/30 border-dashed text-center">
                        <p className="text-[10px] italic text-indigo-200/50 mb-3">No bookings assigned to this slot yet.</p>
                        <button 
                          onClick={() => setIsBookingModalOpen(true)}
                          className="w-full bg-indigo-500 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-400 transition-colors"
                        >
                          ASSIGN NOW
                        </button>
                      </div>
                    ) : (
                      bookings.filter(b => b.dockId === selectedSlot.dockId && format(parseISO(b.startTime), 'HH:mm') === format(selectedSlot.time, 'HH:mm')).map(b => (
                        <div key={b.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 relative group overflow-hidden">
                          <div className="flex justify-between items-center mb-2">
                             <div className="text-[8px] font-black text-indigo-400 uppercase">{b.truckReference}</div>
                             <div className={`w-1.5 h-1.5 rounded-full ${b.type === 'automatic' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                          </div>
                          <div className="text-sm font-bold truncate">{b.requesterName}</div>
                          <div className="flex flex-col gap-1 mt-2">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <User className="w-3 h-3" /> {b.driverName}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-indigo-300">
                              <Truck className="w-3 h-3" /> {b.licensePlate}
                            </div>
                          </div>
                          <button 
                            onClick={() => setBookings(prev => prev.filter(item => item.id !== b.id))}
                            className="absolute -right-10 group-hover:right-2 top-2 p-1.5 bg-red-500/10 text-red-400 rounded-lg transition-all hover:bg-red-500 hover:text-white"
                          >
                            <Plus className="w-3 h-3 rotate-45" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest">Select a slot</p>
                  <p className="text-[10px] px-8 mt-2 leading-relaxed">Click any timeline window to view details or create a booking.</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-slate-800 mt-4 space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-slate-500">
                <span>Database</span>
                <span className="text-emerald-500">Local Only</span>
              </div>
              <button 
                disabled={!selectedSlot}
                onClick={() => setIsBookingModalOpen(true)}
                className="w-full bg-white text-slate-900 py-3 rounded-xl text-xs font-black shadow-lg hover:bg-slate-100 transition-all disabled:opacity-50 tracking-widest"
              >
                PROCEED WITH BOOKING
              </button>
            </div>
          </div>

          {/* User / Org Context (extra bento block) */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Operator</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black">SD</div>
              <div>
                <p className="text-xs font-bold">Logistics Planner</p>
                <p className="text-[10px] text-slate-400">Shift A • Bay 4-12</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 bg-[#141414]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 p-6 text-white">
                <h3 className="text-xl font-bold tracking-tight">CREATE BOOKING</h3>
                <div className="flex gap-4 mt-2 text-[10px] font-black uppercase opacity-60 tracking-widest">
                  <div className="flex items-center gap-2"><LayoutDashboard className="w-3 h-3" /> {DOCKS.find(d => d.id === selectedSlot?.dockId)?.name}</div>
                  <div className="flex items-center gap-2"><Clock className="w-3 h-3" /> {selectedSlot && format(selectedSlot.time, 'HH:mm')} - {selectedSlot && format(addMinutes(selectedSlot.time, SLOT_DURATION_MINS), 'HH:mm')}</div>
                </div>
              </div>
              
              <form onSubmit={handleBooking} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <User className="w-3 h-3" /> REQUESTER
                    </label>
                    <input name="requesterName" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Global Logistics" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Truck className="w-3 h-3" /> NUMBER OF TRUCKS
                    </label>
                    <input name="truckCount" type="number" min="1" max="10" defaultValue="1" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <FileText className="w-3 h-3" /> REFERENCE ID
                    </label>
                    <input name="truckReference" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="PO-123456" />
                  </div>
                </div>

                <div className="h-px bg-slate-100" />

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-800">Operational Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <User className="w-3 h-3" /> Driver Name
                      </label>
                      <input name="driverName" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Driver Full Name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Phone className="w-3 h-3" /> Contact #
                      </label>
                      <input name="driverPhone" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="+1..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Hash className="w-3 h-3" /> License Plate
                    </label>
                    <input name="licensePlate" required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="ABC-1234" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsBookingModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Extraction Modal */}
      <AnimatePresence>
        {isAIModalOpen && (
          <div className="fixed inset-0 bg-[#141414]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="bg-indigo-600 p-6 text-white">
                <h3 className="text-xl font-bold tracking-tight uppercase">AI PLANNING SYNC</h3>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mt-1">Extract automation from manifest or notes</p>
              </div>
              
              <div className="p-8 space-y-6">
                <textarea 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  className="w-full h-40 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none text-slate-600 leading-relaxed"
                  placeholder="Paste planning text here... e.g., 'Truck ABC-1234 from Acme Corp arriving October 23rd at 10:00 AM...'"
                />

                <div className="flex gap-3">
                  <button 
                    disabled={isExtracting}
                    onClick={() => setIsAIModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isExtracting || !aiInput.trim()}
                    onClick={handleAIExtract}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isExtracting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : 'Execute Sync'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
