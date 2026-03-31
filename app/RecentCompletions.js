"use client";
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function RecentCompletions({ initial }) {
  const [items, setItems] = useState(initial);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleLoadMore = async () => {
    setLoading(true);
    const newLimit = limit + 20;
    const { data } = await supabase.from('completions')
      .select('id, issued_date, cohort, note, members(name), courses(name)')
      .order('issued_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(newLimit);
    setItems(data || []);
    setLimit(newLimit);
    setLoading(false);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', color: 'var(--secondary)', margin: 0 }}>최근 발급 현황 보드</h2>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>{items.length}건 표시</span>
      </div>
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
          {items.map((r) => (
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
      {items.length >= limit && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={handleLoadMore} disabled={loading}
            style={{ padding: '8px 24px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
            {loading ? '불러오는 중...' : `더보기 (+20건)`}
          </button>
        </div>
      )}
    </div>
  );
}
