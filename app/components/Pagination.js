"use client";
import { pgBtnStyle, getPageNumbers } from '../../lib/utils';

// 공통 페이지네이션 컴포넌트
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
      <button onClick={() => onPageChange(1)} disabled={page === 1} style={pgBtnStyle(page === 1)}>«</button>
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={pgBtnStyle(page === 1)}>‹</button>
      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)} style={{
          ...pgBtnStyle(false),
          backgroundColor: p === page ? 'var(--primary)' : '#fff',
          color: p === page ? '#fff' : '#374151',
          fontWeight: p === page ? 'bold' : 'normal',
        }}>{p}</button>
      ))}
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={pgBtnStyle(page === totalPages)}>›</button>
      <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages} style={pgBtnStyle(page === totalPages)}>»</button>
    </div>
  );
}
