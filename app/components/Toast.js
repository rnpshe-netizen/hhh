"use client";
import { useState, useEffect, createContext, useContext, useCallback } from 'react';

// 토스트 컨텍스트 — 전역에서 토스트를 사용할 수 있도록
const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const toastObj = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    warning: (msg) => addToast(msg, 'warning', 4000),
    info: (msg) => addToast(msg, 'info'),
  };

  const colors = {
    success: { bg: '#dcfce7', border: '#16a34a', text: '#15803d', icon: '✅' },
    error: { bg: '#fee2e2', border: '#dc2626', text: '#dc2626', icon: '❌' },
    warning: { bg: '#fef3c7', border: '#d97706', text: '#92400e', icon: '⚠️' },
    info: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af', icon: 'ℹ️' },
  };

  return (
    <ToastContext.Provider value={toastObj}>
      {children}
      {/* 토스트 컨테이너 */}
      <div style={{ position: 'fixed', top: '80px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              padding: '12px 20px', borderRadius: '8px', borderLeft: `4px solid ${c.border}`,
              backgroundColor: c.bg, color: c.text, fontSize: '14px', fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', pointerEvents: 'auto',
              animation: 'slideIn 0.3s ease-out',
              maxWidth: '400px',
            }}>
              {c.icon} {t.message}
            </div>
          );
        })}
      </div>
      {/* slideIn 애니메이션은 globals.css에 정의 */}
    </ToastContext.Provider>
  );
}
