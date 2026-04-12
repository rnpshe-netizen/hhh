-- 과정 일정 관리 테이블 + enrollments 확장
-- Supabase SQL Editor에서 실행하세요

-- 1. schedules 테이블
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  dates TEXT,
  day_of_week TEXT,
  time_range TEXT,
  note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedules_course ON schedules(course_id);

-- 2. enrollments에 일정 컬럼 추가
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS schedule_title TEXT;

-- 3. 2026년 일정 INSERT (과정별)
-- TRAIN 기초
INSERT INTO schedules (course_id, title, dates, day_of_week, time_range, note) VALUES
((SELECT id FROM courses WHERE name = 'TRAIN 기초'), '5월 1, 8, 15일', '2026-05-01, 2026-05-08, 2026-05-15', '금', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = 'TRAIN 기초'), '6월 5, 12, 19일', '2026-06-05, 2026-06-12, 2026-06-19', '금', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = 'TRAIN 기초'), '8월 21, 28, 9/4일', '2026-08-21, 2026-08-28, 2026-09-04', '금', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = 'TRAIN 기초'), '9월 7, 14, 21일', '2026-09-07, 2026-09-14, 2026-09-21', '월', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = 'TRAIN 기초'), '10월 2, 16, 23일', '2026-10-02, 2026-10-16, 2026-10-23', '금', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = 'TRAIN 기초'), '11월 2, 9, 16일', '2026-11-02, 2026-11-09, 2026-11-16', '월', '09:30-18:30', '마지막 날 09:30-13:30');

-- TRAIN Advanced
INSERT INTO schedules (course_id, title, dates, day_of_week, time_range, note) VALUES
((SELECT id FROM courses WHERE name = 'TRAIN Advanced'), '5월 15, 22, 29일', '2026-05-15, 2026-05-22, 2026-05-29', '금', '09:30-18:30', '첫날 14:30-18:30'),
((SELECT id FROM courses WHERE name = 'TRAIN Advanced'), '6월 19, 26, 7/3일', '2026-06-19, 2026-06-26, 2026-07-03', '금', '09:30-18:30', '첫날 14:30-18:30'),
((SELECT id FROM courses WHERE name = 'TRAIN Advanced'), '8월 8, 15, 22일', '2026-08-08, 2026-08-15, 2026-08-22', '토', '09:30-18:30', '첫날 14:30-18:30'),
((SELECT id FROM courses WHERE name = 'TRAIN Advanced'), '9월 4, 11, 18일', '2026-09-04, 2026-09-11, 2026-09-18', '금', '09:30-18:30', '첫날 14:30-18:30'),
((SELECT id FROM courses WHERE name = 'TRAIN Advanced'), '9월 21, 28, 10/5일', '2026-09-21, 2026-09-28, 2026-10-05', '월', '09:30-18:30', '첫날 14:30-18:30'),
((SELECT id FROM courses WHERE name = 'TRAIN Advanced'), '11월 16, 23, 30일', '2026-11-16, 2026-11-23, 2026-11-30', '월', '09:30-18:30', '첫날 14:30-18:30');

-- Coaching Basic
INSERT INTO schedules (course_id, title, dates, day_of_week, time_range, note) VALUES
((SELECT id FROM courses WHERE name = 'Coaching Basic'), '5월 1, 8, 15, 22, 29일', '2026-05-01, 2026-05-08, 2026-05-15, 2026-05-22, 2026-05-29', '금', '09:30-18:30', '5주'),
((SELECT id FROM courses WHERE name = 'Coaching Basic'), '6월 5, 12, 19, 26, 7/3일', '2026-06-05, 2026-06-12, 2026-06-19, 2026-06-26, 2026-07-03', '금', '09:30-18:30', '5주'),
((SELECT id FROM courses WHERE name = 'Coaching Basic'), '8월 21, 28, 9/4, 11, 18일', '2026-08-21, 2026-08-28, 2026-09-04, 2026-09-11, 2026-09-18', '금', '09:30-18:30', '5주'),
((SELECT id FROM courses WHERE name = 'Coaching Basic'), '9월 7, 14, 21, 28, 10/5일', '2026-09-07, 2026-09-14, 2026-09-21, 2026-09-28, 2026-10-05', '월', '09:30-18:30', '5주'),
((SELECT id FROM courses WHERE name = 'Coaching Basic'), '11월 2, 9, 16, 23, 30일', '2026-11-02, 2026-11-09, 2026-11-16, 2026-11-23, 2026-11-30', '월', '09:30-18:30', '5주');

-- 가족코칭 전문가
INSERT INTO schedules (course_id, title, dates, day_of_week, time_range, note) VALUES
((SELECT id FROM courses WHERE name = '가족코칭 전문가'), '4월 4, 11, 18, 25, 5/2, 9일', '2026-04-04, 2026-04-11, 2026-04-18, 2026-04-25, 2026-05-02, 2026-05-09', '토', '15:00-19:00', '4시간씩 6주'),
((SELECT id FROM courses WHERE name = '가족코칭 전문가'), '7월 1, 8, 15일', '2026-07-01, 2026-07-08, 2026-07-15', '수', '09:30-18:30', '8시간씩 3주'),
((SELECT id FROM courses WHERE name = '가족코칭 전문가'), '10월 10, 17, 24, 31, 11/7, 14일', '2026-10-10, 2026-10-17, 2026-10-24, 2026-10-31, 2026-11-07, 2026-11-14', '토', '15:00-19:00', '4시간씩 6주');

-- 라이프코칭
INSERT INTO schedules (course_id, title, dates, day_of_week, time_range, note) VALUES
((SELECT id FROM courses WHERE name = '라이프코칭'), '3월 13, 20, 27일', '2026-03-13, 2026-03-20, 2026-03-27', '금', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = '라이프코칭'), '6월 27, 7/4, 11일', '2026-06-27, 2026-07-04, 2026-07-11', '토', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = '라이프코칭'), '7월 10, 17, 24일', '2026-07-10, 2026-07-17, 2026-07-24', '금', '09:30-18:30', '마지막 날 09:30-13:30'),
((SELECT id FROM courses WHERE name = '라이프코칭'), '11월 21, 28, 12/5, 12, 19일', '2026-11-21, 2026-11-28, 2026-12-05, 2026-12-12, 2026-12-19', '토', '15:00-19:00', '4시간씩 5주');

-- 예비부부코칭지도사
INSERT INTO schedules (course_id, title, dates, day_of_week, time_range, note) VALUES
((SELECT id FROM courses WHERE name = '예비부부코칭지도사'), '4월 3, 10, 17일', '2026-04-03, 2026-04-10, 2026-04-17', '금', '09:30-18:30', NULL),
((SELECT id FROM courses WHERE name = '예비부부코칭지도사'), '11월 13, 20, 27일', '2026-11-13, 2026-11-20, 2026-11-27', '금', '09:30-18:30', NULL);
