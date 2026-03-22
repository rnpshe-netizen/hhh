-- Phase 1.5: 과정 숨김 처리(Soft Delete) 기능 도입
-- 기존의 과정 기록을 보존하기 위해, 과정을 완전히 삭제(Delete)하지 않고 화면에서만 가리기 위한 컬럼 추가

ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 기본적으로 모든 기존/신규 과정을 활성 상태(true)로 유지합니다.
-- 향후 회원에게 새로운 과정을 발급할 때, is_active가 true인 과정만 선택 목록에 나오게 됩니다.
