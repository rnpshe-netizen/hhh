// 오염 데이터 전체 정리 스크립트
// 실행 전 --dry-run으로 먼저 확인, 실제 반영은 --apply
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://mojdmdykymwmshrhfkbr.supabase.co',
  'sb_publishable_Va_82Vqs5ehoin5uwXIspA_F1_9-O0_'
);

const DRY_RUN = !process.argv.includes('--apply');

// 재추출 결과 로드
const reextracted = JSON.parse(fs.readFileSync('c:/HHH/tmp/reextracted_contacts.json', 'utf-8'));

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN 모드 (--apply로 실제 반영)\n' : '🚀 APPLY 모드 — DB를 수정합니다\n');

  const log = [];
  let fixCount = 0;

  // ============================================================
  // 1단계: 훈련원 연락처 오염 정정 (29명)
  // ============================================================
  console.log('=== 1단계: 훈련원 연락처 오염 정정 ===');

  for (const entry of reextracted) {
    if (entry.status === 'error') continue;

    // DB에서 이 사람 찾기
    const searchName = entry.name;
    const { data: rows } = await supabase.from('members')
      .select('id,name,phone,email')
      .eq('name', searchName);

    if (!rows || rows.length === 0) {
      // 이름이 안 맞는 경우 (144209, 김선희6951, (수기야마 에미) 등) — DB에 없을 수 있음
      continue;
    }

    for (const row of rows) {
      const updates = {};
      const reasons = [];

      // phone이 훈련원 번호이면 → 재추출 결과로 교체 (또는 null)
      if (row.phone === '010-8330-4399') {
        updates.phone = entry.new.phone; // null이면 null로
        reasons.push(`phone: ${row.phone} → ${entry.new.phone || 'null'}`);
      }
      // email이 훈련원 것이면 → 재추출 결과로 교체
      if (row.email === 'dreamhhh@naver.com') {
        updates.email = entry.new.email;
        reasons.push(`email: ${row.email} → ${entry.new.email || 'null'}`);
      }

      if (reasons.length > 0) {
        console.log(`  🔧 ${row.name}: ${reasons.join(' | ')}`);
        log.push({ step: 1, name: row.name, id: row.id, action: 'fix_training_center', updates, reasons });
        fixCount++;

        if (!DRY_RUN) {
          const { error } = await supabase.from('members')
            .update(updates)
            .eq('id', row.id);
          if (error) console.log(`    ❌ 에러: ${error.message}`);
        }
      }
    }
  }

  // ============================================================
  // 2단계: 유사 훈련원 번호 (010-8030-4399) — 1자리 차이
  // ============================================================
  console.log('\n=== 2단계: 유사 훈련원 번호 정정 ===');

  const { data: simRows } = await supabase.from('members')
    .select('id,name,phone,email')
    .eq('phone', '010-8030-4399');

  for (const row of (simRows || [])) {
    const updates = {};
    const reasons = [];

    // 이정숙: 재추출에서 email=jhanna70@naver.com 발견
    if (row.name === '이정숙') {
      updates.phone = null; // 010-8030-4399 는 본인것 아님 (훈련원 번호 유사)
      updates.email = 'jhanna70@naver.com';
      reasons.push('phone: 010-8030-4399 → null (훈련원유사)', 'email: dreamhhh@naver.com → jhanna70@naver.com');
    }
    // 이희영: phone은 010-8030-4399인데 이게 진짜 본인 것인지 불분명
    if (row.name === '이희영') {
      // 이희영의 email은 preety1017@naver.com — 이건 본인 것일 가능성 높음
      // phone만 null 처리
      updates.phone = null;
      reasons.push('phone: 010-8030-4399 → null (훈련원유사, 확인필요)');
    }

    if (reasons.length > 0) {
      console.log(`  🔧 ${row.name}: ${reasons.join(' | ')}`);
      log.push({ step: 2, name: row.name, id: row.id, action: 'fix_similar_phone', updates, reasons });
      fixCount++;

      if (!DRY_RUN) {
        const { error } = await supabase.from('members')
          .update(updates)
          .eq('id', row.id);
        if (error) console.log(`    ❌ 에러: ${error.message}`);
      }
    }
  }

  // ============================================================
  // 3단계: 잘못된 이름 키로 업데이트된 DB 레코드 정정
  // ============================================================
  console.log('\n=== 3단계: 잘못된 이름 키 정정 ===');

  // '선경' — 실제 이 이름의 회원이 있다면 파싱 오류 데이터가 들어갔을 수 있음
  const { data: sgRows } = await supabase.from('members')
    .select('id,name,phone,email')
    .eq('name', '선경');

  for (const row of (sgRows || [])) {
    // '선경'이라는 이름 자체가 파싱 오류로 만들어진 키 → 연락처가 다른 사람(김미애, 선경) 것일 수 있음
    // 안전하게 연락처를 null 처리
    console.log(`  🔧 선경: phone=${row.phone} email=${row.email} → 둘 다 null (파싱오류 의심)`);
    log.push({ step: 3, name: '선경', id: row.id, action: 'fix_bad_name', updates: { phone: null, email: null }, reasons: ['파싱 오류 이름 — 연락처 신뢰 불가'] });
    fixCount++;

    if (!DRY_RUN) {
      await supabase.from('members').update({ phone: null, email: null }).eq('id', row.id);
    }
  }

  // ============================================================
  // 4단계: 최여림 전화번호 의심 (재추출에서도 원본 못 찾음)
  // ============================================================
  console.log('\n=== 4단계: 최여림 전화번호 검증 ===');
  const { data: yrRows } = await supabase.from('members')
    .select('id,name,phone,email')
    .eq('name', '최여림');

  for (const row of (yrRows || [])) {
    if (row.phone === '010-8524-7805') {
      // 재추출에서 원본 PDF에 이 번호가 없었음 — 출석부에서 온 것일 수 있으니 유지
      console.log(`  ℹ️ 최여림: phone=${row.phone} — 출석부 출처, 유지`);
    }
    if (row.email === 'dreamhhh@naver.com') {
      console.log(`  🔧 최여림: email dreamhhh@naver.com → null`);
      log.push({ step: 4, name: '최여림', id: row.id, action: 'fix_email', updates: { email: null }, reasons: ['email 오염'] });
      fixCount++;
      if (!DRY_RUN) {
        await supabase.from('members').update({ email: null }).eq('id', row.id);
      }
    }
  }

  // ============================================================
  // 요약
  // ============================================================
  console.log('\n========================================');
  console.log(`총 정정 대상: ${fixCount}건`);
  console.log(DRY_RUN ? '⚠️ DRY RUN — 실제 DB 미변경' : '✅ DB 정정 완료');
  console.log('========================================');

  // 로그 저장
  fs.writeFileSync('c:/HHH/tmp/fix_contaminated_log.json', JSON.stringify(log, null, 2));
  console.log('로그 저장: c:/HHH/tmp/fix_contaminated_log.json');
}

run().catch(console.error);
