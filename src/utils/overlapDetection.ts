import type { Event } from '../lib/database.types';

export interface EventWithOverlapInfo extends Event {
  columnIndex: number;
  overlapCount: number;
}

interface TimeRange {
  startMinutes: number;
  endMinutes: number;
}

interface EventWithRange {
  event: Event;
  startMinutes: number;
  endMinutes: number;
}

/**
 * Checks if two time ranges overlap
 */
function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/**
 * Detects overlapping events for a single day and assigns column indices
 *
 * Algorithm:
 * 1. Sort events by start time, then by duration (longest first)
 * 2. Group overlapping events into clusters
 * 3. For each cluster, assign column indices (0 to maxConcurrent-1)
 */
export function detectOverlapsForDay(
  events: Event[],
  timeToMinutes: (time: string) => number
): EventWithOverlapInfo[] {
  if (events.length === 0) return [];

  // Prepare events with time ranges
  const eventsWithRanges: EventWithRange[] = events.map(event => ({
    event,
    startMinutes: timeToMinutes(event.start_time),
    endMinutes: timeToMinutes(event.end_time)
  }));

  // Sort by start time, then by duration (longest first for better layout)
  eventsWithRanges.sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) {
      return a.startMinutes - b.startMinutes;
    }
    const durationA = a.endMinutes - a.startMinutes;
    const durationB = b.endMinutes - b.startMinutes;
    return durationB - durationA; // Longest first
  });

  // Assign column indices
  const result: EventWithOverlapInfo[] = [];
  const columns: EventWithRange[][] = []; // Each column contains non-overlapping events

  for (const eventWithRange of eventsWithRanges) {
    // Find the first column where this event doesn't overlap with any existing event
    let columnIndex = -1;

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      const overlapsWithColumn = column.some(existing =>
        rangesOverlap(eventWithRange, existing)
      );

      if (!overlapsWithColumn) {
        columnIndex = i;
        break;
      }
    }

    // If no suitable column found, create a new one
    if (columnIndex === -1) {
      columnIndex = columns.length;
      columns.push([]);
    }

    // Add event to the column
    columns[columnIndex].push(eventWithRange);

    // Calculate overlap count (max concurrent events)
    // Find all events that overlap with this one
    const overlappingEvents = eventsWithRanges.filter(other =>
      rangesOverlap(eventWithRange, other)
    );

    const overlapCount = Math.max(
      columns.length, // At minimum, we have this many columns
      overlappingEvents.length // But there might be more overlaps
    );

    result.push({
      ...eventWithRange.event,
      columnIndex,
      overlapCount
    });
  }

  // Log for debugging
  console.log(`🔀 Overlap detection: ${events.length} events → ${columns.length} columns`, {
    eventCount: events.length,
    columnCount: columns.length,
    eventsPerColumn: columns.map(col => col.length)
  });

  return result;
}

/**
 * Detects overlaps for all days in the provided events
 */
export function detectOverlapsAllDays(
  events: Event[],
  timeToMinutes: (time: string) => number
): Map<string, EventWithOverlapInfo> {
  // Group events by day
  const eventsByDay = new Map<number, Event[]>();

  events.forEach(event => {
    const dayEvents = eventsByDay.get(event.day_of_week) || [];
    dayEvents.push(event);
    eventsByDay.set(event.day_of_week, dayEvents);
  });

  // Process each day
  const result = new Map<string, EventWithOverlapInfo>();

  eventsByDay.forEach((dayEvents, dayId) => {
    const eventsWithOverlap = detectOverlapsForDay(dayEvents, timeToMinutes);

    eventsWithOverlap.forEach(event => {
      result.set(event.id, event);
    });
  });

  return result;
}
