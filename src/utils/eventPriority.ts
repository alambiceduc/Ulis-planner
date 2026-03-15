import type { Event, EventType } from '../types';

export function getEventPriority(eventType: EventType): number {
  switch (eventType) {
    case 'PRISE_EN_CHARGE':
      return 100;
    case 'CLASSE':
      return 50;
    case 'ULIS':
      return 40;
    case 'VIE_SCOLAIRE':
      return 10;
    default:
      return 0;
  }
}

export function getEventZIndex(event: Event): number {
  let baseZIndex = getEventPriority(event.type);

  if (event.aesh) {
    baseZIndex += 30;
  }

  return baseZIndex;
}

export function selectHighestPriorityEvent(events: Event[]): Event | null {
  if (events.length === 0) return null;
  if (events.length === 1) return events[0];

  return events.reduce((highest, current) => {
    const highestPriority = getEventZIndex(highest);
    const currentPriority = getEventZIndex(current);
    return currentPriority > highestPriority ? current : highest;
  });
}
