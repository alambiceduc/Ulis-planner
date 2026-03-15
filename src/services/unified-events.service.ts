import { supabase } from '../lib/supabase';
import type { Event, Student, OverlayPeriodItem } from '../types';

export interface UnifiedEvent extends Event {
  isOverlay?: boolean;
}

async function fetchOverlayItems(student: Student): Promise<OverlayPeriodItem[]> {
  if (!student.overlay_period_profile_id) {
    return [];
  }

  const { data, error } = await supabase
    .from('overlay_period_items')
    .select('*')
    .eq('period_profile_id', student.overlay_period_profile_id)
    .eq('is_enabled', true);

  if (error) {
    console.error('Error loading overlays:', error);
    return [];
  }

  return data || [];
}

function convertOverlayToEvents(overlay: OverlayPeriodItem, studentId: string): UnifiedEvent[] {
  return overlay.days.map((day) => ({
    id: `overlay-${overlay.id}-day-${day}`,
    student_id: studentId,
    day_of_week: day,
    start_time: overlay.start_time,
    end_time: overlay.end_time,
    type: 'VIE_SCOLAIRE' as const,
    aesh: false,
    label: overlay.name,
    location: '',
    created_at: overlay.created_at,
    isOverlay: true
  }));
}

export async function getUnifiedEventsForStudent(student: Student): Promise<UnifiedEvent[]> {
  const { data: baseEvents, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('student_id', student.id);

  if (eventsError) {
    console.error('Error loading events:', eventsError);
    return [];
  }

  const overlayItems = await fetchOverlayItems(student);

  const overlayEvents: UnifiedEvent[] = [];
  for (const overlay of overlayItems) {
    overlayEvents.push(...convertOverlayToEvents(overlay, student.id));
  }

  const allEvents = [
    ...(baseEvents || []),
    ...overlayEvents
  ];

  allEvents.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    if (a.start_time !== b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return a.end_time.localeCompare(b.end_time);
  });

  return allEvents;
}

export async function getUnifiedEventsForStudents(studentIds: string[]): Promise<UnifiedEvent[]> {
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('*')
    .in('id', studentIds);

  if (studentsError) {
    console.error('Error loading students:', studentsError);
    return [];
  }

  const { data: baseEvents, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .in('student_id', studentIds);

  if (eventsError) {
    console.error('Error loading events:', eventsError);
    return [];
  }

  const allOverlayEvents: UnifiedEvent[] = [];

  for (const student of students || []) {
    const overlayItems = await fetchOverlayItems(student);
    for (const overlay of overlayItems) {
      allOverlayEvents.push(...convertOverlayToEvents(overlay, student.id));
    }
  }

  const allEvents = [
    ...(baseEvents || []),
    ...allOverlayEvents
  ];

  allEvents.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    if (a.start_time !== b.start_time) {
      return a.start_time.localeCompare(b.start_time);
    }
    return a.end_time.localeCompare(b.end_time);
  });

  return allEvents;
}
