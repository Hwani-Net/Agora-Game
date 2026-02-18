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

interface HistoryData {
  price: number;
  timestamp: string;
}

interface Props {
  data: HistoryData[];
  height?: number | string;
}

export default function StockHistoryChart({ data, height = 300 }: Props) {
  const { i18n } = useTranslation();

  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      time: new Date(d.timestamp).toLocaleTimeString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
  }, [data, i18n.language]);

  if (data.length === 0) {
    return (
      <div className="flex-center p-y-24 text-muted">
        데이터가 부족하여 차트를 표시할 수 없습니다. (데이터 수집 중...)
      </div>
    );
  }

  const minPrice = Math.min(...data.map(d => d.price)) * 0.95;
  const maxPrice = Math.max(...data.map(d => d.price)) * 1.05;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
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
            domain={[minPrice, maxPrice]} 
            hide 
          />
          <Tooltip 
            contentStyle={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px',
              color: 'var(--text-primary)'
            }}
            itemStyle={{ color: 'var(--accent-primary)' }}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="var(--accent-primary)" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
