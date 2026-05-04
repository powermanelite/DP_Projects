export type Tab = 'home' | 'calendar' | 'map' | 'chat';

export interface ScheduledEvent {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  email: string;
  schedulerEmail?: string;
  attendeeEmail?: string;
  timeSlot: string;
  endTimeSlot?: string;
  message: string;
  isSweeping?: boolean;
  streetName?: string;
  gcalEventId?: string;
  recurringEventId?: string;
}

export interface SweepingCalendarRequest {
  street: string;
  sides: Array<{ label: string; day: string; time: string }>;
}
