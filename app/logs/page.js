"use client";
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PAGE_SIZE = 50;

const ACTION_LABELS = {
  create: { text: '생성', color: '#16a34a', bg: '#dcfce7' },
  update: { text: '수정', color: '#2563eb', bg: '#dbeafe' },
  delete: { text: '삭제', color: '#dc2626', bg: '#fee2e2' },
  hide:   { text: '숨김', color: '#92400e', bg: '#fef3c7' },
  backup: { text: '백업', color: '#7c3aed', bg: '#ede9fe' },
};

const TARGET_LABELS = {
  member: '회원',
  course: '과정',
  completion: '수료',
};

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }
    if (targetFilter !== 'all') {
      query = query.eq('target_type', targetFilter);
    }
    if (search.trim()) {
      query = query.ilike('target_name', `%${search.trim()}%`);
    }

    query = query.range(from, to);
    const { data, count, error: queryError } = await query;

    if (queryError) {
      if (queryError.message.includes('activity_logs')) {
        setError('활동 로그 테이블이 아직 생성되지 않았습니다.\n\nSupabase SQL Editor에서 scripts/create-activity-logs.sql을 실행해주세요.');
      } else {
        setError(queryError.message);
      }
      setLogs([]);
      setTotalCount(0);
    } else {
      setLogs(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [page, actionFilter, targetFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => { setPage(1); }, [actionFilter, targetFilter, search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0 }}>활동 로그 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({totalCount.toLocaleString()}건)</span></h1>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', fontSize: '14px' }}>
        <span style={{ color: '#6b7280', fontWeight: 'bold' }}>필터:</span>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
          <option value="all">전체 활동</option>
          <option value="create">생성</option>
          <option value="update">수정</option>
          <option value="delete">삭제</option>
          <option value="hide">숨김</option>
          <option value="backup">백업</option>
        </select>
        <select value={targetFilter} onChange={e => setTargetFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
          <option value="all">전체 대상</option>
          <option value="member">회원</option>
          <option value="course">과정</option>
          <option value="completion">수료</option>
        </select>
        <input type="text" placeholder="이름 검색..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', width: '160px' }} />
        {(actionFilter !== 'all' || targetFilter !== 'all' || search) && (
          <button onClick={() => { setActionFilter('all'); setTargetFilter('all'); setSearch(''); }}
            style={{ padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
            필터 초기화
          </button>
        )}
      </div>

      <div className="card">
        {error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#92400e', backgroundColor: '#fef3c7', borderRadius: '8px', whiteSpace: 'pre-line' }}>
            ⚠️ {error}
          </div>
        ) : loading ? (
          <p>로그를 불러오는 중입니다...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>시간</th>
                <th>활동</th>
                <th>대상</th>
                <th>이름</th>
                <th>상세 내용</th>
                <th>수행자</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const actionInfo = ACTION_LABELS[log.action] || { text: log.action, color: '#666', bg: '#f3f4f6' };
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: actionInfo.color, backgroundColor: actionInfo.bg }}>
                        {actionInfo.text}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>{TARGET_LABELS[log.target_type] || log.target_type}</td>
                    <td style={{ fontWeight: 500 }}>{log.target_name || '-'}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details || '-'}
                    </td>
                    <td style={{ fontSize: '13px' }}>{log.performed_by || 'admin'}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', padding: '24px'}}>기록된 활동이 없습니다.</td></tr>}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtnStyle(page === 1)}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtnStyle(page === 1)}>‹</button>
            <span style={{ padding: '6px 12px', fontSize: '14px' }}>{page} / {totalPages}</span>
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
    cursor: disabled ? 'default' : 'pointer', fontSize: '14px',
  };
}
