export const revalidate = 0;

import { supabase } from '../lib/supabaseClient';
import DashboardClient from './DashboardClient';
import RecentCompletions from './RecentCompletions';

export default async function Dashboard() {
  // 모든 쿼리를 병렬 실행하여 로딩 속도 대폭 개선
  // (기존: 순차 실행으로 7~10초 → 병렬: 1~2초)
  // 이번 달 기간 계산
  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    { count: memberCount },
    { count: courseCount },
    { count: compCount },
    { count: hasPhoneCount },
    { count: thisMonthCount },
    { data: recent },
    { data: coursesList },
    // completions 릴레이 패치도 병렬 (1000건씩 7개 동시 요청)
    ...completionBatches
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('completions').select('*', { count: 'exact', head: true }),
    // 연락처 확보율 계산용
    supabase.from('members').select('*', { count: 'exact', head: true }).not('phone', 'is', null).neq('phone', ''),
    // 이번 달 신규 수료자 수
    supabase.from('completions').select('*', { count: 'exact', head: true }).gte('issued_date', thisMonthStart),
    // 과정 목록 (차트 클릭 시 이동용)
    supabase.from('courses').select('id, name'),
    supabase.from('completions')
      .select('id, issued_date, cohort, note, members(name), courses(name)')
      .order('issued_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(10),
    // 7개 배치를 동시에 요청 (최대 7,000건 커버)
    ...[0, 1000, 2000, 3000, 4000, 5000, 6000].map(offset =>
      supabase.from('completions').select('issued_date, courses(name)').range(offset, offset + 999)
    ),
  ]);

  const allCompletions = completionBatches.flatMap(b => b.data || []);

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

  // 과정명 → ID 맵 (차트 클릭 시 수료 현황 페이지 이동용)
  const courseIdMap = {};
  (coursesList || []).forEach(c => { courseIdMap[c.name] = c.id; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 5 Summary Cards — 상단 3개 + 하단 2개 */}
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
      <div style={{ display: 'flex', gap: '24px' }}>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid #8B5CF6', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>연락처 확보율</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px', color: '#8B5CF6' }}>
            {memberCount > 0 ? Math.round((hasPhoneCount / memberCount) * 100) : 0}<span style={{fontSize:'16px', fontWeight: 'normal', color: 'gray'}}>%</span>
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{hasPhoneCount?.toLocaleString() || 0}명 / {memberCount?.toLocaleString() || 0}명</p>
        </div>
        <div className="card" style={{ flex: 1, borderLeft: '4px solid #F97316', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>이번 달 신규 수료</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '8px', color: '#F97316' }}>
            {thisMonthCount?.toLocaleString() || 0}<span style={{fontSize:'16px', fontWeight: 'normal', color: 'gray'}}> 건</span>
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{now.getFullYear()}년 {now.getMonth() + 1}월 기준</p>
        </div>
      </div>

      {/* Grid for Charts handled by Client Component */}
      <DashboardClient pieData={pieData} trendData={trendData} barData={barData} courseIdMap={courseIdMap} />

      {/* 최근 발급 현황 — 클라이언트 컴포넌트에서 '더보기' 처리 */}
      <RecentCompletions initial={recent || []} />

    </div>
  );
}
