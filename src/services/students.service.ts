import { supabase } from '../lib/supabase';
import type { Student } from '../types';

export const studentsService = {
  async getById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error loading student:', error);
      return null;
    }

    return data as Student | null;
  },

  async getByPeriod(periodId: string): Promise<Student[]> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('period_id', periodId)
      .order('first_name');

    if (error) {
      console.error('Error loading students:', error);
      return [];
    }

    return (data || []) as Student[];
  },

  async create(periodId: string, firstName: string, lastName: string): Promise<Student | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('students')
      .insert({
        user_id: user.id,
        period_id: periodId,
        first_name: firstName,
        last_name: lastName
      } as any)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating student:', error);
      return null;
    }

    return data as Student | null;
  },

  async update(id: string, updates: Partial<Student>): Promise<boolean> {
    const { error } = await supabase
      .from('students')
      .update(updates as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating student:', error);
      return false;
    }

    return true;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting student:', error);
      return false;
    }

    return true;
  }
};
