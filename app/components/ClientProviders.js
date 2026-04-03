"use client";
import { ToastProvider } from './Toast';

// 클라이언트 전용 프로바이더 래퍼 — layout.js(서버 컴포넌트)에서 사용
export default function ClientProviders({ children }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
