import React, { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './DebateFlowChart.css';

interface DebateFlowChartProps {
  roundScores: { round: number; agent1: number; agent2: number; reason: string }[];
  agent1Name: string;
  agent2Name: string;
}

export const DebateFlowChart: React.FC<DebateFlowChartProps> = ({ roundScores, agent1Name, agent2Name }) => {
  const [data, setData] = useState<{ round: string; agent1: number; agent2: number; reason: string }[]>([]);

  useEffect(() => {
    // Transform rounds into chart data (accumulative or per-round)
    // Here we show per-round fluctuation
    const chartData = roundScores.map((s) => ({
      round: `R${s.round}`,
      agent1: s.agent1,
      agent2: s.agent2,
      reason: s.reason,
    }));
    setData(chartData);
  }, [roundScores]);

  if (data.length === 0) return null;

  return (
    <div className="debate-flow-chart">
      <div className="chart-header">
        <h3>📊 실시간 토론 우세도</h3>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAgent1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAgent2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff20" />
            <XAxis dataKey="round" stroke="#9ca3af" />
            <YAxis hide domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.9)', border: '1px solid #333', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Area 
              type="monotone" 
              dataKey="agent1" 
              name={agent1Name}
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorAgent1)" 
            />
            <Area 
              type="monotone" 
              dataKey="agent2" 
              name={agent2Name}
              stroke="#ef4444" 
              fillOpacity={1} 
              fill="url(#colorAgent2)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {data.length > 0 && (
        <div className="latest-reason">
          <span className="badge">최신 판정</span>
          <p>{data[data.length - 1].reason}</p>
        </div>
      )}
    </div>
  );
};
