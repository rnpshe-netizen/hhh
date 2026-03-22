require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function clean() {
  console.log("Fetching members and completions...");
  
  let allMembers = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await supabase.from('members').select('id').range(i, i + 999);
    if (!data || data.length === 0) break;
    allMembers.push(...data);
  }
  
  let allCompletions = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await supabase.from('completions').select('member_id').range(i, i + 999);
    if (!data || data.length === 0) break;
    allCompletions.push(...data);
  }

  const activeMemberIds = new Set(allCompletions.map(c => c.member_id));
  const orphanIds = allMembers.map(m => m.id).filter(id => !activeMemberIds.has(id));
  
  console.log(`Total DB Members: ${allMembers.length}`);
  console.log(`Orphans (no completions due to script re-run) to remove: ${orphanIds.length}`);

  for (let i = 0; i < orphanIds.length; i += 500) {
    const chunk = orphanIds.slice(i, i + 500);
    await supabase.from('members').delete().in('id', chunk);
  }
  console.log("Orphan member cleanup finished.");
}
clean();
