-- =============================================
-- 국제코칭훈련원 회원·과정 통합 관리 시스템
-- Supabase DB 테이블 생성 SQL
-- =============================================

-- 1. 회원 테이블: 코칭 과정을 수료한 회원 정보를 저장합니다.
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- 이름
  phone TEXT,                            -- 연락처 (Phase 2용)
  email TEXT,                            -- 이메일 (Phase 2용)
  created_at TIMESTAMPTZ DEFAULT now()   -- 등록일
);

-- 2. 과정 테이블: 운영 중인 코칭 과정 목록을 저장합니다.
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                    -- 과정명 (예: TRAIN 기초)
  category TEXT NOT NULL DEFAULT '수료증', -- 카테고리 (수료증 / 자격증)
  description TEXT,                      -- 과정 설명
  created_at TIMESTAMPTZ DEFAULT now()   -- 등록일
);

-- 3. 수료 기록 테이블: 회원과 과정의 다대다(N:N) 관계를 연결합니다.
CREATE TABLE IF NOT EXISTS completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,   -- 회원 FK
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,   -- 과정 FK
  registration_no TEXT,                  -- 등록번호 (예: 제2020-T기001)
  issued_date DATE,                      -- 발급일
  cohort TEXT,                           -- 기수 (예: 1기)
  note TEXT,                             -- 비고
  created_at TIMESTAMPTZ DEFAULT now()   -- 기록 생성일
);

-- 4. 인덱스: 검색 성능을 위한 인덱스를 생성합니다.
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_completions_member ON completions(member_id);
CREATE INDEX IF NOT EXISTS idx_completions_course ON completions(course_id);

-- 5. 초기 과정 데이터: 현재 운영 중인 7개 과정을 미리 등록합니다.
INSERT INTO courses (name, category, description) VALUES
  ('TRAIN 기초', '수료증', 'TRAIN 코칭 기초 과정'),
  ('TRAIN 심화', '수료증', 'TRAIN 코칭 심화 과정'),
  ('TRAIN Advanced', '수료증', 'TRAIN 코칭 어드밴스드 과정'),
  ('TRAIN 기초+심화', '수료증', 'TRAIN 코칭 기초+심화 통합 과정'),
  ('가족코칭 전문가', '수료증', '가족코칭 전문가 과정'),
  ('가족코칭지도사 2급', '자격증', '가족코칭지도사 2급 자격증 과정'),
  ('라이프코칭', '수료증', '라이프코칭_존재를 다루는 여정 과정');
