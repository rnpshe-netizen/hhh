"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // 2,400명의 로컬 빠른 검색을 위해 전체(최대 3,000명)를 가져옵니다.
      const { data } = await supabase.from('members').select('*').limit(3000).order('name', { ascending: true });
      setMembers(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = members.filter(m => 
    m.name.includes(search) || (m.phone && m.phone.includes(search))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>회원 관리 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({members.length}명)</span></h1>
        <input 
          type="text" 
          placeholder="이름으로 검색..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', width: '250px' }}
        />
      </div>

      <div className="card">
        {loading ? <p>데이터를 불러오는 중입니다...</p> : (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>시스템 등록일</th>
                <th>연락처 (준비중)</th>
                <th>이메일 (준비중)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleDateString()}</td>
                  <td style={{ color: '#ccc' }}>{m.phone || '-'}</td>
                  <td style={{ color: '#ccc' }}>{m.email || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '24px'}}>검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
        {!loading && filtered.length > 50 && (
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
            * 전체 {filtered.length}명 중 상위 50명만 표시되고 있습니다. 이름을 검색해 확인하세요.
          </p>
        )}
      </div>
    </div>
  );
}
