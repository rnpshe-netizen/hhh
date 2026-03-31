"use client";
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const PAGE_SIZE = 50;

// Next.js에서 useSearchParams는 Suspense 경계 안에서 사용해야 함
export default function CompletionsPage() {
  return (
    <Suspense fallback={<p>수료 현황을 불러오는 중입니다...</p>}>
      <CompletionsContent />
    </Suspense>
  );
}

function CompletionsContent() {
  const searchParams = useSearchParams();
  const [completions, setCompletions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 필터 — URL 파라미터에서 초기값 읽기 (대시보드 차트 클릭 시)
  const [courseFilter, setCourseFilter] = useState(searchParams?.get('course') || 'all');
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');

  // 과정 목록 로드
  useEffect(() => {
    supabase.from('courses').select('id, name').order('created_at').then(({ data }) => setCourses(data || []));
  }, []);

  // 수료 내역 조회
  const fetchCompletions = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from('completions')
      .select('id, issued_date, cohort, note, created_at, members(id, name, phone, email), courses(id, name, category)', { count: 'exact' });

    // 과정 필터
    if (courseFilter !== 'all') {
      query = query.eq('course_id', courseFilter);
    }

    // 기수 필터
    if (cohortFilter.trim()) {
      query = query.ilike('cohort', `%${cohortFilter.trim()}%`);
    }

    // 이름 검색 (members 관계 필터는 Supabase에서 직접 지원 안 되므로 클라이언트에서 처리)
    query = query.order('issued_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!search.trim()) {
      // 검색어 없으면 서버 페이지네이션
      query = query.range(from, to);
      const { data, count } = await query;
      setCompletions(data || []);
      setTotalCount(count || 0);
    } else {
      // 검색어 있으면 전체 가져와서 클라이언트 필터 (회원명 검색)
      const { data } = await query;
      const filtered = (data || []).filter(c =>
        c.members?.name?.includes(search.trim())
      );
      const sliced = filtered.slice(from, to + 1);
      setCompletions(sliced);
      setTotalCount(filtered.length);
    }

    setLoading(false);
  }, [page, courseFilter, search, cohortFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCompletions, 300);
    return () => clearTimeout(t);
  }, [fetchCompletions]);

  useEffect(() => { setPage(1); }, [courseFilter, search, cohortFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, page - 3);
    let end = Math.min(totalPages, start + 6);
    if (end - start < 6) start = Math.max(1, end - 6);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // CSV 내보내기
  const handleExportCSV = async () => {
    let all = [];
    let offset = 0;
    const batch = 1000;
    while (true) {
      let q = supabase.from('completions')
        .select('issued_date, cohort, note, members(name, phone, email), courses(name)')
        .order('issued_date', { ascending: false, nullsFirst: false });
      if (courseFilter !== 'all') q = q.eq('course_id', courseFilter);
      if (cohortFilter.trim()) q = q.ilike('cohort', `%${cohortFilter.trim()}%`);
      q = q.range(offset, offset + batch - 1);
      const { data } = await q;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < batch) break;
      offset += batch;
    }
    if (search.trim()) {
      all = all.filter(c => c.members?.name?.includes(search.trim()));
    }
    const header = ['회원명', '과정명', '기수', '발급일', '연락처', '이메일', '비고'];
    const rows = all.map(c => [
      c.members?.name || '', c.courses?.name || '', c.cohort || '', c.issued_date || '',
      c.members?.phone || '', c.members?.email || '', c.note || ''
    ]);
    const csv = "\uFEFF" + [header.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `수료현황_추출_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`총 ${all.length}건의 수료 기록을 CSV로 추출했습니다.`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>수료 현황 조회 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({totalCount.toLocaleString()}건)</span></h1>
        <button onClick={handleExportCSV} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
          📥 CSV 추출
        </button>
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', fontSize: '14px', flexWrap: 'wrap' }}>
        <span style={{ color: '#6b7280', fontWeight: 'bold' }}>필터:</span>
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
          <option value="all">과정: 전체</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="text" placeholder="기수 검색 (예: 10기)" value={cohortFilter} onChange={e => setCohortFilter(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', width: '140px' }} />
        <input type="text" placeholder="회원명 검색..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', width: '180px' }} />
        {(courseFilter !== 'all' || search || cohortFilter) && (
          <button onClick={() => { setCourseFilter('all'); setSearch(''); setCohortFilter(''); }}
            style={{ padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
            필터 초기화
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '13px' }}>
          총 {totalCount.toLocaleString()}건 중 {rangeStart}~{rangeEnd} 표시
        </span>
      </div>

      {/* 테이블 */}
      <div className="card">
        {loading ? <p>수료 기록을 불러오는 중입니다...</p> : (
          <table>
            <thead>
              <tr>
                <th>회원명</th>
                <th>과정명</th>
                <th>기수</th>
                <th>발급일</th>
                <th>연락처</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {completions.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{c.members?.name || '-'}</td>
                  <td>
                    <span className={c.courses?.category === '자격증' ? 'badge success' : 'badge'}>
                      {c.courses?.name || '-'}
                    </span>
                  </td>
                  <td>{c.cohort || '-'}</td>
                  <td>{c.issued_date || '-'}</td>
                  <td style={{ color: c.members?.phone ? 'var(--text-main)' : '#ccc', fontSize: '13px' }}>
                    {c.members?.phone || '-'}
                  </td>
                  <td>
                    {c.note && (
                      <span style={{ fontSize: '12px', backgroundColor: '#ffedd5', color: '#c2410c', padding: '2px 6px', borderRadius: '4px' }}>
                        {c.note}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {completions.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '24px'}}>검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtnStyle(page === 1)}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtnStyle(page === 1)}>‹</button>
            {getPageNumbers().map(p => (
              <button key={p} onClick={() => setPage(p)} style={{
                ...pgBtnStyle(false),
                backgroundColor: p === page ? 'var(--primary)' : '#fff',
                color: p === page ? '#fff' : '#374151',
                fontWeight: p === page ? 'bold' : 'normal',
              }}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtnStyle(page === totalPages)}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={pgBtnStyle(page === totalPages)}>»</button>
          </div>
        )}
      </div>
    </div>
  );
}

function pgBtnStyle(disabled) {
  return {
    padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px',
    backgroundColor: disabled ? '#f9fafb' : '#fff', color: disabled ? '#d1d5db' : '#374151',
    cursor: disabled ? 'default' : 'pointer', fontSize: '14px', minWidth: '36px', textAlign: 'center',
  };
}
