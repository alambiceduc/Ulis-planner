export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function generateTimeSlots(startTime: string, endTime: string, step: number): string[] {
  const slots: string[] = [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  for (let time = start; time <= end; time += step) {
    slots.push(minutesToTime(time));
  }

  return slots;
}

export function calculateEventDuration(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function snapTimeToGrid(time: string, stepMinutes: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const snapped = Math.round(totalMinutes / stepMinutes) * stepMinutes;
  const newHours = Math.floor(snapped / 60);
  const newMinutes = snapped % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

export function formatMinutesToDisplay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
}

export function isValidTimeRange(startTime: string, endTime: string): boolean {
  return timeToMinutes(startTime) < timeToMinutes(endTime);
}

export function calculateSlotHeight(
  stepMinutes: number,
  minReadableHeightRem: number = 3,
  minReadableDurationMinutes: number = 15,
  zoom: number = 1
): number {
  const baseHeightPerSlot = (minReadableHeightRem * stepMinutes) / minReadableDurationMinutes;
  return Math.max(baseHeightPerSlot, 4) * zoom;
}

export interface SlotHeightInfo {
  time: string;
  heightRem: number;
  isCompressed: boolean;
}

export function findCantineTimeRange(events: any[]): { startMinutes: number; endMinutes: number } | null {
  const cantineEvents = events.filter(
    e => e.type === 'VIE_SCOLAIRE' && e.label && e.label.toLowerCase().includes('cantine')
  );

  if (cantineEvents.length === 0) return null;

  const allStartMinutes = cantineEvents.map(e => timeToMinutes(e.start_time));
  const allEndMinutes = cantineEvents.map(e => timeToMinutes(e.end_time));

  return {
    startMinutes: Math.min(...allStartMinutes),
    endMinutes: Math.max(...allEndMinutes)
  };
}

export function generateSlotHeights(
  timeSlots: string[],
  normalSlotHeightRem: number,
  events: any[]
): SlotHeightInfo[] {
  const cantineRange = findCantineTimeRange(events);
  const CANTINE_SLOT_HEIGHT = 1.5;

  return timeSlots.map(time => {
    const slotMinutes = timeToMinutes(time);
    let isCompressed = false;

    if (cantineRange) {
      isCompressed = slotMinutes >= cantineRange.startMinutes && slotMinutes < cantineRange.endMinutes;
    }

    return {
      time,
      heightRem: isCompressed ? CANTINE_SLOT_HEIGHT : normalSlotHeightRem,
      isCompressed
    };
  });
}

export function calculateEventTopPosition(
  eventStartTime: string,
  slotHeights: SlotHeightInfo[]
): number {
  const eventStartMinutes = timeToMinutes(eventStartTime);

  let topRem = 0;

  for (const slot of slotHeights) {
    const slotMinutes = timeToMinutes(slot.time);

    if (slotMinutes < eventStartMinutes) {
      topRem += slot.heightRem;
    } else {
      break;
    }
  }

  return topRem;
}

export function calculateEventHeight(
  eventStartTime: string,
  eventEndTime: string,
  slotHeights: SlotHeightInfo[],
  stepMinutes: number
): number {
  const eventStartMinutes = timeToMinutes(eventStartTime);
  const eventEndMinutes = timeToMinutes(eventEndTime);

  let heightRem = 0;

  for (const slot of slotHeights) {
    const slotMinutes = timeToMinutes(slot.time);
    const slotEndMinutes = slotMinutes + stepMinutes;

    if (slotMinutes >= eventStartMinutes && slotMinutes < eventEndMinutes) {
      heightRem += slot.heightRem;
    }

    if (slotEndMinutes >= eventEndMinutes) {
      break;
    }
  }

  return heightRem;
}
