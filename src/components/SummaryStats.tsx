import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { Event } from '../lib/database.types';
import { calculateEventDuration, formatMinutesToDisplay } from '../lib/timeUtils';

interface SummaryStatsProps {
  events: Event[];
  includeVieScolaireInPercentages?: boolean;
}

export function SummaryStats({ events, includeVieScolaireInPercentages = false }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const vieScolaireMinutes = events
      .filter(e => e.type === 'VIE_SCOLAIRE')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const eventsForPercentages = includeVieScolaireInPercentages
      ? events
      : events.filter(e => e.type !== 'VIE_SCOLAIRE');

    const totalMinutes = eventsForPercentages.reduce((sum, event) => {
      return sum + calculateEventDuration(event.start_time, event.end_time);
    }, 0);

    const totalMinutesIncludingVieScolaire = events.reduce((sum, event) => {
      return sum + calculateEventDuration(event.start_time, event.end_time);
    }, 0);

    const ulisMinutes = events
      .filter(e => e.type === 'ULIS')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const classeMinutes = events
      .filter(e => e.type === 'CLASSE')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const priseEnChargeMinutes = events
      .filter(e => e.type === 'PRISE_EN_CHARGE')
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const aeshMinutes = events
      .filter(e => e.aesh)
      .reduce((sum, event) => sum + calculateEventDuration(event.start_time, event.end_time), 0);

    const calculatePercentage = (minutes: number) => {
      if (totalMinutes === 0) return 0;
      return Math.round((minutes / totalMinutes) * 100);
    };

    return [
      {
        label: 'Total hebdomadaire',
        minutes: totalMinutes,
        percentage: 100,
        color: 'bg-gray-100',
        textColor: 'text-gray-800'
      },
      {
        label: 'ULIS',
        minutes: ulisMinutes,
        percentage: calculatePercentage(ulisMinutes),
        color: 'bg-blue-100',
        textColor: 'text-blue-800'
      },
      {
        label: 'Classe (inclusion)',
        minutes: classeMinutes,
        percentage: calculatePercentage(classeMinutes),
        color: 'bg-green-100',
        textColor: 'text-green-800'
      },
      {
        label: 'Prises en charge',
        minutes: priseEnChargeMinutes,
        percentage: calculatePercentage(priseEnChargeMinutes),
        color: 'bg-gray-100',
        textColor: 'text-gray-800'
      },
      {
        label: 'AESH',
        minutes: aeshMinutes,
        percentage: calculatePercentage(aeshMinutes),
        color: 'bg-orange-100',
        textColor: 'text-orange-800'
      },
      {
        label: 'Vie scolaire',
        minutes: vieScolaireMinutes,
        percentage: includeVieScolaireInPercentages
          ? calculatePercentage(vieScolaireMinutes)
          : Math.round((vieScolaireMinutes / totalMinutesIncludingVieScolaire) * 100),
        color: 'bg-pink-100',
        textColor: 'text-pink-800',
        info: !includeVieScolaireInPercentages ? '(hors calcul %)' : ''
      }
    ].filter(stat => stat.minutes > 0 || stat.label === 'Total hebdomadaire');
  }, [events, includeVieScolaireInPercentages]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">Statistiques hebdomadaires</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-lg p-4`}>
            <div className={`text-2xl font-bold ${stat.textColor} mb-1`}>
              {stat.percentage}%
            </div>
            <div className="text-sm text-gray-700 font-medium mb-1">
              {stat.label}
            </div>
            <div className="text-xs text-gray-600">
              {formatMinutesToDisplay(stat.minutes)}
            </div>
            {'info' in stat && stat.info && (
              <div className="text-xs text-gray-500 italic mt-1">
                {stat.info}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
