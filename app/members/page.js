"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    async function load() {
      // 최신 등록순으로 보여줍니다
      const { data } = await supabase.from('members').select('*').limit(3000).order('created_at', { ascending: false });
      setMembers(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleAddMember = async () => {
    if (!newName.trim()) return alert("이름을 입력해주세요.");
    const { data, error } = await supabase.from('members').insert([{ name: newName, phone: newPhone, email: newEmail }]).select();
    if (error) {
      alert("오류 발생: " + error.message);
    } else if (data) {
      setMembers([data[0], ...members]);
      setIsAdding(false);
      setNewName(''); setNewPhone(''); setNewEmail('');
    }
  };

  const filtered = members.filter(m => 
    m.name.includes(search) || (m.phone && m.phone.includes(search))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>회원 관리 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({members.length}명)</span></h1>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            style={{ padding: '6px 12px', backgroundColor: isAdding ? '#ccc' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isAdding ? '취소' : '+ 새 회원 둥록'}
          </button>
        </div>
        <input 
          type="text" 
          placeholder="이름/연락처 검색..." 
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
            <button onClick={handleAddMember} style={{ padding: '8px 24px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>저장하기</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <p>데이터를 불러오는 중입니다...</p> : (
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
              {filtered.slice(0, 50).map((m, idx) => (
                <tr key={m.id || idx}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '방금 전'}</td>
                  <td style={{ color: m.phone ? 'var(--text-main)' : '#ccc' }}>{m.phone || '-'}</td>
                  <td style={{ color: m.email ? 'var(--text-main)' : '#ccc' }}>{m.email || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '24px'}}>검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
        {!loading && filtered.length > 50 && (
          <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
            * 전체 {filtered.length}명 중 최신 가입 50명만 표시되고 있습니다. 이름을 검색해 확인하세요.
          </p>
        )}
      </div>
    </div>
  );
}
