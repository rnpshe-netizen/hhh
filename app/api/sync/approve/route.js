// 동기화 승인 처리 API — 관리자가 승인한 변경사항을 DB에 반영
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { syncId, action, changes } = await request.json();
    // action: 'approve' (승인 — changes 배열의 approved 필드 반영) | 'skip' (건너뛰기)

    if (!syncId) return NextResponse.json({ error: 'syncId 필수' }, { status: 400 });

    const { data: sync, error: fetchErr } = await supabase.from('pending_syncs')
      .select('*').eq('id', syncId).single();

    if (fetchErr || !sync) return NextResponse.json({ error: '대기 건을 찾을 수 없습니다' }, { status: 404 });

    if (action === 'skip') {
      // 건너뛰기 — 상태만 변경
      await supabase.from('pending_syncs').update({
        status: 'skipped', resolved_at: new Date().toISOString(), resolved_by: 'admin'
      }).eq('id', syncId);
      return NextResponse.json({ success: true, action: 'skipped' });
    }

    // 승인 처리
    const formData = sync.form_data;
    const approvedChanges = changes || [];

    if (sync.sync_type === 'new' || sync.sync_type === 'similar') {
      // 신규 회원 등록
      const { data: newMember, error: insertErr } = await supabase.from('members').insert([{
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        name_en: formData.nameEn || null,
        birth_date: formData.birthDate || null,
        address: formData.address || null,
      }]).select().single();

      if (insertErr) return NextResponse.json({ error: '회원 등록 실패: ' + insertErr.message }, { status: 500 });

      // 신청 과정 연결
      const courseChange = approvedChanges.find(c => c.field === 'course' && c.approved);
      if (courseChange && formData.courseName) {
        const { data: course } = await supabase.from('courses')
          .select('id').ilike('name', `%${formData.courseName.split('(')[0].trim()}%`).limit(1);
        if (course && course.length > 0) {
          await supabase.from('completions').insert([{
            member_id: newMember.id,
            course_id: course[0].id,
            note: formData.isRetake ? '재수강' : '구글폼 신청',
          }]);
        }
      }

      await supabase.from('pending_syncs').update({
        status: 'resolved', changes: approvedChanges,
        resolved_at: new Date().toISOString(), resolved_by: 'admin'
      }).eq('id', syncId);

      return NextResponse.json({ success: true, action: 'created', memberId: newMember.id });

    } else if (sync.sync_type === 'update') {
      // 기존 회원 업데이트 — 승인된 필드만 반영
      const memberId = sync.member_id;
      const updates = {};

      for (const change of approvedChanges) {
        if (!change.approved) continue;

        if (change.field === 'email') {
          updates.email = change.new;
        } else if (change.field === 'course') {
          // 과정 연결
          const courseName = change.new;
          const { data: course } = await supabase.from('courses')
            .select('id').ilike('name', `%${courseName.split('(')[0].trim()}%`).limit(1);
          if (course && course.length > 0) {
            await supabase.from('completions').insert([{
              member_id: memberId,
              course_id: course[0].id,
              note: change.isRetake ? '재수강' : '구글폼 신청',
            }]);
          }
        }
      }

      // 메모 업데이트 (주소, 영문이름 등)
      const addrChange = approvedChanges.find(c => c.field === 'address' && c.approved);
      const nameEnChange = approvedChanges.find(c => c.field === 'nameEn' && c.approved);
      if (addrChange || nameEnChange) {
        const { data: member } = await supabase.from('members').select('memo').eq('id', memberId).single();
        let memo = member?.memo || '';
        if (addrChange) {
          memo = memo.replace(/주소: [^/]+/, '').trim();
          memo = (memo ? memo + ' / ' : '') + `주소: ${addrChange.new}`;
        }
        if (nameEnChange) {
          memo = memo.replace(/영문: [^/]+/, '').trim();
          memo = (memo ? memo + ' / ' : '') + `영문: ${nameEnChange.new}`;
        }
        updates.memo = memo.replace(/^[\s/]+|[\s/]+$/g, '');
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('members').update(updates).eq('id', memberId);
      }

      await supabase.from('pending_syncs').update({
        status: 'resolved', changes: approvedChanges,
        resolved_at: new Date().toISOString(), resolved_by: 'admin'
      }).eq('id', syncId);

      return NextResponse.json({ success: true, action: 'updated', memberId });
    }

    return NextResponse.json({ error: '알 수 없는 sync_type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
