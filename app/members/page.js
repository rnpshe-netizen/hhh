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

  // Phase 1.5: 회원 상세 / 수정 / 삭제 상태
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberCompletions, setMemberCompletions] = useState([]);
  const [courses, setCourses] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Phase 1.5: 수동 수료(발급) 연결 폼 상태
  const [issueCourseId, setIssueCourseId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [issueCohort, setIssueCohort] = useState('');

  useEffect(() => {
    supabase.from('courses').select('*').order('created_at').then(({ data }) => setCourses(data || []));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchMembers = async () => {
      setLoading(true);
      if (totalCount === 0) {
        const { count } = await supabase.from('members').select('*', { count: 'exact', head: true });
        if (isMounted && count) setTotalCount(count);
      }
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
    const timeoutId = setTimeout(() => { fetchMembers(); }, 300);
    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [search, totalCount]);

  // Phase 1.5: 엑셀(CSV) 일괄 다운로드
  const handleExportCSV = () => {
    const header = ['이름', '시스템 등록일', '연락처', '이메일'];
    const rows = members.map(m => [ m.name, new Date(m.created_at).toLocaleDateString(), m.phone || '', m.email || '' ]);
    // 한글 깨짐 방지를 위해 BOM(\uFEFF) 추가
    const csvContent = "\uFEFF" + [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `회원명단_추출_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddMember = async () => {
    if (!newName.trim()) return alert("이름을 입력해주세요.");
    if (newPhone.trim()) {
      const { data: dup } = await supabase.from('members').select('id').eq('phone', newPhone.trim()).limit(1);
      if (dup && dup.length > 0) return alert("이미 동일한 연락처로 등록된 회원이 있습니다!");
    }
    const { data, error } = await supabase.from('members').insert([{ name: newName, phone: newPhone, email: newEmail }]).select();
    if (error) { alert("오류 발생: " + error.message); } 
    else if (data) {
      setMembers([data[0], ...members]);
      setTotalCount(prev => prev + 1);
      setIsAdding(false); setNewName(''); setNewPhone(''); setNewEmail('');
    }
  };

  // 상세 모달창 열기
  const openMemberDetail = async (member) => {
    setSelectedMember(member);
    setIsEditing(false);
    setEditName(member.name); setEditPhone(member.phone || ''); setEditEmail(member.email || '');
    const { data } = await supabase.from('completions').select('id, issued_date, cohort, courses(id, name)').eq('member_id', member.id).order('issued_date', { ascending: false });
    setMemberCompletions(data || []);
  };

  const closeMemberDetail = () => {
    setSelectedMember(null);
    setIssueCourseId(''); setIssueDate(''); setIssueCohort('');
  };

  const handleUpdateMember = async () => {
    if (!editName.trim()) return alert("이름을 입력해주세요.");
    if (editPhone.trim() && editPhone !== selectedMember.phone) {
      const { data: dup } = await supabase.from('members').select('id').eq('phone', editPhone.trim()).neq('id', selectedMember.id).limit(1);
      if (dup && dup.length > 0) return alert("이미 동일한 연락처를 사용하는 다른 회원이 있습니다.");
    }
    const { error } = await supabase.from('members').update({ name: editName, phone: editPhone, email: editEmail }).eq('id', selectedMember.id);
    if (!error) {
      setMembers(members.map(m => m.id === selectedMember.id ? { ...m, name: editName, phone: editPhone, email: editEmail } : m));
      setSelectedMember({ ...selectedMember, name: editName, phone: editPhone, email: editEmail });
      setIsEditing(false);
      alert("정보가 성공적으로 수정되었습니다.");
    } else {
      alert("수정 실패: " + error.message);
    }
  };

  const handleDeleteMember = async () => {
    if (window.confirm("🚨 [연쇄 삭제 경고]\n이 회원을 정말 영구 삭제하시겠습니까?\n이 회원이 이수한 모든 수료 및 자격증 기록도 함께 우주 끝으로 날아갑니다!!")) {
      const { error } = await supabase.from('members').delete().eq('id', selectedMember.id);
      if (!error) {
        setMembers(members.filter(m => m.id !== selectedMember.id));
        setTotalCount(prev => Math.max(0, prev - 1));
        closeMemberDetail();
      } else {
        alert("삭제 실패: " + error.message);
      }
    }
  };

  const handleIssueCourse = async () => {
    if (!issueCourseId) return alert("발급할(연결할) 과정을 선택하세요.");
    const payload = { member_id: selectedMember.id, course_id: issueCourseId, issued_date: issueDate || null, cohort: issueCohort || null };
    const { data, error } = await supabase.from('completions').insert([payload]).select('id, issued_date, cohort, courses(id, name)');
    if (!error) {
      setMemberCompletions([data[0], ...memberCompletions]);
      setIssueCourseId(''); setIssueDate(''); setIssueCohort('');
    } else {
      alert("발급 오류: " + error.message);
    }
  };

  const handleDeleteCompletion = async (compId) => {
    if (window.confirm("이 수료 기록만 취소(삭제) 하시겠습니까?")) {
      await supabase.from('completions').delete().eq('id', compId);
      setMemberCompletions(memberCompletions.filter(c => c.id !== compId));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>회원 관리 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({totalCount.toLocaleString()}명)</span></h1>
          <button onClick={() => setIsAdding(!isAdding)} style={{ padding: '6px 12px', backgroundColor: isAdding ? '#ccc' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}>
            {isAdding ? '작성 취소' : '+ 새 회원 등록'}
          </button>
          <button onClick={handleExportCSV} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
            📥 지정 명단 엑셀(CSV) 추출
          </button>
        </div>
        <input 
          type="text" placeholder="데이터베이스 서버 검색..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', width: '250px' }}
        />
      </div>

      {isAdding && (
        <div className="card" style={{ marginBottom: '24px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ marginBottom: '16px' }}>신규 회원 등록</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="text" placeholder="이름 (필수)" value={newName} onChange={e => setNewName(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="text" placeholder="연락처 (중복검사)" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
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
                <tr key={m.id || idx} onClick={() => openMemberDetail(m)} style={{ cursor: 'pointer' }} className="member-row">
                  <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{m.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '방금 전'}</td>
                  <td style={{ color: m.phone ? 'var(--text-main)' : '#ccc' }}>{m.phone || '-'}</td>
                  <td style={{ color: m.email ? 'var(--text-main)' : '#ccc' }}>{m.email || '-'}</td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan="4" style={{textAlign: 'center', padding: '24px'}}>검색 결과가 없습니다.</td></tr>}
            </tbody>
          </table>
        )}
        <style jsx>{`.member-row:hover td { background-color: #f1f8ff; }`}</style>
      </div>

      {/* 회원 상세 & 수료증 수동 발급 관리 모달 */}
      {selectedMember && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '8px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #eee', paddingBottom: '16px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>{selectedMember.name} 님의 기록 상세 <span style={{fontSize: '14px', color:'gray', fontWeight: 'normal'}}>({memberCompletions.length}건 수료)</span></h2>
                <p style={{ color: 'gray', fontSize: '14px' }}>ID: {selectedMember.id}</p>
              </div>
              <button onClick={closeMemberDetail} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✖</button>
            </div>

            {/* 인적사항 수정 폼 */}
            <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', color: '#374151' }}>🔑 기본 인적사항</h3>
                <button onClick={() => setIsEditing(!isEditing)} style={{ background: 'transparent', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                  {isEditing ? '취소' : '수정하기'}
                </button>
              </div>
              
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" style={{ padding: '8px' }} />
                  <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="연락처" style={{ padding: '8px' }} />
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="이메일" style={{ padding: '8px' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button onClick={handleUpdateMember} style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장하기</button>
                    <button onClick={handleDeleteMember} style={{ padding: '10px 20px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}>영구 삭제</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><strong>연락처:</strong> <span style={{color: selectedMember.phone ? 'black' : 'gray'}}>{selectedMember.phone || '없음'}</span></div>
                  <div><strong>이메일:</strong> <span style={{color: selectedMember.email ? 'black' : 'gray'}}>{selectedMember.email || '없음'}</span></div>
                </div>
              )}
            </div>

            {/* 수동 수료증 발급 관제소 */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', color: '#374151', marginBottom: '12px' }}>🎖️ 누적 수료/자격증 취득 내역</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                {memberCompletions.length === 0 ? (
                  <li style={{ padding: '16px', textAlign: 'center', color: 'gray' }}>수료 기록이 없습니다.</li>
                ) : memberCompletions.map(comp => (
                  <li key={comp.id} style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{comp.courses?.name}</div>
                      <div style={{ fontSize: '12px', color: 'gray', marginTop: '4px' }}>
                        발급일: {comp.issued_date || '미상'} | 기수: {comp.cohort || '-'}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteCompletion(comp.id)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid red', color: 'red', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                      발급 취소
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 신규 과정 연결 폼 */}
            <div style={{ backgroundColor: '#e0f2fe', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <h4 style={{ marginBottom: '12px', color: '#0369a1' }}>➕ 신규 과정 이수 등록 (수동 발급)</h4>
              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <select value={issueCourseId} onChange={e => setIssueCourseId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  <option value="">-- 인정할 수료 과정을 선택하세요 --</option>
                  {courses.filter(c => c.is_active !== false).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.category})</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={{ padding: '8px', flex: 1, borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  <input type="text" placeholder="기수 (예: 12기)" value={issueCohort} onChange={e => setIssueCohort(e.target.value)} style={{ padding: '8px', flex: 1, borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  <button onClick={handleIssueCourse} style={{ padding: '8px 16px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>발급 완료</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
