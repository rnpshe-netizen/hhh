-- 수강 신청 이력 테이블 + 보유 자격 컬럼
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  course_name TEXT,
  amount INTEGER DEFAULT 0,
  is_retake BOOLEAN DEFAULT FALSE,
  extra_cert BOOLEAN DEFAULT FALSE,
  payment_status TEXT DEFAULT 'pending',
  payment_confirmed_at TIMESTAMPTZ,
  payment_confirmed_by TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_member ON enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_payment ON enrollments(payment_status);

ALTER TABLE members ADD COLUMN IF NOT EXISTS current_cert TEXT;
