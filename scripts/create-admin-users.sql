-- 관리자 계정 테이블 생성
-- Supabase SQL Editor에서 실행하세요
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,   -- 평문이 아닌 해시된 비밀번호
  display_name TEXT NOT NULL,    -- 화면에 표시될 이름
  role TEXT DEFAULT 'admin',     -- 'admin' | 'viewer' (추후 권한 분리용)
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 관리자 계정 삽입 (비밀번호: admin123!)
-- 주의: 실제 운영에서는 반드시 비밀번호를 변경하세요
INSERT INTO admin_users (username, password_hash, display_name, role)
VALUES ('admin', 'admin123!', '관리자', 'admin')
ON CONFLICT (username) DO NOTHING;
