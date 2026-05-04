/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Booking {
  id: string;
  dockId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  requesterName: string;
  truckReference: string;
  driverName: string;
  driverPhone: string;
  licensePlate: string;
  type: 'manual' | 'automatic';
  containerPlanningId?: string;
  createdAt: string;
}

export interface Dock {
  id: string;
  name: string;
  capacity: number; // usually 2 per slot as per request
}

export interface TimeSlot {
  time: string; // HH:mm
  bookings: Booking[];
}
