export const revalidate = 0;

import { supabase } from '../lib/supabaseClient';
import DashboardClient from './DashboardClient';

export default async function Dashboard() {
  const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true });
  const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
  const { count: compCount } = await supabase.from('completions').select('*', { count: 'exact', head: true });
  
  // Get all completions to compute statistics (Supabase 1000건 제한 회피 릴레이 패치)
  const allCompletions = [];
  for (let i = 0;; i += 1000) {
    const { data } = await supabase.from('completions').select('issued_date, courses(name)').range(i, i + 999);
    if (!data || data.length === 0) break;
    allCompletions.push(...data);
  }
  
  // Quick recent 10 (발급일 최신순 정렬 버그 수정 반영)
  const { data: recent } = await supabase.from('completions')
    .select('id, issued_date, cohort, note, members(name), courses(name)')
    .order('issued_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(10);

  // Statistic Processors
  const courseDist = {};
  const yearDist = {};

  allCompletions?.forEach(c => {
    if(c.courses?.name) {
      courseDist[c.courses.name] = (courseDist[c.courses.name] || 0) + 1;
    }
    if(c.issued_date) {
      const y = c.issued_date.substring(0, 4);
      yearDist[y] = (yearDist[y] || 0) + 1;
    }
  });

  const pieData = Object.entries(courseDist).map(([name, value]) => ({ name, value }));
  const trendData = Object.entries(yearDist).sort((a,b) => a[0].localeCompare(b[0])).map(([year, count]) => ({ year, count }));
  const barData = [...pieData].sort((a,b) => b.value - a.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 3 Summary Cards */}
      <div style={{ display: 'flex', gap: '24px' }}>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>총 활성 회원</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>{memberCount?.toLocaleString() || 0} <span style={{fontSize:'16px', fontWeight: 'normal', color: 'gray'}}>명</span></p>
        </div>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid #FFBB28', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>운영 코칭 과정</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>{courseCount?.toLocaleString() || 0} <span style={{fontSize:'16px', fontWeight: 'normal', color: 'gray'}}>분야</span></p>
        </div>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>총 누적 발급</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>{compCount?.toLocaleString() || 0} <span style={{fontSize:'16px', fontWeight: 'normal', color: 'gray'}}>건</span></p>
        </div>
      </div>

      {/* Grid for Charts handled by Client Component */}
      <DashboardClient pieData={pieData} trendData={trendData} barData={barData} />

      {/* Recent History Table */}
      <div className="card">
        <h2 style={{ marginBottom: '16px', fontSize:'18px', color: 'var(--secondary)' }}>최근 발급 현황 보드</h2>
        <table>
          <thead>
            <tr>
              <th>회원명</th>
              <th>과정명</th>
              <th>기수</th>
              <th>발급일</th>
            </tr>
          </thead>
          <tbody>
            {(recent || []).map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.members?.name}</td>
                <td>
                  <span className="badge">{r.courses?.name}</span>
                  {r.note && <span className="badge" style={{marginLeft: '8px', backgroundColor: '#ffedd5', color: '#c2410c'}}>📌 {r.note}</span>}
                </td>
                <td>{r.cohort || '-'}</td>
                <td>{r.issued_date || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
