import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Event } from '../lib/database.types';

interface UndoAction {
  type: 'events';
  previousState: Event[];
  timestamp: number;
}

export function useUndoHistory(studentId: string) {
  const [history, setHistory] = useState<UndoAction[]>([]);

  const captureState = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('student_id', studentId);

    if (error) {
      console.error('Error capturing state:', error);
      return;
    }

    const action: UndoAction = {
      type: 'events',
      previousState: data || [],
      timestamp: Date.now()
    };

    setHistory(prev => [...prev, action]);
  }, [studentId]);

  const undo = useCallback(async (onRestore?: () => void) => {
    if (history.length === 0) return;

    const lastAction = history[history.length - 1];

    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('student_id', studentId);

    if (deleteError) {
      console.error('Error clearing events:', deleteError);
      return;
    }

    if (lastAction.previousState.length > 0) {
      const eventsToRestore = lastAction.previousState.map(event => ({
        id: event.id,
        student_id: event.student_id,
        day_of_week: event.day_of_week,
        start_time: event.start_time,
        end_time: event.end_time,
        type: event.type,
        label: event.label,
        aesh: event.aesh,
        created_at: event.created_at
      }));

      const { error: insertError } = await supabase
        .from('events')
        .insert(eventsToRestore);

      if (insertError) {
        console.error('Error restoring events:', insertError);
        return;
      }
    }

    setHistory(prev => prev.slice(0, -1));

    if (onRestore) {
      onRestore();
    }
  }, [history, studentId]);

  const canUndo = history.length > 0;

  return {
    captureState,
    undo,
    canUndo,
    historyLength: history.length
  };
}
