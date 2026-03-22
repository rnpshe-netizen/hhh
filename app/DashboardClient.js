"use client";
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as LineTooltip, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, Legend } from 'recharts';
import { BarChart, Bar, XAxis as BarXAxis, YAxis as BarYAxis, Tooltip as BarTooltip } from 'recharts';

const COLORS = ['#4A90E2', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6B6B', '#4ADEDE', '#845EC2'];

export default function DashboardClient({ pieData, trendData, barData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
      
      {/* 1. Line/Area Chart */}
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3 style={{ marginBottom: '24px', fontSize: '16px', color: 'var(--secondary)' }}>연도별 훈련원 수료생 획득 추이</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4A90E2" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#4A90E2" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E4E8" />
              <XAxis dataKey="year" stroke="#888" tick={{ fontSize: 13 }} tickMargin={10} />
              <YAxis stroke="#888" tick={{ fontSize: 13 }} />
              <LineTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="count" stroke="#4A90E2" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" name="신규 수료 건수" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Bar Chart */}
      <div className="card" style={{ minHeight: '350px' }}>
        <h3 style={{ marginBottom: '24px', fontSize: '16px', color: 'var(--secondary)' }}>분야별 누적 배출 현황 (랭킹)</h3>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E0E4E8" />
              <BarXAxis type="number" stroke="#888" tick={{ fontSize: 12 }} />
              <BarYAxis dataKey="name" type="category" stroke="#888" tick={{ fontSize: 12 }} width={110} />
              <BarTooltip cursor={{ fill: '#F4F7F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="value" fill="#00C49F" radius={[0, 4, 4, 0]} name="총 누적 인원" barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Pie Chart */}
      <div className="card" style={{ minHeight: '350px' }}>
        <h3 style={{ marginBottom: '24px', fontSize: '16px', color: 'var(--secondary)' }}>전체 과정 점유율 분포</h3>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="45%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <PieTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
