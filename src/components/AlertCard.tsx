import { Text, View } from 'react-native';

import { formatMinutes } from '@/lib/format';
import type { Alert } from '@/lib/stats';

function describe(alert: Alert): { title: string; body: string } {
  switch (alert.kind) {
    case 'neglect':
      return { title: `Neglecting ${alert.area.name}`, body: `No logs in the last ${alert.days} days.` };
    case 'dominance':
      return {
        title: `${alert.area.name} is taking over`,
        body: `${Math.round(alert.share * 100)}% of this week's logged time.`,
      };
    case 'ceiling':
      return {
        title: `${alert.area.name} is over its ceiling`,
        body: `${formatMinutes(alert.minutes)} this week, max ${formatMinutes(alert.ceiling)}.`,
      };
  }
}

export function AlertCard({ alert }: { alert: Alert }) {
  const isNeglect = alert.kind === 'neglect';
  const { title, body } = describe(alert);

  return (
    <View
      className={`rounded-2xl border p-4 ${
        isNeglect ? 'border-amber-500/40 bg-amber-500/10' : 'border-rose-500/40 bg-rose-500/10'
      }`}>
      <Text className={`font-semibold ${isNeglect ? 'text-amber-300' : 'text-rose-300'}`}>{title}</Text>
      <Text className="mt-1 text-slate-300">{body}</Text>
    </View>
  );
}
