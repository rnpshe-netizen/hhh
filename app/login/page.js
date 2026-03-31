"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // admin_users 테이블에서 계정 확인
      const { data, error: queryError } = await supabase.from('admin_users')
        .select('id, username, display_name, role, is_active')
        .eq('username', username)
        .eq('password_hash', password)
        .single();

      if (queryError || !data) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      if (!data.is_active) {
        setError('비활성화된 계정입니다. 관리자에게 문의하세요.');
        setLoading(false);
        return;
      }

      // 마지막 로그인 시간 업데이트
      await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', data.id);

      // 세션 저장 (localStorage)
      localStorage.setItem('icti_session', JSON.stringify({
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        role: data.role,
        loginAt: new Date().toISOString(),
      }));

      // 대시보드로 이동
      window.location.href = '/';
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7F6' }}>
      <div style={{ width: '400px', padding: '48px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.png" alt="ICTI" style={{ maxWidth: '160px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '20px', color: '#2C3E50', marginBottom: '4px' }}>ICTI-MIS</h1>
          <p style={{ color: '#888', fontSize: '14px' }}>국제코칭훈련원 통합업무시스템</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px', fontWeight: 500 }}>아이디</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="관리자 아이디 입력" autoFocus
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#374151', marginBottom: '6px', fontWeight: 500 }}>비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' }} />
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !username || !password}
            style={{ width: '100%', padding: '14px', backgroundColor: '#4A90E2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          현재는 Basic Auth 인증이 활성화되어 있습니다.<br/>
          멀티유저 전환 시 이 로그인 페이지가 사용됩니다.
        </p>
      </div>
    </div>
  );
}
