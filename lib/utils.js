// 프로젝트 공통 유틸리티 함수

// 전화번호 자동 포맷팅 (숫자만 입력해도 010-XXXX-XXXX 형태로)
export function formatPhone(value) {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return digits.slice(0, 3) + '-' + digits.slice(3);
  return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7, 11);
}

// 이메일 형식 검증
export function isValidEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 페이지네이션 버튼 스타일
export function pgBtnStyle(disabled) {
  return {
    padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px',
    backgroundColor: disabled ? '#f9fafb' : '#fff', color: disabled ? '#d1d5db' : '#374151',
    cursor: disabled ? 'default' : 'pointer', fontSize: '14px', minWidth: '36px', textAlign: 'center',
  };
}

// 페이지 번호 목록 생성 (최대 7개 표시)
export function getPageNumbers(page, totalPages) {
  const pages = [];
  let start = Math.max(1, page - 3);
  let end = Math.min(totalPages, start + 6);
  if (end - start < 6) start = Math.max(1, end - 6);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}
