-- 과정 구조 확장: 시간(hours) 및 참가비(price) 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- 1. 컬럼 추가
ALTER TABLE courses ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;

-- 2. 기존 과정 시간/가격 설정
UPDATE courses SET hours = 20, price = 440000 WHERE name = 'TRAIN 기초';
UPDATE courses SET hours = 20, price = 550000 WHERE name = 'TRAIN 심화';
UPDATE courses SET hours = 20, price = 550000 WHERE name = 'TRAIN Advanced';
UPDATE courses SET hours = 20, price = 0 WHERE name = 'TRAIN 기초+심화';
UPDATE courses SET hours = 24, price = 660000 WHERE name = '가족코칭 전문가';
UPDATE courses SET hours = 0, price = 0 WHERE name = '가족코칭지도사 2급';
UPDATE courses SET hours = 20, price = 550000 WHERE name = '라이프코칭';

-- 3. 신규 과정 추가
INSERT INTO courses (name, category, description, hours, price, is_active)
VALUES
  ('예비부부코칭지도사', '수료증', '예비부부코칭지도사 과정', 24, 525000, true),
  ('Coaching Basic', '수료증', 'Coaching Basic 과정', 40, 990000, true),
  ('LCTP', '수료증', 'Life Coaching Training Program (ICF Level 2 인증 140시간)', 140, 5500000, true)
ON CONFLICT DO NOTHING;
