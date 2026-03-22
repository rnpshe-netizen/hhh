"use client";

export default function Topbar() {
  const handleLogout = () => {
    // Basic Auth 로그아웃 우회 꼼수: 잘못된 자격 증명을 전송하여 브라우저에 저장된 인증 정보 캐시 무효화 유도
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/", true, "logout", "logout"); // 일부러 틀린 계정 요청
    xhr.send();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        // 인증 실패로 401을 받게 되면 새로고침하여 로그인 팝업 재호출 유도
        window.location.href = '/';
      }
    };
  };

  return (
    <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <span>코칭 대시보드 관리자 화면</span>
      <button 
        onClick={handleLogout}
        style={{ 
          padding: '8px 16px', backgroundColor: '#f1f3f5', color: 'var(--text-main)', 
          border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 
        }}
      >
        🔓 로그아웃
      </button>
    </header>
  );
}
