"use client";

// 커스텀 확인 다이얼로그 — window.confirm 대체
export default function ConfirmDialog({ title, message, confirmText = '확인', cancelText = '취소', onConfirm, onCancel, danger = false }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      onClick={onCancel}>
      <div style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '12px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: '18px', marginBottom: '12px', color: danger ? '#dc2626' : '#374151' }}>
          {danger ? '🚨 ' : ''}{title}
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-line' }}>{message}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
            {cancelText}
          </button>
          <button onClick={onConfirm} style={{
            padding: '8px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
            backgroundColor: danger ? '#dc2626' : '#4A90E2', color: '#fff',
          }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
