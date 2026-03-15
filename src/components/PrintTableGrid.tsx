import { useMemo, useRef, useEffect, useState } from 'react';
import type { Event } from '../lib/database.types';
import { DAYS, timeToMinutes } from '../lib/timeUtils';
import { selectHighestPriorityEvent } from '../utils/eventPriority';
import { detectOverlapsAllDays, type EventWithOverlapInfo } from '../utils/overlapDetection';

interface PrintTableGridProps {
  events: Event[];
  showWednesday?: boolean;
  getEventColor: (event: Event) => string;
  renderEventContent: (event: Event) => React.ReactNode;
  isPrinting?: boolean;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface CellEvent {
  event: Event;
  rowSpan: number;
  columnIndex?: number;
  overlapCount?: number;
}

interface SnappedEventWithIndices extends Event {
  snappedStartMinutes: number;
  snappedEndMinutes: number;
  startIndex: number;
  endIndex: number;
}

interface OverlayPosition {
  event: SnappedEventWithIndices;
  dayIndex: number;
  top: number;
  height: number;
  left: number;
  width: number;
}

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function PrintTableGrid({
  events,
  showWednesday = false,
  getEventColor,
  renderEventContent,
  isPrinting = false
}: PrintTableGridProps) {
  console.log('🖨️ PrintTableGrid: Rendering with', events.length, 'events, isPrinting =', isPrinting);
  const visibleDays = showWednesday ? DAYS : DAYS.filter(day => day.id !== 3);

  const tableRef = useRef<HTMLTableElement>(null);
  const [overlayPositions, setOverlayPositions] = useState<OverlayPosition[]>([]);

  // Separate base events from overlays
  const baseEvents = useMemo(() => {
    const filtered = events.filter(e => e.type !== 'PRISE_EN_CHARGE');
    console.log('📊 Base events (excluding PRISE_EN_CHARGE):', filtered.length);
    return filtered;
  }, [events]);

  // Detect overlaps for base events
  const eventsWithOverlapInfo = useMemo(() => {
    const overlapMap = detectOverlapsAllDays(baseEvents, timeToMinutes);
    console.log(`🔀 Computed overlap info for ${overlapMap.size} base events`);
    return overlapMap;
  }, [baseEvents]);

  // Separate base events into non-overlapping and overlapping
  const nonOverlappingBaseEvents = useMemo(() => {
    return baseEvents.filter(event => {
      const overlapInfo = eventsWithOverlapInfo.get(event.id);
      return !overlapInfo || overlapInfo.overlapCount === 1;
    });
  }, [baseEvents, eventsWithOverlapInfo]);

  const overlappingBaseEvents = useMemo(() => {
    return baseEvents.filter(event => {
      const overlapInfo = eventsWithOverlapInfo.get(event.id);
      return overlapInfo && overlapInfo.overlapCount > 1;
    });
  }, [baseEvents, eventsWithOverlapInfo]);

  const overlayEventsRaw = useMemo(() => {
    const filtered = events.filter(e => e.type === 'PRISE_EN_CHARGE');
    console.log('📊 Overlay events (PRISE_EN_CHARGE only):', filtered.length, filtered.map(e => ({
      id: e.id,
      label: e.label,
      day: e.day_of_week,
      start: e.start_time,
      end: e.end_time
    })));
    return filtered;
  }, [events]);

  // Detect overlaps for overlay events (PRISE_EN_CHARGE)
  const overlayEventsWithOverlapInfo = useMemo(() => {
    const overlapMap = detectOverlapsAllDays(overlayEventsRaw, timeToMinutes);
    console.log(`🔀 Computed overlap info for ${overlapMap.size} overlay events (PRISE_EN_CHARGE)`);
    return overlapMap;
  }, [overlayEventsRaw]);

  // Generate boundaries (bornes) in minutes - USING ALL EVENTS
  const boundaries = useMemo((): number[] => {
    if (isPrinting) {
      // PRINT mode: Fixed boundaries 08:30 → 16:30 every 30 min
      const GRID_START = 8 * 60 + 30; // 08:30
      const GRID_END = 16 * 60 + 30;  // 16:30
      const STEP = 30;

      const bounds: number[] = [];
      for (let m = GRID_START; m <= GRID_END; m += STEP) {
        bounds.push(m);
      }

      console.log('📊 PRINT Boundaries:', bounds.length, 'boundaries from', minutesToTime(bounds[0]), 'to', minutesToTime(bounds[bounds.length - 1]));
      return bounds;
    }

    // PREVIEW mode: Dynamic boundaries from ALL events (including overlays for boundaries)
    if (events.length === 0) {
      // Default 08:30 → 16:30
      const bounds: number[] = [];
      for (let m = 8 * 60 + 30; m <= 16 * 60 + 30; m += 30) {
        bounds.push(m);
      }
      return bounds;
    }

    const boundsSet = new Set<number>();

    // Add day start/end boundaries
    boundsSet.add(8 * 60 + 30); // 08:30
    boundsSet.add(16 * 60 + 30); // 16:30

    // Add ALL event start/end times (including overlays for boundaries)
    events.forEach(event => {
      boundsSet.add(timeToMinutes(event.start_time));
      boundsSet.add(timeToMinutes(event.end_time));
    });

    // Sort and deduplicate
    const bounds = Array.from(boundsSet).sort((a, b) => a - b);

    console.log('📊 PREVIEW Boundaries:', bounds.length, 'boundaries from', minutesToTime(bounds[0]), 'to', minutesToTime(bounds[bounds.length - 1]));
    return bounds;
  }, [isPrinting, events]);

  // Generate time slots from boundaries
  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];

    for (let i = 0; i < boundaries.length - 1; i++) {
      const startMinutes = boundaries[i];
      const endMinutes = boundaries[i + 1];
      const durationMinutes = endMinutes - startMinutes;

      slots.push({
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
        durationMinutes
      });
    }

    console.log('📊 Time slots generated:', slots.length, 'slots');
    if (slots.length > 0) {
      console.log('📊 First slot:', slots[0].startTime, '→', slots[0].endTime);
      console.log('📊 Last slot:', slots[slots.length - 1].startTime, '→', slots[slots.length - 1].endTime);
    }

    return slots;
  }, [boundaries]);

  // Snap NON-OVERLAPPING BASE events and calculate indices
  const snappedNonOverlappingEvents = useMemo((): SnappedEventWithIndices[] => {
    if (boundaries.length === 0) {
      return [];
    }

    const GRID_START = boundaries[0];
    const GRID_STEP = isPrinting ? 30 : null;

    return nonOverlappingBaseEvents.map(event => {
      const eventStartMinutes = timeToMinutes(event.start_time);
      const eventEndMinutes = timeToMinutes(event.end_time);

      let snappedStartMinutes: number;
      let snappedEndMinutes: number;

      if (isPrinting && GRID_STEP) {
        // PRINT: Snap to grid (round for start, ceil for end)
        const startRaw = (eventStartMinutes - GRID_START) / GRID_STEP;
        const startIdx = Math.max(0, Math.round(startRaw));
        snappedStartMinutes = GRID_START + (startIdx * GRID_STEP);

        const endRaw = (eventEndMinutes - GRID_START) / GRID_STEP;
        const endIdxExclusive = Number.isInteger(endRaw) ? endRaw : Math.ceil(endRaw);
        const endIdx = Math.max(startIdx + 1, endIdxExclusive);
        snappedEndMinutes = GRID_START + (endIdx * GRID_STEP);

        // DEBUG: Log events in range 09:40-10:10
        const isDebugRange = eventStartMinutes >= 9 * 60 + 40 && eventStartMinutes <= 10 * 60 + 10;
        if (isDebugRange) {
          console.log(`🎯 DEBUG Snapping ${event.type} (${event.label || 'no label'}):`, {
            originalStart: event.start_time,
            originalEnd: event.end_time,
            eventStartMinutes,
            startRaw,
            startIdx,
            snappedStart: minutesToTime(snappedStartMinutes),
            endRaw,
            endIdxExclusive,
            endIdx,
            snappedEnd: minutesToTime(snappedEndMinutes)
          });
        }
      } else {
        // PREVIEW: No snapping, use original times
        snappedStartMinutes = eventStartMinutes;
        snappedEndMinutes = eventEndMinutes;
      }

      // Find indices in boundaries array
      const startIndex = boundaries.indexOf(snappedStartMinutes);
      const endIndex = boundaries.indexOf(snappedEndMinutes);

      if (startIndex === -1 || endIndex === -1) {
        console.warn(`⚠️ Event ${event.id} has boundaries not in grid:`, {
          snappedStart: minutesToTime(snappedStartMinutes),
          snappedEnd: minutesToTime(snappedEndMinutes),
          startIndex,
          endIndex
        });
      }

      if (isPrinting && (event.start_time !== minutesToTime(snappedStartMinutes) || event.end_time !== minutesToTime(snappedEndMinutes))) {
        console.log(`📌 Snapped event ${event.type} from ${event.start_time}→${event.end_time} to ${minutesToTime(snappedStartMinutes)}→${minutesToTime(snappedEndMinutes)}`);
      }

      const snapped = {
        ...event,
        snappedStartMinutes,
        snappedEndMinutes,
        startIndex,
        endIndex
      } as SnappedEventWithIndices;

      // DEBUG: Log Friday events after 15:30
      if (event.day_of_week === 5 && eventStartMinutes >= 15 * 60 + 30) {
        console.log(`🔍 FRIDAY END-OF-DAY BASE EVENT: ${event.label || event.type}`, {
          day: 'Friday (5)',
          original: `${event.start_time}-${event.end_time}`,
          snapped: `${minutesToTime(snappedStartMinutes)}-${minutesToTime(snappedEndMinutes)}`,
          startIndex,
          endIndex,
          rowSpan: endIndex - startIndex,
          isPrinting,
          boundsLength: boundaries.length,
          lastBoundary: boundaries.length > 0 ? minutesToTime(boundaries[boundaries.length - 1]) : 'none'
        });
      }

      return snapped;
    });
  }, [nonOverlappingBaseEvents, boundaries, isPrinting]);

  // Snap OVERLAPPING BASE events as overlays
  const snappedOverlappingBaseEvents = useMemo((): SnappedEventWithIndices[] => {
    if (boundaries.length === 0) {
      return [];
    }

    const GRID_START = boundaries[0];
    const GRID_STEP = isPrinting ? 30 : null;

    return overlappingBaseEvents.map(event => {
      const eventStartMinutes = timeToMinutes(event.start_time);
      const eventEndMinutes = timeToMinutes(event.end_time);

      let snappedStartMinutes: number;
      let snappedEndMinutes: number;

      if (isPrinting && GRID_STEP) {
        const startRaw = (eventStartMinutes - GRID_START) / GRID_STEP;
        const startIdx = Math.max(0, Math.round(startRaw));
        snappedStartMinutes = GRID_START + (startIdx * GRID_STEP);

        const endRaw = (eventEndMinutes - GRID_START) / GRID_STEP;
        const endIdxExclusive = Number.isInteger(endRaw) ? endRaw : Math.ceil(endRaw);
        const endIdx = Math.max(startIdx + 1, endIdxExclusive);
        snappedEndMinutes = GRID_START + (endIdx * GRID_STEP);
      } else {
        snappedStartMinutes = eventStartMinutes;
        snappedEndMinutes = eventEndMinutes;
      }

      const startIndex = boundaries.indexOf(snappedStartMinutes);
      const endIndex = boundaries.indexOf(snappedEndMinutes);

      if (startIndex === -1 || endIndex === -1) {
        console.warn(`⚠️ Overlapping event ${event.id} has boundaries not in grid`);
      }

      return {
        ...event,
        snappedStartMinutes,
        snappedEndMinutes,
        startIndex,
        endIndex
      } as SnappedEventWithIndices;
    });
  }, [overlappingBaseEvents, boundaries, isPrinting]);

  // Snap OVERLAY events and calculate indices
  const snappedOverlayEvents = useMemo((): SnappedEventWithIndices[] => {
    if (boundaries.length === 0) {
      return [];
    }

    const GRID_START = boundaries[0];
    const GRID_STEP = isPrinting ? 30 : null;

    return overlayEventsRaw.map(event => {
      const eventStartMinutes = timeToMinutes(event.start_time);
      const eventEndMinutes = timeToMinutes(event.end_time);

      let snappedStartMinutes: number;
      let snappedEndMinutes: number;

      if (isPrinting && GRID_STEP) {
        // PRINT: Snap to grid (round for start, ceil for end)
        const startRaw = (eventStartMinutes - GRID_START) / GRID_STEP;
        const startIdx = Math.max(0, Math.round(startRaw));
        snappedStartMinutes = GRID_START + (startIdx * GRID_STEP);

        const endRaw = (eventEndMinutes - GRID_START) / GRID_STEP;
        const endIdxExclusive = Number.isInteger(endRaw) ? endRaw : Math.ceil(endRaw);
        const endIdx = Math.max(startIdx + 1, endIdxExclusive);
        snappedEndMinutes = GRID_START + (endIdx * GRID_STEP);
      } else {
        // PREVIEW: No snapping, use original times
        snappedStartMinutes = eventStartMinutes;
        snappedEndMinutes = eventEndMinutes;
      }

      // Find indices in boundaries array
      const startIndex = boundaries.indexOf(snappedStartMinutes);
      const endIndex = boundaries.indexOf(snappedEndMinutes);

      if (startIndex === -1 || endIndex === -1) {
        console.warn(`⚠️ Overlay event ${event.id} has boundaries not in grid:`, {
          snappedStart: minutesToTime(snappedStartMinutes),
          snappedEnd: minutesToTime(snappedEndMinutes),
          startIndex,
          endIndex
        });
      }

      if (isPrinting && (event.start_time !== minutesToTime(snappedStartMinutes) || event.end_time !== minutesToTime(snappedEndMinutes))) {
        console.log(`📌 Snapped overlay ${event.type} from ${event.start_time}→${event.end_time} to ${minutesToTime(snappedStartMinutes)}→${minutesToTime(snappedEndMinutes)}`);
      }

      const snapped = {
        ...event,
        snappedStartMinutes,
        snappedEndMinutes,
        startIndex,
        endIndex
      } as SnappedEventWithIndices;

      console.log(`✨ Snapped overlay: ${event.label || event.type}`, {
        original: `${event.start_time}-${event.end_time}`,
        snapped: `${minutesToTime(snappedStartMinutes)}-${minutesToTime(snappedEndMinutes)}`,
        startIndex,
        endIndex,
        day: event.day_of_week
      });

      // DEBUG: Log Friday events after 15:30
      if (event.day_of_week === 5 && eventStartMinutes >= 15 * 60 + 30) {
        console.log(`🔍 FRIDAY END-OF-DAY OVERLAY: ${event.label || event.type}`, {
          day: 'Friday (5)',
          original: `${event.start_time}-${event.end_time}`,
          snapped: `${minutesToTime(snappedStartMinutes)}-${minutesToTime(snappedEndMinutes)}`,
          startIndex,
          endIndex,
          rowSpan: endIndex - startIndex,
          isPrinting,
          boundsLength: boundaries.length,
          lastBoundary: boundaries.length > 0 ? minutesToTime(boundaries[boundaries.length - 1]) : 'none'
        });
      }

      return snapped;
    });
  }, [overlayEventsRaw, boundaries, isPrinting]);

  const getCellEvent = (dayId: number, slotIndex: number): CellEvent | null => {
    // Only use non-overlapping events for table cells
    const dayEvents = snappedNonOverlappingEvents.filter(e => e.day_of_week === dayId);

    if (dayEvents.length === 0) {
      return null;
    }

    // Find event that starts in this slot
    const startingEvent = dayEvents.find(e => e.startIndex === slotIndex);

    if (!startingEvent) {
      return null;
    }

    const rowSpan = startingEvent.endIndex - startingEvent.startIndex;

    return {
      event: startingEvent,
      rowSpan
    };
  };

  const isCellCovered = (dayId: number, slotIndex: number): boolean => {
    // Only check non-overlapping events for table coverage
    const dayEvents = snappedNonOverlappingEvents.filter(e => e.day_of_week === dayId);

    // Check if any event covers this slot (but doesn't start here)
    for (const e of dayEvents) {
      // Cell is covered if: startIndex < slotIndex < endIndex
      if (e.startIndex < slotIndex && slotIndex < e.endIndex) {
        return true;
      }
    }

    return false;
  };

  const isCellOverlaidByPriseEnCharge = (dayId: number, slotIndex: number): boolean => {
    // Check if any PRISE_EN_CHARGE overlay covers this cell
    for (const overlay of snappedOverlayEvents) {
      if (overlay.day_of_week === dayId) {
        // Cell is overlaid if: overlay.startIndex <= slotIndex < overlay.endIndex
        if (overlay.startIndex <= slotIndex && slotIndex < overlay.endIndex) {
          return true;
        }
      }
    }
    return false;
  };

  // Calculate overlay positions after table is rendered
  useEffect(() => {
    const allOverlayEvents = [...snappedOverlayEvents, ...snappedOverlappingBaseEvents];

    if (!tableRef.current || allOverlayEvents.length === 0) {
      setOverlayPositions([]);
      return;
    }

    const calculatePositions = () => {
      if (!tableRef.current) return;

      const table = tableRef.current;
      const thead = table.querySelector('thead') as HTMLElement;
      const tbody = table.querySelector('tbody') as HTMLElement;

      if (!thead || !tbody) {
        console.warn('⚠️ Missing table elements for overlay calculation');
        return;
      }

      // Get day column headers
      const dayHeaders = thead.querySelectorAll('.print-table-day-header');
      if (dayHeaders.length === 0) {
        console.warn('⚠️ No day headers found');
        return;
      }

      // Get CONSTANT row height from first row (avoid sub-pixel accumulation)
      const firstRow = tbody.querySelector('tr') as HTMLElement;
      if (!firstRow) {
        console.warn('⚠️ No rows found in tbody');
        return;
      }
      const rowHeight = firstRow.offsetHeight;

      // Get tbody top position relative to table
      const tbodyTop = tbody.offsetTop;
      const theadHeight = thead.offsetHeight;

      // Get table offset relative to wrapper (in case table has margins/padding)
      const tableOffsetLeft = table.offsetLeft;
      const tableOffsetTop = table.offsetTop;

      console.log('📏 Overlay calculation (offset-based):', {
        theadHeight,
        tbodyTop,
        rowHeight,
        tableOffsetLeft,
        tableOffsetTop,
        dayCount: dayHeaders.length,
        overlayCount: allOverlayEvents.length
      });

      const positions: OverlayPosition[] = [];

      // Visual insets to create spacing around overlays (in pixels)
      const INSET_TOP = 2;
      const INSET_BOTTOM = 2;
      const INSET_LEFT = 2;  // Horizontal gap between overlapping events
      const INSET_RIGHT = 2; // Total gap = 4px between adjacent events

      allOverlayEvents.forEach(overlay => {
        // Find day index in visible days
        const dayIndex = visibleDays.findIndex(day => day.id === overlay.day_of_week);
        if (dayIndex === -1) {
          console.warn(`⚠️ Overlay ${overlay.label} has invalid day_of_week: ${overlay.day_of_week}`);
          return;
        }

        if (overlay.startIndex === -1 || overlay.endIndex === -1) {
          console.warn(`⚠️ Overlay ${overlay.label} has invalid indices:`, {
            startIndex: overlay.startIndex,
            endIndex: overlay.endIndex
          });
          return;
        }

        if (dayIndex >= dayHeaders.length) {
          console.warn(`⚠️ Overlay ${overlay.label} dayIndex ${dayIndex} out of range (${dayHeaders.length} headers)`);
          return;
        }

        // Get the specific day header for this overlay
        const dayHeader = dayHeaders[dayIndex] as HTMLElement;

        // Get overlap info for positioning (choose correct map based on event type)
        const overlapInfo = overlay.type === 'PRISE_EN_CHARGE'
          ? overlayEventsWithOverlapInfo.get(overlay.id)
          : eventsWithOverlapInfo.get(overlay.id);
        const columnIndex = overlapInfo?.columnIndex ?? 0;
        const overlapCount = overlapInfo?.overlapCount ?? 1;

        // HORIZONTAL: Use offsetLeft and offsetWidth (local coordinates, no sub-pixel issues)
        // Add table offset to convert from table-relative to wrapper-relative coordinates
        const baseDayLeft = tableOffsetLeft + dayHeader.offsetLeft;
        const baseDayWidth = dayHeader.offsetWidth;

        // If event has overlaps, subdivide the day column
        const columnWidth = baseDayWidth / overlapCount;
        const baseLeft = baseDayLeft + (columnIndex * columnWidth);
        const baseWidth = columnWidth;

        // VERTICAL: Use constant rowHeight (no accumulation of rounding errors)
        // Add table offset to convert from table-relative to wrapper-relative coordinates
        const baseTop = tableOffsetTop + tbodyTop + (overlay.startIndex * rowHeight);
        const baseHeight = (overlay.endIndex - overlay.startIndex) * rowHeight;

        // HEIGHT CLAMPING FOR COMPACT DISPLAY
        // For collective timetables, clamp height to avoid huge blocks
        const MIN_HEIGHT = 44; // Minimum readable height in pixels
        const MAX_HEIGHT = 90; // Maximum height to keep blocks compact
        const clampedBaseHeight = Math.max(MIN_HEIGHT, Math.min(baseHeight, MAX_HEIGHT));

        // Apply visual insets for spacing
        const left = baseLeft + INSET_LEFT;
        const width = baseWidth - INSET_LEFT - INSET_RIGHT;
        const top = baseTop + INSET_TOP;
        const height = clampedBaseHeight - INSET_TOP - INSET_BOTTOM;

        positions.push({
          event: overlay,
          dayIndex,
          top,
          height,
          left,
          width
        });

        console.log(`📍 Overlay positioned: ${overlay.label || overlay.type} [${overlay.start_time}-${overlay.end_time}]`, {
          day: overlay.day_of_week,
          dayIndex,
          startIndex: overlay.startIndex,
          endIndex: overlay.endIndex,
          columnIndex,
          overlapCount,
          baseTop: `${baseTop}px`,
          baseHeight: `${baseHeight}px`,
          baseLeft: `${baseLeft}px`,
          baseWidth: `${baseWidth}px`,
          finalTop: `${top}px`,
          finalHeight: `${height}px`,
          finalLeft: `${left}px`,
          finalWidth: `${width}px`,
          insets: `T:${INSET_TOP} B:${INSET_BOTTOM} L:${INSET_LEFT} R:${INSET_RIGHT}`
        });
      });

      console.log(`✅ Calculated ${positions.length} overlay positions (offset-based, no BoundingClientRect)`);
      setOverlayPositions(positions);
    };

    // Use requestAnimationFrame to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        calculatePositions();
      });
    }, 0);

    // Recalculate on window resize
    const handleResize = () => {
      requestAnimationFrame(() => {
        calculatePositions();
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [snappedOverlayEvents, snappedOverlappingBaseEvents, visibleDays, timeSlots, isPrinting, eventsWithOverlapInfo]);

  return (
    <div className="print-table-wrapper relative" style={{ '--slot-count': timeSlots.length } as React.CSSProperties}>
      <table className="print-table" ref={tableRef}>
        <thead>
          <tr>
            <th className="print-table-time-header">Horaires</th>
            {visibleDays.map(day => (
              <th key={day.id} className="print-table-day-header">
                {day.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot, slotIndex) => (
            <tr key={slotIndex} className="print-table-row">
              <td className="print-table-time-cell">
                <div className="text-xs font-semibold">{slot.startTime}</div>
                <div className="text-xs text-gray-500">{slot.endTime}</div>
              </td>
              {visibleDays.map(day => {
                if (isCellCovered(day.id, slotIndex)) {
                  return null;
                }

                const cellEvent = getCellEvent(day.id, slotIndex);
                const hasOverlay = isCellOverlaidByPriseEnCharge(day.id, slotIndex);

                // Check if this cell has overlapping base events
                const hasOverlappingEvents = snappedOverlappingBaseEvents.some(
                  e => e.day_of_week === day.id && e.startIndex <= slotIndex && slotIndex < e.endIndex
                );

                if (cellEvent) {
                  return (
                    <td
                      key={day.id}
                      rowSpan={cellEvent.rowSpan}
                      className={`print-table-event-cell ${getEventColor(cellEvent.event)}${hasOverlay || hasOverlappingEvents ? ' has-overlay' : ''}`}
                    >
                      {renderEventContent(cellEvent.event)}
                    </td>
                  );
                }

                return (
                  <td key={day.id} className={`print-table-empty-cell${hasOverlay || hasOverlappingEvents ? ' has-overlay' : ''}`}>
                    &nbsp;
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Overlay layer */}
      {overlayPositions.length > 0 && (
        <div className="overlays-layer">
          {overlayPositions.map((pos, idx) => (
            <div
              key={idx}
              className={`overlay-event ${getEventColor(pos.event)}`}
              style={{
                top: `${pos.top}px`,
                left: `${pos.left}px`,
                width: `${pos.width}px`,
                height: `${pos.height}px`
              }}
            >
              {renderEventContent(pos.event)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
