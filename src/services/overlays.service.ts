import { supabase } from '../lib/supabase';
import type { OverlayPeriodItem } from '../types';

export const overlaysService = {
  async getByPeriodProfile(periodProfileId: string): Promise<OverlayPeriodItem[]> {
    const { data, error } = await supabase
      .from('overlay_period_items')
      .select('*')
      .eq('period_profile_id', periodProfileId)
      .eq('is_enabled', true);

    if (error) {
      console.error('Error loading overlays:', error);
      return [];
    }

    return (data || []) as OverlayPeriodItem[];
  }
};
