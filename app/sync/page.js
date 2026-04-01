"use client";
import { useState } from 'react';

export default function SyncPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    if (!window.confirm('구글 시트에서 새로운 수강신청 데이터를 가져옵니다.\n진행하시겠습니까?')) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || '동기화 실패');
      }
    } catch (err) {
      setError('API 호출 실패: ' + err.message);
    }

    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>구글 폼 동기화</h1>

      {/* 안내 */}
      <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #4A90E2' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>동기화 프로세스</h3>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '14px', color: '#6b7280' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>📝</div>
            <div>수강생이<br/>구글 폼 작성</div>
          </div>
          <div style={{ fontSize: '20px', color: '#d1d5db' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>📊</div>
            <div>구글 시트에<br/>자동 저장</div>
          </div>
          <div style={{ fontSize: '20px', color: '#d1d5db' }}>→</div>
          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '8px', border: '2px solid #4A90E2' }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>🔄</div>
            <div style={{ fontWeight: 'bold', color: '#4A90E2' }}>이 버튼으로<br/>DB 동기화</div>
          </div>
          <div style={{ fontSize: '20px', color: '#d1d5db' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>✅</div>
            <div>회원 관리에서<br/>확인</div>
          </div>
        </div>
      </div>

      {/* 동기화 실행 */}
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <button onClick={handleSync} disabled={loading}
          style={{
            padding: '16px 48px', fontSize: '18px', fontWeight: 'bold',
            backgroundColor: loading ? '#ccc' : '#4A90E2', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: loading ? 'default' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(74,144,226,0.3)',
          }}>
          {loading ? '🔄 동기화 중...' : '🔄 지금 동기화 실행'}
        </button>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#9ca3af' }}>
          구글 시트에서 아직 처리되지 않은 새 신청 건만 가져옵니다
        </p>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="card" style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#16a34a' }}>동기화 완료!</h3>
          <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#16a34a' }}>{result.synced}</div>
              <div style={{ color: '#6b7280' }}>신규 등록</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#6b7280' }}>{result.skipped}</div>
              <div style={{ color: '#6b7280' }}>건너뜀 (기존/처리완료)</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{result.total}</div>
              <div style={{ color: '#6b7280' }}>전체 행</div>
            </div>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div style={{ padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '4px', marginTop: '8px' }}>
              <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '8px' }}>오류 {result.errors.length}건:</p>
              {result.errors.map((e, i) => (
                <p key={i} style={{ fontSize: '13px', color: '#dc2626' }}>행 {e.row} ({e.name}): {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="card" style={{ marginTop: '24px', borderLeft: '4px solid #dc2626' }}>
          <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>동기화 실패</h3>
          <p style={{ color: '#6b7280' }}>{error}</p>
        </div>
      )}

      {/* 설정 안내 */}
      <div className="card" style={{ marginTop: '24px', backgroundColor: '#f8fafc' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#6b7280' }}>설정 안내</h3>
        <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.8' }}>
          동기화를 위해 Vercel 환경변수 3개가 필요합니다:<br/>
          <code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '2px' }}>GOOGLE_SHEET_ID</code> — 구글 시트 ID (URL에서 추출)<br/>
          <code style={{ backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '2px' }}>GOOGLE_SERVICE_ACCOUNT_KEY</code> — 구글 서비스 계정 JSON 키<br/>
          설정 방법은 관리자 매뉴얼을 참고하세요.
        </p>
      </div>
    </div>
  );
}
