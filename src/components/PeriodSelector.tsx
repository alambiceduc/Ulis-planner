import { useEffect, useState } from 'react';
import { Calendar, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Period, PeriodName } from '../lib/database.types';

const PERIODS: PeriodName[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

interface PeriodSelectorProps {
  onSelectPeriod: (period: Period) => void;
}

export function PeriodSelector({ onSelectPeriod }: PeriodSelectorProps) {
  const { signOut, user } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPeriods();
    }
  }, [user]);

  const loadPeriods = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) {
        console.error('Error loading periods:', error.message, error.details, error.code);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        setPeriods(data);
        setLoading(false);
      } else {
        await initializePeriods(user.id);
      }
    } catch (err) {
      console.error('Unexpected error loading periods:', err);
      setLoading(false);
    }
  };

  const initializePeriods = async (userId: string) => {
    const periodsToInsert = PERIODS.map(name => ({
      user_id: userId,
      name
    }));

    const { data, error } = await supabase
      .from('periods')
      .insert(periodsToInsert as any)
      .select();

    if (error) {
      console.error('Error creating periods:', error);
    } else if (data) {
      setPeriods(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">ULIS Planner</h1>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Déconnexion</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            Sélectionnez une période
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => onSelectPeriod(period)}
                className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl p-6 transition-all transform hover:scale-105 shadow-md"
              >
                <div className="text-3xl font-bold mb-2">{period.name}</div>
                <div className="text-sm opacity-90">Période {period.name.slice(1)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
