import { supabase } from '../lib/supabase';
import type { Event, EventType } from '../types';

export const eventsService = {
  async getByStudent(studentId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('student_id', studentId);

    if (error) {
      console.error('Error loading events:', error);
      return [];
    }

    return (data || []) as Event[];
  },

  async getByStudents(studentIds: string[]): Promise<Event[]> {
    if (studentIds.length === 0) return [];

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('student_id', studentIds);

    if (error) {
      console.error('Error loading events:', error);
      return [];
    }

    return (data || []) as Event[];
  },

  async create(
    studentId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    type: EventType,
    aesh: boolean,
    label: string,
    location: string
  ): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .insert({
        student_id: studentId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        type,
        aesh,
        label,
        location
      } as any)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating event:', error);
      return null;
    }

    return data as Event | null;
  },

  async createMultiple(events: Array<{
    student_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    type: EventType;
    aesh: boolean;
    label: string;
    location: string;
  }>): Promise<boolean> {
    const { error } = await supabase
      .from('events')
      .insert(events as any);

    if (error) {
      console.error('Error creating events:', error);
      return false;
    }

    return true;
  },

  async update(id: string, updates: Partial<Event>): Promise<boolean> {
    const { error } = await supabase
      .from('events')
      .update(updates as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating event:', error);
      return false;
    }

    return true;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event:', error);
      return false;
    }

    return true;
  }
};
