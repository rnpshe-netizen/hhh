"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: true });
      setCourses(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>코칭 과정 관리</h1>
        <button style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          + 새 과정 추가
        </button>
      </div>

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
              {courses.map(c => (
                <tr key={c.id}>
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
