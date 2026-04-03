"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null); // 현재 처리 중인 항목 ID

  // 대기 건 목록 조회
  const fetchPending = async () => {
    setLoading(true);
    const { data } = await supabase.from('pending_syncs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setPendingItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  // 구글 시트에서 새 데이터 가져오기
  const handleSync = async () => {
    if (!window.confirm('구글 시트에서 새 수강신청 데이터를 가져옵니다.\n진행하시겠습니까?')) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      fetchPending(); // 대기 건 새로고침
    } catch (err) {
      setSyncResult({ error: err.message });
    }
    setSyncing(false);
  };

  // 변경사항 승인/거부 토글
  const toggleChange = (itemId, changeIdx) => {
    setPendingItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newChanges = [...item.changes];
      newChanges[changeIdx] = { ...newChanges[changeIdx], approved: !newChanges[changeIdx].approved };
      return { ...item, changes: newChanges };
    }));
  };

  // 전체 승인
  const approveAll = (itemId) => {
    setPendingItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newChanges = item.changes.map(c => ({ ...c, approved: true }));
      return { ...item, changes: newChanges };
    }));
  };

  // 승인 처리 실행
  const handleApprove = async (item) => {
    setProcessing(item.id);
    try {
      const res = await fetch('/api/sync/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncId: item.id, action: 'approve', changes: item.changes }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPending();
      } else {
        alert('처리 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      alert('API 오류: ' + err.message);
    }
    setProcessing(null);
  };

  // 건너뛰기
  const handleSkip = async (item) => {
    if (!window.confirm(`${item.form_data.name}님의 신청 건을 건너뛰시겠습니까?\n(나중에 다시 처리할 수 없습니다)`)) return;
    setProcessing(item.id);
    try {
      await fetch('/api/sync/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncId: item.id, action: 'skip' }),
      });
      fetchPending();
    } catch (err) {
      alert('오류: ' + err.message);
    }
    setProcessing(null);
  };

  // 유형별 뱃지
  const typeBadge = (type) => {
    if (type === 'new') return { label: '신규', bg: '#dcfce7', color: '#16a34a' };
    if (type === 'update') return { label: '기존 회원', bg: '#dbeafe', color: '#2563eb' };
    if (type === 'similar') return { label: '동명이인 주의', bg: '#fef3c7', color: '#d97706' };
    return { label: type, bg: '#f3f4f6', color: '#6b7280' };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>폼 동기화 <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>({pendingItems.length}건 대기)</span></h1>
        <button onClick={handleSync} disabled={syncing}
          style={{ padding: '10px 24px', backgroundColor: syncing ? '#ccc' : '#4A90E2', color: '#fff', border: 'none', borderRadius: '6px', cursor: syncing ? 'default' : 'pointer', fontWeight: 'bold' }}>
          {syncing ? '🔄 가져오는 중...' : '🔄 구글 시트에서 가져오기'}
        </button>
      </div>

      {/* 동기화 결과 */}
      {syncResult && (
        <div className="card" style={{ marginBottom: '16px', borderLeft: `4px solid ${syncResult.error ? '#dc2626' : '#16a34a'}` }}>
          {syncResult.error ? (
            <p style={{ color: '#dc2626' }}>오류: {syncResult.error}</p>
          ) : (
            <p>새로 가져온 건: <strong>{syncResult.created}</strong>건 / 건너뜀: {syncResult.skipped}건</p>
          )}
        </div>
      )}

      {/* 대기 건 목록 */}
      {loading ? <p>로딩 중...</p> : pendingItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <p style={{ fontSize: '18px' }}>처리할 대기 건이 없습니다</p>
          <p style={{ fontSize: '14px' }}>구글 시트에서 새 데이터를 가져오려면 위 버튼을 클릭하세요</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pendingItems.map(item => {
            const badge = typeBadge(item.sync_type);
            const fd = item.form_data;
            const isProcessing = processing === item.id;
            const hasApproved = (item.changes || []).some(c => c.approved);

            return (
              <div key={item.id} className="card" style={{ borderLeft: `4px solid ${badge.color}`, opacity: isProcessing ? 0.5 : 1 }}>
                {/* 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{fd.name}</span>
                    {fd.nameEn && <span style={{ color: '#9ca3af' }}>({fd.nameEn})</span>}
                    <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    {fd.isRetake && <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#d97706' }}>재수강</span>}
                  </div>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{new Date(item.created_at).toLocaleString()}</span>
                </div>

                {/* 기본 정보 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px', fontSize: '14px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                  <div><strong>연락처:</strong> {fd.phone || '-'}</div>
                  <div><strong>이메일:</strong> {fd.email || '-'}</div>
                  <div><strong>생년월일:</strong> {fd.birthDate || '-'}</div>
                  <div style={{ gridColumn: '1 / -1' }}><strong>주소:</strong> {fd.address || '-'}</div>
                  {fd.courseName && <div style={{ gridColumn: '1 / -1' }}><strong>신청 과정:</strong> {fd.courseName}</div>}
                </div>

                {/* 변경사항 — 필드별 승인/거부 */}
                {item.changes && item.changes.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                      {item.sync_type === 'update' ? '변경사항 확인' : '등록 항목 확인'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {item.changes.map((change, idx) => (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 14px', borderRadius: '6px',
                          backgroundColor: change.approved ? '#f0fdf4' : '#fff',
                          border: `1px solid ${change.approved ? '#86efac' : '#e5e7eb'}`,
                        }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: '#374151' }}>{change.label}</strong>
                            {change.old && (
                              <span style={{ margin: '0 8px', color: '#9ca3af' }}>
                                <span style={{ textDecoration: 'line-through', color: '#dc2626' }}>{change.old}</span>
                                {' → '}
                              </span>
                            )}
                            <span style={{ color: '#16a34a', fontWeight: 500 }}>{change.new}</span>
                            {change.isRetake && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#d97706' }}>(재수강)</span>}
                          </div>
                          <button onClick={() => toggleChange(item.id, idx)}
                            style={{
                              padding: '4px 14px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                              border: change.approved ? '1px solid #16a34a' : '1px solid #d1d5db',
                              backgroundColor: change.approved ? '#16a34a' : '#fff',
                              color: change.approved ? '#fff' : '#6b7280',
                            }}>
                            {change.approved ? '✓ 승인' : '미승인'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <button onClick={() => approveAll(item.id)}
                    style={{ padding: '6px 14px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                    전체 승인
                  </button>
                  <button onClick={() => handleSkip(item)} disabled={isProcessing}
                    style={{ padding: '6px 14px', backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
                    건너뛰기
                  </button>
                  <button onClick={() => handleApprove(item)} disabled={isProcessing || !hasApproved}
                    style={{
                      padding: '6px 20px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', cursor: isProcessing || !hasApproved ? 'default' : 'pointer',
                      backgroundColor: hasApproved ? '#4A90E2' : '#e5e7eb',
                      color: hasApproved ? '#fff' : '#9ca3af',
                      border: 'none',
                    }}>
                    {isProcessing ? '처리 중...' : item.sync_type === 'new' || item.sync_type === 'similar' ? '회원 등록' : '변경사항 반영'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
