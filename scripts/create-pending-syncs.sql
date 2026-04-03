-- 동기화 승인 시스템: 구글 폼 → 관리자 승인 대기 테이블
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS pending_syncs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_row INTEGER,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  sync_type TEXT NOT NULL,
  form_data JSONB NOT NULL,
  changes JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_syncs_status ON pending_syncs(status);
