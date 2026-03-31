// 매칭 데이터를 Supabase DB에 밀어넣는 스크립트
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://mojdmdykymwmshrhfkbr.supabase.co';
const supabaseKey = 'sb_publishable_Va_82Vqs5ehoin5uwXIspA_F1_9-O0_';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1~3순위 통합 매칭 결과
const matchedNames = [
  ...require('./matching_report.json').exactMatch,
  ...require('./matching_report.json').courseMatch,
  ...require('./matching_report.json').nameOnlyMatch
];
const extracted = require('./extracted_contacts.json');

async function updateDB() {
  console.log(`🚀 연락처 업데이트 대상: 총 ${matchedNames.length}명`);
  let success = 0;
  let errors = 0;

  for (const name of matchedNames) {
    const data = extracted[name];
    if (!data) continue;
    
    // DB 업데이트 쿼리 (이름 기반)
    // 실제로는 동명이인이 있을 수 있지만, 3순위까지 전부 밀어넣으라는 매니저님 지시에 따름
    const updatePayload = {};
    if (data.phone) updatePayload.phone = data.phone;
    if (data.email) updatePayload.email = data.email;

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase.from('members')
        .update(updatePayload)
        .eq('name', name);
        
      if (error) {
        console.error(`❌ [${name}] 오류:`, error.message);
        errors++;
      } else {
        success++;
        process.stdout.write(`\r진행률: ${success} / ${matchedNames.length}`);
      }
    }
  }

  console.log(`\n\n✅ DB 업데이트 완료! 성공: ${success}건, 실패: ${errors}건`);
}

updateDB();
