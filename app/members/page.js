"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Supabase 실시간 서버 검색 및 1000건 제한 우회
  useEffect(() => {
    let isMounted = true;
    const fetchMembers = async () => {
      setLoading(true);
      
      // 실제 전체 개수를 가져옵니다 (Supabase API 제한 우회)
      if (totalCount === 0) {
        const { count } = await supabase.from('members').select('*', { count: 'exact', head: true });
        if (isMounted && count) setTotalCount(count);
      }
      
      // 검색어가 있으면 서버 데이터베이스에서 즉석 필터링, 없으면 최신 50명만 가져옵니다.
      let query = supabase.from('members').select('*').order('created_at', { ascending: false }).limit(50);
      
      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      
      const { data } = await query;
      if (isMounted) {
        setMembers(data || []);
        setLoading(false);
      }
    };

    // 타자 칠 때마다 계속 서버에 요청하지 않도록 0.3초 대기 (디바운스)
    const timeoutId = setTimeout(() => {
      fetchMembers();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [search, totalCount]);

  const handleAddMember = async () => {
    if (!newName.trim()) return alert("이름을 입력해주세요.");
    const { data, error } = await supabase.from('members').insert([{ name: newName, phone: newPhone, email: newEmail }]).select();
    if (error) {
      alert("오류 발생: " + error.message);
    } else if (data) {
      setMembers([data[0], ...members]);
      setTotalCount(prev => prev + 1);
      setIsAdding(false);
      setNewName(''); setNewPhone(''); setNewEmail('');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>회원 관리 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({totalCount.toLocaleString()}명)</span></h1>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            style={{ padding: '6px 12px', backgroundColor: isAdding ? '#ccc' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isAdding ? '작성 취소' : '+ 새 회원 등록'}
          </button>
        </div>
        <input 
          type="text" 
          placeholder="데이터베이스 서버 검색..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', width: '250px' }}
        />
      </div>

      {isAdding && (
        <div className="card" style={{ marginBottom: '24px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ marginBottom: '16px' }}>신규 회원 등록</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="text" placeholder="이름 (필수)" value={newName} onChange={e => setNewName(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="text" placeholder="연락처" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="email" placeholder="이메일" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <button onClick={handleAddMember} style={{ padding: '8px 24px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>명단에 추가</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <p>서버에서 회원 데이터를 찾는 중입니다...</p> : (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>시스템 등록일</th>
                <th>연락처</th>
                <th>이메일</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, idx) => (
                <tr key={m.id || idx}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '방금 전'}</td>
                  <td style={{ color: m.phone ? 'var(--text-main)' : '#ccc' }}>{m.phone || '-'}</td>
                  <td style={{ color: m.email ? 'var(--text-main)' : '#ccc' }}>{m.email || '-'}</td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '24px'}}>검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
        {!search && !loading && (
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
            * 전체 {totalCount.toLocaleString()}명 중 최신 가입 50명만 표시되고 있습니다. 전체 명단을 검색하려면 위쪽 검색창을 이용하세요.
          </p>
        )}
      </div>
    </div>
  );
}
