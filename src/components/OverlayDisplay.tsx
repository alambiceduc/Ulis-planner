import { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { OverlayPeriodItem } from '../lib/database.types';
import { calculateEventDuration } from '../lib/timeUtils';

interface OverlayDisplayProps {
  profileId: string | null;
  day: number;
  time: string;
  step: number;
}

interface OverlayState {
  items: OverlayPeriodItem[];
  visible: boolean;
}

export function OverlayDisplay({ profileId, day, time, step }: OverlayDisplayProps) {
  const [state, setState] = useState<OverlayState>({ items: [], visible: true });

  useEffect(() => {
    loadOverlays();
  }, [profileId]);

  const loadOverlays = async () => {
    if (!profileId) {
      setState({ items: [], visible: true });
      return;
    }

    const { data, error } = await supabase
      .from('overlay_period_items')
      .select('*')
      .eq('period_profile_id', profileId)
      .eq('is_enabled', true);

    if (error) {
      console.error('Error loading overlays:', error);
    } else {
      setState(prev => ({ ...prev, items: data || [] }));
    }
  };

  const getOverlayForSlot = () => {
    return state.items.find(
      item =>
        item.days.includes(day) &&
        item.start_time <= time &&
        item.end_time > time
    );
  };

  const overlay = getOverlayForSlot();

  if (!overlay || !state.visible) return null;

  const isFirstSlot = overlay.start_time === time;
  if (!isFirstSlot) return null;

  const duration = calculateEventDuration(overlay.start_time, overlay.end_time);
  const heightInSlots = duration / step;

  return (
    <div
      className={`absolute inset-0 ${overlay.color} bg-opacity-20 border-2 border-opacity-40 rounded-lg pointer-events-none z-10`}
      style={{ height: `${heightInSlots * 4}rem` }}
    >
      <div className="p-2 text-xs font-semibold text-gray-800 opacity-70">
        {overlay.name}
      </div>
    </div>
  );
}

export function OverlayToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-lg transition-colors text-sm"
    >
      {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      <span>{visible ? 'Masquer' : 'Afficher'} overlays</span>
    </button>
  );
}

export function useOverlayVisibility() {
  const [visible, setVisible] = useState(true);
  return { visible, toggle: () => setVisible(!visible) };
}
