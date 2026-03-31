-- 회원 비활성화(숨김) 기능을 위한 is_active 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 인덱스 추가 (비활성 회원 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_members_is_active ON members(is_active);
