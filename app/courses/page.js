"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';

export default function CoursesPage() {
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [courses, setCourses] = useState([]);
  const [courseStats, setCourseStats] = useState({}); // { course_id: { count, lastIssued } }
  const [loading, setLoading] = useState(true);

  // 신규 과정 등록 폼
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('수료증');
  const [newDesc, setNewDesc] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // 과정 수정 상태
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editHours, setEditHours] = useState(0);
  const [editPrice, setEditPrice] = useState(0);

  useEffect(() => {
    async function load() {
      // 과정 목록 + 수료 통계를 병렬로 조회
      // Supabase 기본 1,000건 제한 회피를 위해 릴레이 패치
      const [{ data: coursesData }, ...completionBatches] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: true }),
        ...[0, 1000, 2000, 3000, 4000, 5000, 6000].map(offset =>
          supabase.from('completions').select('course_id, issued_date').range(offset, offset + 999)
        ),
      ]);

      const completionsData = completionBatches.flatMap(b => b.data || []);
      setCourses(coursesData || []);

      // 과정별 수료자 수 및 최근 발급일 계산
      const stats = {};
      (completionsData || []).forEach(c => {
        if (!stats[c.course_id]) stats[c.course_id] = { count: 0, lastIssued: null };
        stats[c.course_id].count++;
        if (c.issued_date && (!stats[c.course_id].lastIssued || c.issued_date > stats[c.course_id].lastIssued)) {
          stats[c.course_id].lastIssued = c.issued_date;
        }
      });
      setCourseStats(stats);
      setLoading(false);
    }
    load();
  }, []);

  const handleAddCourse = async () => {
    if (!newName.trim()) return toast.warning("과정명을 입력해주세요.");
    const { data, error } = await supabase.from('courses').insert([{ name: newName, category: newCat, description: newDesc, hours: Number(newHours) || 0, price: Number(newPrice) || 0, is_active: true }]).select();
    if (error) {
      if (error.message.includes('column "is_active"')) {
        toast.error("DB에 is_active 컬럼이 없습니다. SQL을 실행해주세요.");
      } else {
        toast.error("오류: " + error.message);
      }
    } else if (data) {
      logActivity({ action: 'create', targetType: 'course', targetId: data[0].id, targetName: newName, details: `신규 과정 등록 (${newCat})` });
      setCourses([...courses, data[0]]);
      setIsAdding(false);
      setNewName(''); setNewDesc(''); setNewCat('수료증'); setNewHours(''); setNewPrice('');
    }
  };

  const handleToggleActive = async (course) => {
    const newState = course.is_active === false ? true : false;
    const actionTxt = newState ? '다시 운영(숨김 해제)' : '운영 종료(숨김 처리)';

    setConfirmDialog({
      title: actionTxt, message: `이 과정을 [${actionTxt}] 상태로 변경하시겠습니까?\n숨김 처리해도 기존 수료 내역은 삭제되지 않습니다.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from('courses').update({ is_active: newState }).eq('id', course.id);
        if (error) {
          toast.error("업데이트 실패: " + error.message);
        } else {
          logActivity({ action: 'hide', targetType: 'course', targetId: course.id, targetName: course.name, details: actionTxt });
          setCourses(courses.map(c => c.id === course.id ? { ...c, is_active: newState } : c));
        }
      },
    });
  };

  // 과정 영구 삭제 (연쇄 삭제 경고)
  const handleDeleteCourse = async (course) => {
    const stat = courseStats[course.id] || { count: 0 };
    const msg = stat.count > 0
      ? `🚨 [연쇄 삭제 경고]\n"${course.name}" 과정을 영구 삭제하시겠습니까?\n\n이 과정에 연결된 수료 기록 ${stat.count}건도 함께 삭제됩니다!\n\n💡 삭제 대신 [숨김]을 사용하면 기록을 보존할 수 있습니다.`
      : `"${course.name}" 과정을 영구 삭제하시겠습니까?`;

    setConfirmDialog({
      title: '과정 영구 삭제', message: msg, danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from('courses').delete().eq('id', course.id);
        if (!error) {
          logActivity({ action: 'delete', targetType: 'course', targetId: course.id, targetName: course.name, details: `과정 영구 삭제 (수료 ${stat.count}건 연쇄 삭제)` });
          setCourses(courses.filter(c => c.id !== course.id));
        } else {
          toast.error("삭제 실패: " + error.message);
        }
      },
    });
  };

  // 과정 수정 시작
  const startEdit = (course) => {
    setEditingId(course.id);
    setEditName(course.name);
    setEditCat(course.category);
    setEditDesc(course.description || '');
    setEditHours(course.hours || 0);
    setEditPrice(course.price || 0);
  };

  // 과정 수정 저장
  const handleSaveEdit = async (courseId) => {
    if (!editName.trim()) return toast.warning("과정명을 입력해주세요.");
    const { error } = await supabase.from('courses')
      .update({ name: editName, category: editCat, description: editDesc, hours: editHours || 0, price: editPrice || 0 })
      .eq('id', courseId);
    if (error) {
      toast.error("수정 실패: " + error.message);
    } else {
      const oldCourse = courses.find(c => c.id === courseId);
      logActivity({ action: 'update', targetType: 'course', targetId: courseId, targetName: editName, details: `과정명: ${oldCourse?.name}→${editName}` });
      setCourses(courses.map(c => c.id === courseId ? { ...c, name: editName, category: editCat, description: editDesc, hours: editHours, price: editPrice } : c));
      setEditingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>코칭 과정 관리 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({courses.length}개)</span></h1>
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
            <input type="number" placeholder="시간 (h)" value={newHours} onChange={e => setNewHours(e.target.value)} style={{ padding: '8px', width: '80px', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="number" placeholder="참가비 (원)" value={newPrice} onChange={e => setNewPrice(e.target.value)} style={{ padding: '8px', width: '120px', border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="text" placeholder="간단한 설명" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ padding: '8px', flex: 2, border: '1px solid #ccc', borderRadius: '4px' }} />
            <button onClick={handleAddCourse} style={{ padding: '8px 24px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>명단에 추가</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <LoadingSpinner /> : (
          <table>
            <thead>
              <tr>
                <th>상태</th>
                <th>과정명</th>
                <th>분류</th>
                <th style={{ textAlign: 'center' }}>시간</th>
                <th style={{ textAlign: 'right' }}>참가비</th>
                <th>설명</th>
                <th style={{ textAlign: 'center' }}>수료자</th>
                <th>최근 발급일</th>
                <th>설정</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c, idx) => {
                const stat = courseStats[c.id] || { count: 0, lastIssued: null };
                const isEditing = editingId === c.id;

                return (
                  <tr key={c.id || idx} style={{ opacity: c.is_active === false ? 0.5 : 1, transition: '0.2s' }}>
                    <td>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.is_active === false ? 'gray' : 'var(--success)' }}></span>
                      <span style={{ marginLeft: '8px', fontSize: '13px', color: c.is_active === false ? 'gray' : 'var(--text-main)' }}>
                        {c.is_active === false ? '종료' : '운영중'}
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                          style={{ padding: '4px 8px', border: '1px solid #4A90E2', borderRadius: '4px', width: '100%', fontWeight: 'bold' }} />
                      ) : (
                        <span style={{ fontWeight: 'bold', textDecoration: c.is_active === false ? 'line-through' : 'none' }}>{c.name}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={editCat} onChange={e => setEditCat(e.target.value)} style={{ padding: '4px', border: '1px solid #4A90E2', borderRadius: '4px' }}>
                          <option value="수료증">수료증</option>
                          <option value="자격증">자격증</option>
                        </select>
                      ) : (
                        <span className={c.category === '자격증' ? 'badge success' : 'badge'}>{c.category}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isEditing ? (
                        <input type="number" value={editHours} onChange={e => setEditHours(Number(e.target.value))}
                          style={{ padding: '4px', border: '1px solid #4A90E2', borderRadius: '4px', width: '60px', textAlign: 'center' }} />
                      ) : (
                        <span>{c.hours ? c.hours + 'h' : '-'}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <input type="number" value={editPrice} onChange={e => setEditPrice(Number(e.target.value))}
                          style={{ padding: '4px', border: '1px solid #4A90E2', borderRadius: '4px', width: '100px', textAlign: 'right' }} />
                      ) : (
                        <span style={{ color: c.price ? 'var(--text-main)' : '#ccc' }}>{c.price ? c.price.toLocaleString() + '원' : '-'}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                          style={{ padding: '4px 8px', border: '1px solid #4A90E2', borderRadius: '4px', width: '100%' }} />
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{c.description || '-'}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: stat.count > 0 ? 'var(--primary)' : '#ccc' }}>
                      {stat.count > 0 ? stat.count.toLocaleString() + '명' : '-'}
                    </td>
                    <td style={{ color: stat.lastIssued ? 'var(--text-main)' : '#ccc', fontSize: '13px' }}>
                      {stat.lastIssued || '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveEdit(c.id)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'var(--primary)', color: '#fff' }}>
                              저장
                            </button>
                            <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(c)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                              ✏️ 수정
                            </button>
                            <button onClick={() => handleToggleActive(c)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                              {c.is_active === false ? '👁️ 해제' : '🙈 숨김'}
                            </button>
                            <button onClick={() => handleDeleteCourse(c)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fff', color: '#dc2626', opacity: 0.5 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {courses.length === 0 && <tr><td colSpan="9"><EmptyState icon="📚" title="등록된 과정이 없습니다" /></td></tr>}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
          * [숨김]을 눌러도 기존 수료 내역은 날아가지 않습니다. 단순히 새로운 회원에게 수동 발급할 때 선택지에서 사라집니다.
        </p>
      </div>
      {confirmDialog && (
        <ConfirmDialog title={confirmDialog.title} message={confirmDialog.message} danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />
      )}
    </div>
  );
}
