"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';

export default function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // 전체 데이터 백업 (JSON 다운로드)
  const handleBackup = async () => {
    setLoading(true);
    setStatus('데이터를 수집하는 중...');

    try {
      // 모든 테이블을 병렬로 가져오기 (1000건 제한 회피)
      const fetchAll = async (table, select = '*') => {
        const all = [];
        for (let i = 0; ; i += 1000) {
          const { data } = await supabase.from(table).select(select).range(i, i + 999);
          if (!data || data.length === 0) break;
          all.push(...data);
        }
        return all;
      };

      const [members, courses, completions] = await Promise.all([
        fetchAll('members'),
        fetchAll('courses'),
        fetchAll('completions'),
      ]);

      const backup = {
        version: '1.0',
        created_at: new Date().toISOString(),
        data: { members, courses, completions },
        counts: {
          members: members.length,
          courses: courses.length,
          completions: completions.length,
        }
      };

      // JSON 파일 다운로드
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ICTI-MIS_백업_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logActivity({ action: 'backup', targetType: 'member', targetName: '전체 백업', details: `회원 ${members.length}명, 과정 ${courses.length}개, 수료 ${completions.length}건` });

      setStatus(`백업 완료! 회원 ${members.length}명, 과정 ${courses.length}개, 수료 ${completions.length}건`);
    } catch (e) {
      setStatus('백업 실패: ' + e.message);
    }
    setLoading(false);
  };

  // 백업 파일에서 복원
  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('⚠️ 주의: 백업 파일로 복원하면 기존 데이터가 백업 시점으로 되돌아갑니다.\n\n정말 복원하시겠습니까?')) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    setStatus('백업 파일을 읽는 중...');

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.data) {
        throw new Error('유효하지 않은 백업 파일입니다.');
      }

      const { members, courses, completions } = backup.data;
      setStatus(`백업 파일 확인: 회원 ${members?.length || 0}명, 과정 ${courses?.length || 0}개, 수료 ${completions?.length || 0}건\n복원 중...`);

      // 1. 기존 completions 삭제 (FK 제약 때문에 먼저)
      await supabase.from('completions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 2. 기존 members 삭제
      await supabase.from('members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 3. 기존 courses 삭제
      await supabase.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 4. courses 복원
      if (courses?.length > 0) {
        for (let i = 0; i < courses.length; i += 500) {
          await supabase.from('courses').insert(courses.slice(i, i + 500));
        }
      }
      // 5. members 복원
      if (members?.length > 0) {
        for (let i = 0; i < members.length; i += 500) {
          await supabase.from('members').insert(members.slice(i, i + 500));
        }
      }
      // 6. completions 복원
      if (completions?.length > 0) {
        for (let i = 0; i < completions.length; i += 500) {
          await supabase.from('completions').insert(completions.slice(i, i + 500));
        }
      }

      logActivity({ action: 'backup', targetType: 'member', targetName: '데이터 복원', details: `백업 시점: ${backup.created_at}, 회원 ${members?.length}명 복원` });

      setStatus(`복원 완료! 회원 ${members?.length || 0}명, 과정 ${courses?.length || 0}개, 수료 ${completions?.length || 0}건`);
    } catch (err) {
      setStatus('복원 실패: ' + err.message);
    }
    setLoading(false);
    e.target.value = '';
  };

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>데이터 백업 / 복원</h1>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* 백업 카드 */}
        <div className="card" style={{ flex: 1, borderLeft: '4px solid #4A90E2' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--secondary)', marginBottom: '16px' }}>전체 데이터 백업</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
            회원, 과정, 수료 기록을 JSON 파일로 내보냅니다.<br/>
            정기적으로 백업해두면 실수로 삭제한 데이터를 복구할 수 있습니다.
          </p>
          <button onClick={handleBackup} disabled={loading}
            style={{ padding: '12px 32px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'wait' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
            {loading ? '처리 중...' : '📦 지금 백업하기'}
          </button>
        </div>

        {/* 복원 카드 */}
        <div className="card" style={{ flex: 1, borderLeft: '4px solid #F97316' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--secondary)', marginBottom: '16px' }}>백업에서 복원</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
            이전에 내보낸 JSON 백업 파일을 업로드하여 데이터를 복원합니다.<br/>
            <strong style={{ color: '#dc2626' }}>주의: 현재 데이터가 백업 시점으로 대체됩니다!</strong>
          </p>
          <label style={{ padding: '12px 32px', backgroundColor: '#F97316', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'wait' : 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'inline-block' }}>
            📂 백업 파일 선택
            <input type="file" accept=".json" onChange={handleRestore} disabled={loading} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* 상태 메시지 */}
      {status && (
        <div className="card" style={{ marginTop: '24px', backgroundColor: '#f8fafc', whiteSpace: 'pre-line' }}>
          <p style={{ fontSize: '14px' }}>{status}</p>
        </div>
      )}

      {/* 안내 */}
      <div className="card" style={{ marginTop: '24px', backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
        <h3 style={{ fontSize: '16px', color: '#92400e', marginBottom: '8px' }}>백업 가이드</h3>
        <ul style={{ fontSize: '14px', color: '#78350f', lineHeight: '1.8', paddingLeft: '20px' }}>
          <li>주 1회 이상 정기 백업을 권장합니다</li>
          <li>대량 삭제/수정 작업 전에 반드시 백업해두세요</li>
          <li>백업 파일은 안전한 곳에 보관하세요 (개인 PC, 클라우드 드라이브 등)</li>
          <li>복원 시 현재 데이터가 완전히 대체되므로 신중하게 사용하세요</li>
        </ul>
      </div>
    </div>
  );
}
