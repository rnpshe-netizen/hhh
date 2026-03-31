import { supabase } from './supabaseClient';

// 활동 로그 기록 (DB에 activity_logs 테이블이 없으면 무시)
export async function logActivity({ action, targetType, targetId, targetName, details }) {
  try {
    await supabase.from('activity_logs').insert([{
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      details,
    }]);
  } catch (e) {
    // 테이블이 없어도 앱이 중단되지 않도록 무시
  }
}
