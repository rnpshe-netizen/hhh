"use client";
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';

export default function MessagesPage() {
  const [step, setStep] = useState(1); // 1: 채널선택, 2: 수신자, 3: 내용작성, 4: 확인/발송
  const [courses, setCourses] = useState([]);

  // 발송 설정
  const [channel, setChannel] = useState(''); // kakao | sms | email
  const [targetType, setTargetType] = useState('all'); // all | course | custom
  const [targetCourseId, setTargetCourseId] = useState('');
  const [targetMembers, setTargetMembers] = useState([]); // 최종 수신자 목록
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // 템플릿
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // 발송 상태
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // 캠페인 이력
  const [campaigns, setCampaigns] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.from('courses').select('id, name').order('created_at').then(({ data }) => setCourses(data || []));
    supabase.from('message_templates').select('*').order('created_at', { ascending: false }).then(({ data }) => setTemplates(data || []));
    supabase.from('message_campaigns').select('*').order('created_at', { ascending: false }).limit(20).then(({ data }) => setCampaigns(data || []));
  }, []);

  // 수신자 조회
  const fetchTargetMembers = useCallback(async () => {
    let query = supabase.from('members').select('id, name, phone, email')
      .or('is_active.is.null,is_active.eq.true');

    if (targetType === 'course' && targetCourseId) {
      const { data: compRows } = await supabase.from('completions').select('member_id').eq('course_id', targetCourseId);
      const memberIds = [...new Set((compRows || []).map(r => r.member_id))];
      if (memberIds.length === 0) { setTargetMembers([]); return; }
      // 500개씩 나누어 쿼리 (URL 길이 제한 회피)
      let allMembers = [];
      for (let i = 0; i < memberIds.length; i += 200) {
        const chunk = memberIds.slice(i, i + 200);
        const { data } = await supabase.from('members').select('id, name, phone, email')
          .or('is_active.is.null,is_active.eq.true')
          .in('id', chunk);
        allMembers = allMembers.concat(data || []);
      }
      setTargetMembers(allMembers);
      return;
    }

    // 전체 회원 (1000건씩 릴레이)
    let all = [];
    let offset = 0;
    while (true) {
      const { data } = await query.range(offset, offset + 999);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      offset += 1000;
    }
    setTargetMembers(all);
  }, [targetType, targetCourseId]);

  // 채널별 발송 가능 인원 계산
  const sendableCount = targetMembers.filter(m => {
    if (channel === 'email') return m.email;
    if (channel === 'sms' || channel === 'kakao') return m.phone;
    return false;
  }).length;

  // 발송 실행
  const handleSend = async () => {
    if (!channel || !body.trim()) return alert("채널과 내용을 입력해주세요.");
    if (sendableCount === 0) return alert("발송 가능한 수신자가 없습니다.");

    if (!window.confirm(`${channelLabel(channel)}로 ${sendableCount}명에게 발송하시겠습니까?`)) return;

    setSending(true);

    const sendable = targetMembers.filter(m => {
      if (channel === 'email') return m.email;
      if (channel === 'sms' || channel === 'kakao') return m.phone;
      return false;
    });

    // 캠페인 생성
    const { data: campaign, error: campError } = await supabase.from('message_campaigns').insert([{
      title: subject || `${channelLabel(channel)} 발송`,
      channel,
      subject: subject || null,
      body,
      target_filter: { type: targetType, courseId: targetCourseId || null },
      total_count: sendable.length,
      status: 'sending',
    }]).select().single();

    if (campError) {
      alert("캠페인 생성 실패: " + campError.message);
      setSending(false);
      return;
    }

    // 실제 발송 API 호출
    const recipients = sendable.map(m => ({
      phone: m.phone,
      email: m.email,
      name: m.name,
    }));

    let apiResult = { totalSuccess: 0, totalFail: sendable.length };
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, recipients, subject, body }),
      });
      const data = await res.json();
      if (data.success) {
        apiResult = { totalSuccess: data.totalSuccess, totalFail: data.totalFail };
      } else {
        // API 키 미설정 등 에러 시 기록만 저장 (발송은 실패 처리)
        console.log('발송 API 에러:', data.error);
      }
    } catch (err) {
      console.log('발송 API 호출 실패:', err.message);
    }

    // 개별 발송 기록 DB 저장
    const logs = sendable.map(m => ({
      campaign_id: campaign.id,
      member_id: m.id,
      member_name: m.name,
      channel,
      recipient: channel === 'email' ? m.email : m.phone,
      status: apiResult.totalSuccess > 0 ? 'sent' : 'pending',
    }));

    let successCount = 0;
    for (let i = 0; i < logs.length; i += 500) {
      const chunk = logs.slice(i, i + 500);
      const { error } = await supabase.from('message_logs').insert(chunk);
      if (!error) successCount += chunk.length;
    }
    successCount = apiResult.totalSuccess || successCount;

    // 캠페인 상태 업데이트
    await supabase.from('message_campaigns').update({
      status: 'completed',
      success_count: successCount,
      fail_count: sendable.length - successCount,
      sent_at: new Date().toISOString(),
    }).eq('id', campaign.id);

    logActivity({
      action: 'create',
      targetType: 'message',
      targetId: campaign.id,
      targetName: subject || channelLabel(channel),
      details: `${channelLabel(channel)} ${successCount}/${sendable.length}건 발송`,
    });

    setResult({ total: sendable.length, success: successCount, fail: sendable.length - successCount });
    setSending(false);

    // 캠페인 목록 새로고침
    const { data: newCampaigns } = await supabase.from('message_campaigns').select('*').order('created_at', { ascending: false }).limit(20);
    setCampaigns(newCampaigns || []);
  };

  // 템플릿 저장
  const handleSaveTemplate = async () => {
    const name = prompt("템플릿 이름을 입력하세요:");
    if (!name) return;
    const { data, error } = await supabase.from('message_templates').insert([{
      name, channel: channel || 'all', subject, body
    }]).select();
    if (!error && data) {
      setTemplates([data[0], ...templates]);
      alert("템플릿이 저장되었습니다.");
    }
  };

  // 템플릿 불러오기
  const loadTemplate = (t) => {
    setSubject(t.subject || '');
    setBody(t.body);
    if (t.channel !== 'all') setChannel(t.channel);
    setShowTemplates(false);
  };

  const channelLabel = (ch) => {
    if (ch === 'kakao') return '카카오 알림톡';
    if (ch === 'sms') return 'SMS 문자';
    if (ch === 'email') return '이메일';
    return ch;
  };

  const channelColor = (ch) => {
    if (ch === 'kakao') return '#FEE500';
    if (ch === 'sms') return '#4A90E2';
    if (ch === 'email') return '#27AE60';
    return '#ccc';
  };

  // 리셋
  const handleReset = () => {
    setStep(1); setChannel(''); setTargetType('all'); setTargetCourseId('');
    setTargetMembers([]); setSubject(''); setBody(''); setResult(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>메시지 발송</h1>
        <button onClick={() => setShowHistory(!showHistory)}
          style={{ padding: '8px 16px', backgroundColor: showHistory ? '#ccc' : '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
          {showHistory ? '발송 화면' : '📋 발송 이력'}
        </button>
      </div>

      {showHistory ? (
        /* 발송 이력 */
        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>발송 이력</h2>
          <table>
            <thead>
              <tr>
                <th>제목</th>
                <th>채널</th>
                <th>대상</th>
                <th>성공/실패</th>
                <th>상태</th>
                <th>발송일</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.title}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                      backgroundColor: channelColor(c.channel) + '30', color: c.channel === 'kakao' ? '#3C1E1E' : channelColor(c.channel) }}>
                      {channelLabel(c.channel)}
                    </span>
                  </td>
                  <td>{c.total_count}명</td>
                  <td>
                    <span style={{ color: '#16a34a' }}>{c.success_count}</span> / <span style={{ color: '#dc2626' }}>{c.fail_count}</span>
                  </td>
                  <td>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '12px',
                      backgroundColor: c.status === 'completed' ? '#dcfce7' : c.status === 'sending' ? '#fef9c3' : '#f3f4f6',
                      color: c.status === 'completed' ? '#16a34a' : c.status === 'sending' ? '#ca8a04' : '#6b7280' }}>
                      {c.status === 'completed' ? '완료' : c.status === 'sending' ? '발송중' : c.status === 'draft' ? '초안' : c.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: '#6b7280' }}>{c.sent_at ? new Date(c.sent_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>발송 이력이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : result ? (
        /* 발송 결과 */
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>발송 완료!</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '24px' }}>
            <div><span style={{ fontSize: '36px', fontWeight: 'bold', color: '#16a34a' }}>{result.success}</span><p style={{ color: '#6b7280' }}>성공</p></div>
            <div><span style={{ fontSize: '36px', fontWeight: 'bold', color: '#dc2626' }}>{result.fail}</span><p style={{ color: '#6b7280' }}>실패</p></div>
            <div><span style={{ fontSize: '36px', fontWeight: 'bold' }}>{result.total}</span><p style={{ color: '#6b7280' }}>전체</p></div>
          </div>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
            실제 발송은 API 연동 후 작동합니다. 현재는 발송 기록만 저장됩니다.
          </p>
          <button onClick={handleReset} style={{ padding: '12px 32px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
            새 메시지 작성
          </button>
        </div>
      ) : (
        /* 메시지 작성 위저드 */
        <div>
          {/* 단계 표시 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {['채널 선택', '수신자 설정', '내용 작성', '확인 및 발송'].map((label, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px', textAlign: 'center', borderRadius: '8px', fontSize: '14px', fontWeight: step === i + 1 ? 'bold' : 'normal',
                backgroundColor: step === i + 1 ? 'var(--primary)' : step > i + 1 ? '#dcfce7' : '#f3f4f6',
                color: step === i + 1 ? '#fff' : step > i + 1 ? '#16a34a' : '#9ca3af',
              }}>
                {step > i + 1 ? '✓ ' : ''}{label}
              </div>
            ))}
          </div>

          {/* Step 1: 채널 선택 */}
          {step === 1 && (
            <div className="card">
              <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>발송 채널을 선택하세요</h2>
              <div style={{ display: 'flex', gap: '16px' }}>
                {[
                  { id: 'kakao', label: '카카오 알림톡', desc: '카카오톡으로 알림 메시지 발송', color: '#FEE500', textColor: '#3C1E1E' },
                  { id: 'sms', label: 'SMS 문자', desc: '휴대폰 문자 메시지 발송', color: '#4A90E2', textColor: '#fff' },
                  { id: 'email', label: '이메일', desc: '이메일 발송', color: '#27AE60', textColor: '#fff' },
                ].map(ch => (
                  <div key={ch.id} onClick={() => { setChannel(ch.id); setStep(2); }}
                    style={{
                      flex: 1, padding: '24px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                      border: channel === ch.id ? `3px solid ${ch.color}` : '2px solid #e5e7eb',
                      backgroundColor: channel === ch.id ? ch.color + '20' : '#fff',
                      transition: '0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>{ch.id === 'kakao' ? '💬' : ch.id === 'sms' ? '📱' : '📧'}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>{ch.label}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>{ch.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: 수신자 설정 */}
          {step === 2 && (
            <div className="card">
              <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>수신자를 설정하세요</h2>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <select value={targetType} onChange={e => { setTargetType(e.target.value); setTargetCourseId(''); }}
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
                  <option value="all">전체 회원</option>
                  <option value="course">특정 과정 수료자</option>
                </select>
                {targetType === 'course' && (
                  <select value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
                    <option value="">과정을 선택하세요</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <button onClick={fetchTargetMembers}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  수신자 조회
                </button>
              </div>
              {targetMembers.length > 0 && (
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>조회 결과: {targetMembers.length}명</p>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>
                    {channel === 'email' ? '이메일' : '전화번호'} 보유: <strong style={{ color: 'var(--primary)' }}>{sendableCount}명</strong> 발송 가능
                    {targetMembers.length - sendableCount > 0 && (
                      <span style={{ color: '#dc2626' }}> / {targetMembers.length - sendableCount}명 연락처 없음</span>
                    )}
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>← 이전</button>
                <button onClick={() => { if (sendableCount === 0) { alert("먼저 수신자를 조회하세요."); return; } setStep(3); }}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  다음 →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 내용 작성 */}
          {step === 3 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>메시지 내용을 작성하세요</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowTemplates(!showTemplates)}
                    style={{ padding: '6px 12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                    📋 템플릿 {showTemplates ? '닫기' : '불러오기'}
                  </button>
                  <button onClick={handleSaveTemplate}
                    style={{ padding: '6px 12px', backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#0369a1' }}>
                    💾 현재 내용 저장
                  </button>
                </div>
              </div>
              {showTemplates && templates.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {templates.map(t => (
                    <div key={t.id} onClick={() => loadTemplate(t)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #e5e7eb', fontSize: '14px' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <strong>{t.name}</strong> <span style={{ color: '#9ca3af', fontSize: '12px' }}>({channelLabel(t.channel)})</span>
                    </div>
                  ))}
                </div>
              )}
              {channel === 'email' && (
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="이메일 제목"
                  style={{ width: '100%', padding: '10px', marginBottom: '12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
              )}
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder={channel === 'kakao' ? '카카오 알림톡 내용을 입력하세요...\n\n예: [국제코칭훈련원]\n#{이름}님, 축하합니다!\nTRAIN 기초 과정을 수료하셨습니다.' :
                  channel === 'sms' ? 'SMS 문자 내용을 입력하세요 (90바이트 이내 단문, 초과 시 장문)...' :
                  '이메일 본문을 입력하세요...'}
                rows={8}
                style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                {body.length}자 / {channel === 'sms' ? (new TextEncoder().encode(body).length > 90 ? 'LMS (장문)' : 'SMS (단문)') : ''}
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '16px' }}>
                <button onClick={() => setStep(2)} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>← 이전</button>
                <button onClick={() => { if (!body.trim()) { alert("내용을 입력하세요."); return; } setStep(4); }}
                  style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  다음 →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: 확인 및 발송 */}
          {step === 4 && (
            <div className="card">
              <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>발송 내용을 확인하세요</h2>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={{ padding: '8px 0', fontWeight: 'bold', width: '120px', color: '#6b7280' }}>발송 채널</td>
                      <td><span style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold',
                        backgroundColor: channelColor(channel) + '30' }}>{channelLabel(channel)}</span></td></tr>
                    <tr><td style={{ padding: '8px 0', fontWeight: 'bold', color: '#6b7280' }}>수신자</td>
                      <td><strong>{sendableCount}명</strong> ({targetType === 'all' ? '전체 회원' : '과정 수료자'})</td></tr>
                    {subject && <tr><td style={{ padding: '8px 0', fontWeight: 'bold', color: '#6b7280' }}>제목</td><td>{subject}</td></tr>}
                    <tr><td style={{ padding: '8px 0', fontWeight: 'bold', color: '#6b7280', verticalAlign: 'top' }}>내용</td>
                      <td><pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', margin: 0, backgroundColor: '#fff', padding: '12px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>{body}</pre></td></tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '13px', color: '#F97316', marginBottom: '16px', padding: '8px 12px', backgroundColor: '#FFF7ED', borderRadius: '4px' }}>
                ⚠️ 현재는 발송 기록만 저장됩니다. 실제 카카오/SMS/이메일 API 연동은 별도 설정이 필요합니다.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(3)} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>← 이전</button>
                <button onClick={handleSend} disabled={sending}
                  style={{ padding: '12px 32px', backgroundColor: sending ? '#ccc' : '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: sending ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                  {sending ? '발송 중...' : `🚀 ${sendableCount}명에게 발송`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
