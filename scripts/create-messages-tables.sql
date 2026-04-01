-- Phase 2: 메시지 발송 시스템 테이블
-- Supabase SQL Editor에서 실행하세요

-- 1. 메시지 템플릿 (자주 쓰는 메시지 저장)
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'all',
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 발송 캠페인 (한 번의 발송 작업 단위)
CREATE TABLE IF NOT EXISTS message_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  target_filter JSONB,
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 개별 발송 기록 (회원별 발송 결과)
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES message_campaigns(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name TEXT,
  channel TEXT NOT NULL,
  recipient TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_campaign ON message_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_member ON message_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_message_campaigns_status ON message_campaigns(status);
