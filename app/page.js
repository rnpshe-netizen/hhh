import { supabase } from '../lib/supabaseClient';

export const revalidate = 0;

export default async function Dashboard() {
  const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true });
  const { count: courseCount } = await supabase.from('courses').select('*', { count: 'exact', head: true });
  const { count: compCount } = await supabase.from('completions').select('*', { count: 'exact', head: true });
  
  const { data: recent } = await supabase.from('completions')
    .select('id, issued_date, cohort, members(name), courses(name)')
    .order('id', { ascending: false })
    .limit(10);

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>대시보드 개요</h1>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--text-muted)' }}>총 회원 수</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>{memberCount?.toLocaleString() || 0} 명</p>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--text-muted)' }}>운영 코칭 과정</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px' }}>{courseCount?.toLocaleString() || 0} 개</p>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--text-muted)' }}>누적 발급 건수</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px', color: 'var(--primary)' }}>{compCount?.toLocaleString() || 0} 건</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '16px' }}>최신 수료 내역 샘플 (최근 등록순)</h2>
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
                <td><span className="badge">{r.courses?.name}</span></td>
                <td>{r.cohort || '-'}</td>
                <td>{r.issued_date || '-'}</td>
              </tr>
            ))}
            {!recent?.length && (
              <tr><td colSpan="4">데이터가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
