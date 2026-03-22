const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mojdmdykymwmshrhfkbr.supabase.co', 'sb_publishable_Va_82Vqs5ehoin5uwXIspA_F1_9-O0_');
async function run() {
  const { data } = await supabase.from('members').select('*, completions(*, courses(name))').eq('name', '이희영');
  if(!data || data.length === 0) return console.log("Not found");
  
  const counts = {};
  data[0].completions.forEach(c => {
    const courseName = c.courses.name;
    counts[courseName] = (counts[courseName] || 0) + 1;
  });
  
  console.log("=== 이희영 님의 수료 과정 집계 ===");
  console.log(`총 수료 건수: ${data[0].completions.length}건`);
  for(const [course, count] of Object.entries(counts)) {
    console.log(`- ${course}: ${count}건`);
  }
}
run();
