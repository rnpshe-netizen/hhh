-- 회원 메모 기능을 위한 memo 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
ALTER TABLE members ADD COLUMN IF NOT EXISTS memo TEXT;
