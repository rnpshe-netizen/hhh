-- 활동 로그 테이블 생성
-- Supabase SQL Editor에서 실행하세요
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,         -- 'create' | 'update' | 'delete' | 'hide'
  target_type TEXT NOT NULL,    -- 'member' | 'course' | 'completion'
  target_id UUID,               -- 대상 레코드 ID
  target_name TEXT,             -- 대상 이름 (회원명, 과정명 등)
  details TEXT,                 -- 변경 상세 내용
  performed_by TEXT DEFAULT 'admin', -- 수행한 사용자 (추후 멀티유저 시 활용)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target ON activity_logs(target_type, target_id);
