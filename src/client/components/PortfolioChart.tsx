import { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useTranslation } from 'react-i18next';

interface PortfolioSnapshot {
  total_assets: number;
  recorded_at: string;
}

interface Props {
  data: PortfolioSnapshot[];
  height?: number | string;
}

export default function PortfolioChart({ data, height = 300 }: Props) {
  const { i18n } = useTranslation();

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      time: new Date(d.recorded_at).toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
        month: 'numeric',
        day: 'numeric',
      }),
    }));
  }, [data, i18n.language]);

  if (data.length === 0) {
    return (
      <div className="flex-center p-y-24 text-muted border-dashed">
        <div className="text-center">
          <p>📉</p>
          <p className="text-sm">No historical data yet.</p>
          <p className="text-xs text-muted">History starts tracking today.</p>
        </div>
      </div>
    );
  }

  const minVal = Math.min(...data.map(d => d.total_assets)) * 0.95;
  const maxVal = Math.max(...data.map(d => d.total_assets)) * 1.05;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffd700" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ffd700" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="time" 
            stroke="var(--text-muted)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <YAxis 
            domain={[minVal, maxVal]} 
            hide 
          />
          <Tooltip 
            contentStyle={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px',
              color: 'var(--text-primary)'
            }}
            formatter={(value: any) => [value != null ? `${Number(value).toLocaleString()} G` : '-', 'Assets']}
            itemStyle={{ color: '#ffd700' }}
          />
          <Area 
            type="monotone" 
            dataKey="total_assets" 
            stroke="#ffd700" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorAssets)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
