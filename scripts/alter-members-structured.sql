-- 회원 상세 구조화: memo에서 독립 컬럼으로 분리
-- Supabase SQL Editor에서 실행하세요

-- 1. 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
