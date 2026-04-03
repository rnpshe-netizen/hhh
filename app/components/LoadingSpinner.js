"use client";

// 로딩 스피너 컴포넌트
export default function LoadingSpinner({ message = '데이터를 불러오는 중입니다...', size = 'medium' }) {
  const sizes = {
    small: { spinner: 20, fontSize: '13px' },
    medium: { spinner: 32, fontSize: '14px' },
    large: { spinner: 48, fontSize: '16px' },
  };
  const s = sizes[size] || sizes.medium;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '12px' }}>
      <div style={{
        width: s.spinner, height: s.spinner,
        border: '3px solid #e5e7eb', borderTop: '3px solid #4A90E2',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      {message && <p style={{ color: '#6b7280', fontSize: s.fontSize, margin: 0 }}>{message}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
