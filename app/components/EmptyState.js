"use client";

// 빈 상태 표시 컴포넌트 — 데이터가 없을 때 표시
export default function EmptyState({ icon = '📋', title = '데이터가 없습니다', description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <p style={{ fontSize: '16px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>{title}</p>
      {description && <p style={{ fontSize: '13px', marginBottom: '16px' }}>{description}</p>}
      {action}
    </div>
  );
}
