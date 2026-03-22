"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('수료증');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: true });
      setCourses(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleAddCourse = async () => {
    if (!newName.trim()) return alert("과정명을 입력해주세요.");
    const { data, error } = await supabase.from('courses').insert([{ name: newName, category: newCat, description: newDesc }]).select();
    if (error) {
      alert("오류 발생: " + error.message);
    } else if (data) {
      setCourses([...courses, data[0]]);
      setIsAdding(false);
      setNewName(''); setNewDesc(''); setNewCat('수료증');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>코칭 과정 관리</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          style={{ padding: '8px 16px', backgroundColor: isAdding ? '#ccc' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isAdding ? '작성 취소' : '+ 새 과정 추가'}
        </button>
      </div>

      {isAdding && (
        <div className="card" style={{ marginBottom: '24px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ marginBottom: '16px' }}>신규 운영 과정 등록</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="text" placeholder="과정명 (예: 라이프코칭 심화)" value={newName} onChange={e => setNewName(e.target.value)} style={{ padding: '8px', flex: 2, border: '1px solid #ccc', borderRadius: '4px' }} />
            <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }}>
              <option value="수료증">수료증 과정</option>
              <option value="자격증">자격증 과정</option>
            </select>
            <input type="text" placeholder="간단한 설명" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ padding: '8px', flex: 2, border: '1px solid #ccc', borderRadius: '4px' }} />
            <button onClick={handleAddCourse} style={{ padding: '8px 24px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>명단에 추가</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <p>데이터를 불러오는 중입니다...</p> : (
          <table>
            <thead>
              <tr>
                <th>과정명</th>
                <th>분류</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c, idx) => (
                <tr key={c.id || idx}>
                  <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                  <td>
                    <span className={c.category === '자격증' ? 'badge success' : 'badge'}>
                      {c.category}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.description || '-'}</td>
                </tr>
              ))}
              {courses.length === 0 && <tr><td colSpan="3">등록된 과정이 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
