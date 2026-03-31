const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mojdmdykymwmshrhfkbr.supabase.co', 'sb_publishable_Va_82Vqs5ehoin5uwXIspA_F1_9-O0_');

async function analyze() {
  console.log('--- 데이터 정밀 진단 시작 ---');
  
  // 1. 전체 회원 수집 (페이징 보완)
  let allMembers = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('members').select('id, name, phone, email').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    allMembers = allMembers.concat(data);
    from += 1000;
  }
  
  const total = allMembers.length;
  const noPhone = allMembers.filter(m => !m.phone || m.phone.trim() === '').length;
  const noEmail = allMembers.filter(m => !m.email || m.email.trim() === '').length;

  // 2. 전체 수료 기록 수집 (페이징 보완)
  let allCompletions = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase.from('completions').select('member_id').range(from, from + 999);
    if (error || !data || data.length === 0) break;
    allCompletions = allCompletions.concat(data);
    from += 1000;
  }

  // 3. 1인당 수료 횟수 계산 (동명이인 리스크 파악)
  const stats = {};
  allCompletions.forEach(c => {
    stats[c.member_id] = (stats[c.member_id] || 0) + 1;
  });

  // 수료 횟수가 비정상적으로 많은 상위 5명 (동명이인 확률 높음)
  const suspicious = allMembers
    .map(m => ({ name: m.name, count: stats[m.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  console.log('--- 진단 결과 요약 ---');
  console.log(`전체 회원 수: ${total}명`);
  console.log(`연락처(전화번호) 누락: ${noPhone}명 (${((noPhone/total)*100).toFixed(1)}%)`);
  console.log(`이메일 누락: ${noEmail}명 (${((noEmail/total)*100).toFixed(1)}%)`);
  console.log('\n--- 동명 이인 의심 사례 (한 이름에 과다 수료 기록) ---');
  suspicious.forEach((s, i) => {
    if (s.count > 3) {
      console.log(`${i+1}. [${s.name}]님: 수료 기록 ${s.count}건 (서로 다른 사람일 가능성 매우 높음)`);
    }
  });
}

analyze();
