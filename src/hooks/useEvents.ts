import { useState, useEffect, useCallback } from 'react';
import { eventsService } from '../services/events.service';
import type { Event } from '../types';

export function useEvents(studentId: string | null) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!studentId) {
      setEvents([]);
      return;
    }

    setLoading(true);
    const data = await eventsService.getByStudent(studentId);
    setEvents(data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return { events, loading, reloadEvents: loadEvents };
}
