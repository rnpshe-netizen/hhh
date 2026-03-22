/**
 * Supabase 클라이언트 유틸리티
 * - 웹 브라우저에서 Supabase 데이터베이스에 접속하기 위한 연결 도구입니다.
 * - .env.local 파일에 저장된 URL과 Key를 사용합니다.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
