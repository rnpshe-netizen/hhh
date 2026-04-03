"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logActivity } from '../../lib/activityLog';
import { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';

const PAGE_SIZE = 50;

export default function MembersPage() {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 정렬 상태
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // 필터 상태
  const [contactFilter, setContactFilter] = useState('all'); // all | has | none
  const [rankFilter, setRankFilter] = useState('all'); // all | 1 | 2 | 3 | none
  const [courseFilter, setCourseFilter] = useState(new Map()); // 빈 Map = 전체, Map<courseId, cohort문자열>
  const [courseDropOpen, setCourseDropOpen] = useState(false);
  const [courseCohorts, setCourseCohorts] = useState({}); // { courseId: ['1기', '2기', ...] }
  const [cohortSearches, setCohortSearches] = useState({}); // { courseId: '검색어' }
  const [cohortDropOpenId, setCohortDropOpenId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm, danger }
  const courseDropRef = useRef(null);

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 신규 회원 등록 폼
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Phase 1.5: 회원 상세 / 수정 / 삭제 상태
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberCompletions, setMemberCompletions] = useState([]);
  const [memberEnrollments, setMemberEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCurrentCert, setEditCurrentCert] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // Phase 1.5: 수동 수료(발급) 연결 폼 상태
  const [issueCourseId, setIssueCourseId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [issueCohort, setIssueCohort] = useState('');

  // Phase 2A: 매칭 순위 조회용 맵 (이름 → 순위 정보)
  const [matchRankMap, setMatchRankMap] = useState({});
  const [rankNames, setRankNames] = useState({ 1: [], 2: [], 3: [] });

  // 과정 체크박스 드롭다운 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e) => {
      if (courseDropRef.current && !courseDropRef.current.contains(e.target)) setCourseDropOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    supabase.from('courses').select('*').order('created_at').then(({ data }) => setCourses(data || []));
    // 과정별 기수 목록 조회 (검색 드롭다운용)
    supabase.from('completions').select('course_id, cohort').not('cohort', 'is', null).then(({ data }) => {
      const map = {};
      (data || []).forEach(row => {
        if (!row.cohort) return;
        if (!map[row.course_id]) map[row.course_id] = new Set();
        // "10" → "10기", "10기" → "10기" 로 통일
        const normalized = String(row.cohort).replace(/기$/, '').trim() + '기';
        map[row.course_id].add(normalized);
      });
      const result = {};
      for (const [courseId, cohortSet] of Object.entries(map)) {
        result[courseId] = [...cohortSet].sort((a, b) => {
          const numA = parseInt(a) || 0;
          const numB = parseInt(b) || 0;
          return numA - numB;
        });
      }
      setCourseCohorts(result);
    });
    // matching_report.json에서 순위 맵 구성
    fetch('/matching_report.json')
      .then(r => r.json())
      .then(report => {
        const map = {};
        const names = { 1: [], 2: [], 3: [] };
        (report.exactMatch || []).forEach(name => { map[name] = { rank: 1, label: '1순위 완벽일치', color: '#16a34a', bg: '#dcfce7' }; names[1].push(name); });
        (report.courseMatch || []).forEach(name => { if (!map[name]) { map[name] = { rank: 2, label: '2순위 과정일치', color: '#ca8a04', bg: '#fef9c3' }; names[2].push(name); } });
        (report.nameOnlyMatch || []).forEach(name => { if (!map[name]) { map[name] = { rank: 3, label: '3순위 이름만일치', color: '#dc2626', bg: '#fee2e2' }; names[3].push(name); } });
        setMatchRankMap(map);
        setRankNames(names);
      })
      .catch(() => {});
  }, []);

  // 회원 목록 조회 (페이지네이션 + 검색 + 정렬 + 필터)
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from('members').select('*', { count: 'exact' });

    // 숨김 회원 제외 (is_active가 false인 회원은 기본적으로 목록에서 제외)
    query = query.or('is_active.is.null,is_active.eq.true');

    // 검색 (이름 + 연락처 + 이메일) — 하이픈 없이 번호 입력해도 검색 가능
    if (search.trim()) {
      const s = search.trim();
      const digitsOnly = s.replace(/[^0-9]/g, '');
      // 숫자만 포함된 검색어 → 하이픈 자동 삽입해서 부분 검색 지원
      // 예: "0104809" → "010-4809%" 로 DB의 "010-4809-9978" 매칭
      if (digitsOnly.length >= 3 && digitsOnly === s.replace(/[-\s]/g, '')) {
        let withHyphen = digitsOnly;
        if (digitsOnly.length <= 3) {
          withHyphen = digitsOnly;
        } else if (digitsOnly.length <= 7) {
          withHyphen = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3);
        } else {
          withHyphen = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3, 7) + '-' + digitsOnly.slice(7);
        }
        query = query.or(`name.ilike.%${s}%,phone.ilike.%${withHyphen}%,phone.ilike.%${digitsOnly}%,email.ilike.%${s}%`);
      } else {
        query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
      }
    }

    // 연락처 유무 필터
    if (contactFilter === 'has') {
      query = query.not('phone', 'is', null).neq('phone', '');
    } else if (contactFilter === 'none') {
      query = query.or('phone.is.null,phone.eq.');
    }

    // 수료 과정+기수 필터 — completions inner join
    if (courseFilter.size > 0) {
      const courseIds = [...courseFilter.keys()];
      const cohortFilters = [...courseFilter.entries()].filter(([_, cohort]) => cohort.trim());

      // 기수 필터가 있으면 해당 cohort도 inner join 조건에 포함
      if (cohortFilters.length === 1 && courseIds.length === 1) {
        // 단일 과정+기수: 정확한 cohort 매칭 (숫자만 또는 "기" 포함 모두)
        const cohortVal = cohortFilters[0][1].replace(/기$/, '').trim();
        query = supabase.from('members')
          .select('*, completions!inner(course_id, cohort)', { count: 'exact' })
          .in('completions.course_id', courseIds)
          .or(`completions.cohort.eq.${cohortVal},completions.cohort.eq.${cohortVal}기`);
      } else {
        // 다중 과정 또는 기수 없음: 과정 ID만 필터
        query = supabase.from('members')
          .select('*, completions!inner(course_id, cohort)', { count: 'exact' })
          .in('completions.course_id', courseIds);
      }

      // 기존 필터 재적용 (검색, 연락처)
      if (search.trim()) {
        const s = search.trim();
        const digitsOnly = s.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 3 && digitsOnly === s.replace(/[-\s]/g, '')) {
          let withHyphen = digitsOnly;
          if (digitsOnly.length <= 3) withHyphen = digitsOnly;
          else if (digitsOnly.length <= 7) withHyphen = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3);
          else withHyphen = digitsOnly.slice(0, 3) + '-' + digitsOnly.slice(3, 7) + '-' + digitsOnly.slice(7);
          query = query.or(`name.ilike.%${s}%,phone.ilike.%${withHyphen}%,phone.ilike.%${digitsOnly}%,email.ilike.%${s}%`);
        } else {
          query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
        }
      }
      if (contactFilter === 'has') {
        query = query.not('phone', 'is', null).neq('phone', '');
      } else if (contactFilter === 'none') {
        query = query.or('phone.is.null,phone.eq.');
      }

      query = query.order(sortField, { ascending: sortAsc }).range(from, to);
      const { data, count } = await query;
      // completions 필드 제거 + 중복 회원 제거 + 다중 기수 클라이언트 필터
      const seen = new Set();
      let filteredData = (data || []);

      // 다중 과정+기수 혼합 시 클라이언트에서 추가 필터링
      if (cohortFilters.length > 0 && (courseIds.length > 1 || cohortFilters.length > 1)) {
        filteredData = filteredData.filter(m => {
          const comps = m.completions || [];
          return comps.some(comp => {
            const selectedCohort = courseFilter.get(comp.course_id);
            if (!selectedCohort) return true; // 기수 미지정 과정
            const cohortNum = selectedCohort.replace(/기$/, '').trim();
            const compCohort = String(comp.cohort || '').replace(/기$/, '').trim();
            return compCohort === cohortNum;
          });
        });
      }

      const uniqueMembers = filteredData.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }).map(({ completions, ...rest }) => rest);
      setMembers(uniqueMembers);
      setTotalCount(count || 0);
      setSelectedIds(new Set());
      setLoading(false);
      return;
    }

    // 매칭 순위 필터 (해당 순위 이름 목록으로 in 쿼리)
    if (rankFilter === 'none') {
      // 순위 없음: 전체 가져와서 클라이언트 필터 (페이지네이션 직접 처리)
      const allRankedSet = new Set([...(rankNames[1] || []), ...(rankNames[2] || []), ...(rankNames[3] || [])]);
      query = query.order(sortField, { ascending: sortAsc });
      // 충분히 큰 범위를 가져와서 필터링 후 페이징
      const batchSize = 500;
      let allFiltered = [];
      let offset = 0;
      let totalFiltered = 0;
      while (true) {
        const { data: batch } = await query.range(offset, offset + batchSize - 1);
        if (!batch || batch.length === 0) break;
        const filtered = batch.filter(m => !allRankedSet.has(m.name));
        allFiltered = allFiltered.concat(filtered);
        offset += batchSize;
        if (batch.length < batchSize) break;
      }
      totalFiltered = allFiltered.length;
      const sliced = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      setMembers(sliced);
      setTotalCount(totalFiltered);
      setSelectedIds(new Set());
      setLoading(false);
      return;
    } else if (rankFilter !== 'all') {
      const names = rankNames[Number(rankFilter)] || [];
      if (names.length > 0) {
        query = query.in('name', names);
      } else {
        setMembers([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
    }

    // 정렬
    query = query.order(sortField, { ascending: sortAsc });

    // 페이지네이션
    query = query.range(from, to);

    const { data, count } = await query;
    setMembers(data || []);
    setTotalCount(count || 0);
    setSelectedIds(new Set());
    setLoading(false);
  }, [page, search, sortField, sortAsc, contactFilter, rankFilter, rankNames, courseFilter]);

  useEffect(() => {
    const timeoutId = setTimeout(() => { fetchMembers(); }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchMembers]);

  // 페이지 또는 필터 변경 시 페이지 초기화
  useEffect(() => { setPage(1); }, [search, contactFilter, rankFilter, courseFilter]);

  // 정렬 토글
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // 정렬 화살표 표시
  const sortIcon = (field) => {
    if (sortField !== field) return ' ↕';
    return sortAsc ? ' ↑' : ' ↓';
  };

  // 체크박스: 전체 선택 / 해제
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(members.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 체크박스: 개별 선택
  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 일괄 삭제
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      title: '일괄 삭제',
      message: `선택된 ${selectedIds.size}명의 회원을 정말 영구 삭제하시겠습니까?\n관련된 모든 수료 기록도 함께 삭제됩니다!`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);

    const ids = [...selectedIds];
    const deletedNames = members.filter(m => ids.includes(m.id)).map(m => m.name);
    const { error } = await supabase.from('members').delete().in('id', ids);
    if (!error) {
      logActivity({ action: 'delete', targetType: 'member', targetName: `${ids.length}명 일괄`, details: `일괄 삭제: ${deletedNames.slice(0, 5).join(', ')}${deletedNames.length > 5 ? ' 외 ' + (deletedNames.length - 5) + '명' : ''}` });
      toast.success(`${ids.length}명 삭제 완료`);
      fetchMembers();
    } else {
      toast.error("삭제 실패: " + error.message);
    }
      },
    });
  };

  // CSV 전체 추출 (현재 필터/검색 조건에 해당하는 전체 회원)
  const handleExportCSV = async () => {
    let allMembers = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      let query = supabase.from('members').select('*');
      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (contactFilter === 'has') {
        query = query.not('phone', 'is', null).neq('phone', '');
      } else if (contactFilter === 'none') {
        query = query.or('phone.is.null,phone.eq.');
      }
      if (courseFilter.size > 0) {
        const courseIds = [...courseFilter.keys()];
        query = supabase.from('members')
          .select('*, completions!inner(course_id)')
          .in('completions.course_id', courseIds);
        // 기존 필터 재적용
        if (search.trim()) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        if (contactFilter === 'has') { query = query.not('phone', 'is', null).neq('phone', ''); }
        else if (contactFilter === 'none') { query = query.or('phone.is.null,phone.eq.'); }
      }
      if (rankFilter === 'none') {
        // 순위 없음: 가져온 후 클라이언트 필터링
      } else if (rankFilter !== 'all') {
        const names = rankNames[Number(rankFilter)] || [];
        if (names.length > 0) query = query.in('name', names);
        else break;
      }
      query = query.order(sortField, { ascending: sortAsc }).range(from, from + batchSize - 1);
      const { data } = await query;
      if (!data || data.length === 0) break;
      if (rankFilter === 'none') {
        const allRankedSet = new Set([...(rankNames[1] || []), ...(rankNames[2] || []), ...(rankNames[3] || [])]);
        allMembers = allMembers.concat(data.filter(m => !allRankedSet.has(m.name)));
      } else {
        allMembers = allMembers.concat(data);
      }
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const header = ['이름', '시스템 등록일', '연락처', '이메일'];
    const rows = allMembers.map(m => [
      m.name,
      new Date(m.created_at).toLocaleDateString(),
      m.phone || '',
      m.email || ''
    ]);
    // 한글 깨짐 방지를 위해 BOM(\uFEFF) 추가
    const csvContent = "\uFEFF" + [header.join(','), ...rows.map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `회원명단_추출_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`총 ${allMembers.length}명의 데이터를 CSV로 추출했습니다.`);
  };

  const handleAddMember = async () => {
    if (!newName.trim()) return toast.warning("이름을 입력해주세요.");
    if (newPhone.trim()) {
      const { data: dup } = await supabase.from('members').select('id').eq('phone', newPhone.trim()).limit(1);
      if (dup && dup.length > 0) return toast.warning("이미 동일한 연락처로 등록된 회원이 있습니다!");
    }
    const { data, error } = await supabase.from('members').insert([{ name: newName, phone: newPhone, email: newEmail }]).select();
    if (error) { toast.error("오류 발생: " + error.message); }
    else if (data) {
      logActivity({ action: 'create', targetType: 'member', targetId: data[0].id, targetName: newName, details: `신규 회원 등록 (연락처: ${newPhone || '없음'})` });
      setIsAdding(false); setNewName(''); setNewPhone(''); setNewEmail('');
      fetchMembers();
    }
  };

  // 상세 모달창 열기
  const openMemberDetail = async (member) => {
    setSelectedMember(member);
    setIsEditing(false);
    setEditName(member.name); setEditPhone(member.phone || ''); setEditEmail(member.email || '');
    setEditNameEn(member.name_en || ''); setEditBirthDate(member.birth_date || ''); setEditAddress(member.address || '');
    setEditCurrentCert(member.current_cert || ''); setEditMemo(member.memo || '');
    const [{ data: compData }, { data: enrData }] = await Promise.all([
      supabase.from('completions').select('id, issued_date, cohort, note, courses(id, name)').eq('member_id', member.id).order('issued_date', { ascending: false }),
      supabase.from('enrollments').select('*').eq('member_id', member.id).order('applied_at', { ascending: false }),
    ]);
    setMemberCompletions(compData || []);
    setMemberEnrollments(enrData || []);
  };

  const closeMemberDetail = () => {
    setSelectedMember(null);
    setIssueCourseId(''); setIssueDate(''); setIssueCohort('');
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedMember) closeMemberDetail();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember]);

  // 전화번호 자동 포맷팅 (숫자만 입력해도 010-XXXX-XXXX 형태로)
  const formatPhone = (value) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7, 11);
  };

  // 이메일 형식 검증
  const isValidEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleUpdateMember = async () => {
    if (!editName.trim()) return toast.warning("이름을 입력해주세요.");
    if (editPhone.trim() && !/^01[016789]-?\d{3,4}-?\d{4}$/.test(editPhone.replace(/-/g, ''))) {
      return toast.warning("전화번호 형식이 올바르지 않습니다. 예: 010-1234-5678");
    }
    if (editEmail.trim() && !isValidEmail(editEmail)) {
      return toast.warning("이메일 형식이 올바르지 않습니다. 예: example@email.com");
    }
    if (editPhone.trim() && editPhone !== selectedMember.phone) {
      const { data: dup } = await supabase.from('members').select('id').eq('phone', editPhone.trim()).neq('id', selectedMember.id).limit(1);
      if (dup && dup.length > 0) return toast.warning("이미 동일한 연락처를 사용하는 다른 회원이 있습니다.");
    }
    const updatePayload = {
      name: editName, phone: editPhone, email: editEmail,
      name_en: editNameEn || null, birth_date: editBirthDate || null, address: editAddress || null,
      current_cert: editCurrentCert || null, memo: editMemo || null,
    };
    const { error } = await supabase.from('members').update(updatePayload).eq('id', selectedMember.id);
    if (!error) {
      logActivity({ action: 'update', targetType: 'member', targetId: selectedMember.id, targetName: editName, details: `이름: ${selectedMember.name}→${editName}, 연락처: ${selectedMember.phone||'없음'}→${editPhone||'없음'}` });
      const updated = { ...selectedMember, ...updatePayload };
      setMembers(members.map(m => m.id === selectedMember.id ? { ...m, ...updatePayload } : m));
      setSelectedMember(updated);
      setIsEditing(false);
      toast.success("정보가 성공적으로 수정되었습니다.");
    } else {
      toast.error("수정 실패: " + error.message);
    }
  };

  // 회원 비활성화(숨김) — 삭제하지 않고 숨기기
  const handleHideMember = async () => {
    setConfirmDialog({
      title: '회원 숨기기', message: '이 회원을 숨김 처리하시겠습니까?\n수료 기록은 보존되며, 목록에서만 숨겨집니다.',
      onConfirm: async () => { setConfirmDialog(null);
      const { error } = await supabase.from('members').update({ is_active: false }).eq('id', selectedMember.id);
      if (!error) {
        logActivity({ action: 'hide', targetType: 'member', targetId: selectedMember.id, targetName: selectedMember.name, details: '회원 숨김 처리' });
        closeMemberDetail();
        fetchMembers();
      } else {
        if (error.message.includes('is_active')) {
          toast.error("아직 데이터베이스에 숨김 기능(is_active 컬럼)이 세팅되지 않았습니다.");
        } else {
          toast.error("숨김 처리 실패: " + error.message);
        }
      }
    }
      },
    });
  };

  const handleDeleteMember = () => {
    setConfirmDialog({
      title: '회원 영구 삭제', danger: true,
      message: '이 회원을 정말 영구 삭제하시겠습니까?\n이 회원이 이수한 모든 수료 및 자격증 기록도 함께 삭제됩니다.\n\n숨기기를 사용하면 기록을 보존할 수 있습니다.',
      onConfirm: async () => { setConfirmDialog(null);
      const memberName = selectedMember.name;
      const memberId = selectedMember.id;
      const { error } = await supabase.from('members').delete().eq('id', memberId);
      if (!error) {
        logActivity({ action: 'delete', targetType: 'member', targetId: memberId, targetName: memberName, details: '회원 영구 삭제 (수료 기록 포함)' });
        closeMemberDetail();
        fetchMembers();
      } else {
        toast.error("삭제 실패: " + error.message);
      }
      },
    });
  };

  const handleIssueCourse = async () => {
    if (!issueCourseId) return toast.warning("발급할 과정을 선택하세요.");
    const payload = { member_id: selectedMember.id, course_id: issueCourseId, issued_date: issueDate || null, cohort: issueCohort || null };
    const { data, error } = await supabase.from('completions').insert([payload]).select('id, issued_date, cohort, courses(id, name)');
    if (!error) {
      const courseName = data[0]?.courses?.name || '';
      logActivity({ action: 'create', targetType: 'completion', targetId: data[0].id, targetName: selectedMember.name, details: `${courseName} 수료 발급 (기수: ${issueCohort || '-'})` });
      setMemberCompletions([data[0], ...memberCompletions]);
      setIssueCourseId(''); setIssueDate(''); setIssueCohort('');
    } else {
      toast.error("발급 오류: " + error.message);
    }
  };

  const handleDeleteCompletion = (compId) => {
    const comp = memberCompletions.find(c => c.id === compId);
    setConfirmDialog({
      title: '수료 기록 취소', message: `${comp?.courses?.name || '과정'} 수료 기록을 삭제하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await supabase.from('completions').delete().eq('id', compId);
        logActivity({ action: 'delete', targetType: 'completion', targetId: compId, targetName: selectedMember.name, details: `${comp?.courses?.name || '과정'} 수료 취소` });
        setMemberCompletions(memberCompletions.filter(c => c.id !== compId));
      },
    });
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  // 페이지 번호 목록 생성 (최대 7개 표시)
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, page - 3);
    let end = Math.min(totalPages, start + 6);
    if (end - start < 6) start = Math.max(1, end - 6);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const isAllSelected = members.length > 0 && members.every(m => selectedIds.has(m.id));

  const thStyle = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  return (
    <div>
      {/* 상단 헤더: 제목 + 버튼 + 검색 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>회원 관리 <span style={{fontSize: '18px', color: 'var(--text-muted)'}}>({totalCount.toLocaleString()}명)</span></h1>
          <button onClick={() => setIsAdding(!isAdding)} style={{ padding: '6px 12px', backgroundColor: isAdding ? '#ccc' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}>
            {isAdding ? '작성 취소' : '+ 새 회원 등록'}
          </button>
          <button onClick={handleExportCSV} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
            📥 전체 엑셀(CSV) 추출
          </button>
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} style={{ padding: '6px 12px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              🗑️ 선택 삭제 ({selectedIds.size}명)
            </button>
          )}
        </div>
        <input
          type="text" placeholder="이름 / 연락처 / 이메일 검색..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', width: '280px' }}
        />
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', fontSize: '14px', flexWrap: 'wrap' }}>
        <span style={{ color: '#6b7280', fontWeight: 'bold' }}>필터:</span>
        <select value={contactFilter} onChange={e => setContactFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
          <option value="all">연락처: 전체</option>
          <option value="has">연락처: 있음</option>
          <option value="none">연락처: 없음</option>
        </select>
        <select value={rankFilter} onChange={e => setRankFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}>
          <option value="all">매칭 순위: 전체</option>
          <option value="1">🟢 1순위 (완벽일치)</option>
          <option value="2">🟡 2순위 (과정일치)</option>
          <option value="3">🔴 3순위 (이름만일치)</option>
          <option value="none">⚪ 순위 없음</option>
        </select>
        <div ref={courseDropRef} style={{ position: 'relative' }}>
          <button onClick={() => setCourseDropOpen(!courseDropOpen)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', background: '#fff', cursor: 'pointer', minWidth: '160px', textAlign: 'left' }}>
            {courseFilter.size === 0 ? '수료 과정: 전체' : `수료 과정: ${courseFilter.size}개 선택`} ▾
          </button>
          {courseDropOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', marginTop: '4px', padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '220px' }}>
              {courses.map(c => {
                const isChecked = courseFilter.has(c.id);
                return (
                  <div key={c.id} style={{ padding: '4px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input type="checkbox" checked={isChecked} onChange={() => {
                        setCourseFilter(prev => {
                          const next = new Map(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.set(c.id, '');
                          return next;
                        });
                      }} />
                      📜 {c.name}
                    </label>
                    {isChecked && (
                      <div style={{ marginLeft: '24px', marginTop: '4px', position: 'relative' }}>
                        <div onClick={e => { e.stopPropagation(); setCohortDropOpenId(cohortDropOpenId === c.id ? null : c.id); }}
                          style={{ padding: '3px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', width: '120px', cursor: 'pointer', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: courseFilter.get(c.id) ? '#333' : '#9ca3af' }}>{courseFilter.get(c.id) || '전체'}</span>
                          <span style={{ fontSize: '10px', color: '#9ca3af' }}>▾</span>
                        </div>
                        {cohortDropOpenId === c.id && (
                          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', marginTop: '2px', width: '140px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', maxHeight: '180px', overflow: 'auto' }}>
                            <input type="text" placeholder="🔍 기수 검색" value={cohortSearches[c.id] || ''}
                              onChange={e => setCohortSearches(prev => ({ ...prev, [c.id]: e.target.value }))}
                              style={{ padding: '4px 8px', fontSize: '11px', border: 'none', borderBottom: '1px solid #e5e7eb', width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                            <div onClick={() => {
                              setCourseFilter(prev => { const next = new Map(prev); next.set(c.id, ''); return next; });
                              setCohortDropOpenId(null); setCohortSearches(prev => ({ ...prev, [c.id]: '' }));
                            }} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', color: '#6b7280', fontWeight: 'bold' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                              전체
                            </div>
                            {(courseCohorts[c.id] || [])
                              .filter(cohort => !cohortSearches[c.id] || cohort.includes(cohortSearches[c.id]))
                              .map(cohort => (
                                <div key={cohort} onClick={() => {
                                  setCourseFilter(prev => { const next = new Map(prev); next.set(c.id, cohort); return next; });
                                  setCohortDropOpenId(null); setCohortSearches(prev => ({ ...prev, [c.id]: '' }));
                                }} style={{
                                  padding: '4px 8px', fontSize: '12px', cursor: 'pointer',
                                  backgroundColor: courseFilter.get(c.id) === cohort ? '#e0f2fe' : 'transparent',
                                  fontWeight: courseFilter.get(c.id) === cohort ? 'bold' : 'normal',
                                }}
                                  onMouseEnter={e => { if (courseFilter.get(c.id) !== cohort) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                                  onMouseLeave={e => { if (courseFilter.get(c.id) !== cohort) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                  {cohort}
                                </div>
                              ))}
                            {(courseCohorts[c.id] || []).filter(cohort => !cohortSearches[c.id] || cohort.includes(cohortSearches[c.id])).length === 0 && (
                              <div style={{ padding: '8px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>기수 없음</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '6px', paddingTop: '6px', display: 'flex', gap: '8px' }}>
                <button onClick={() => setCourseFilter(new Map(courses.map(c => [c.id, ''])))} style={{ fontSize: '12px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>전체 선택</button>
                <button onClick={() => setCourseFilter(new Map())} style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>초기화</button>
              </div>
            </div>
          )}
        </div>
        {(contactFilter !== 'all' || rankFilter !== 'all' || courseFilter.size > 0) && (
          <button onClick={() => { setContactFilter('all'); setRankFilter('all'); setCourseFilter(new Map()); setCourseDropOpen(false); }} style={{ padding: '4px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
            필터 초기화
          </button>
        )}
        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '13px' }}>
          총 {totalCount.toLocaleString()}명 중 {rangeStart}~{rangeEnd} 표시
        </span>
      </div>

      {/* 신규 회원 등록 폼 */}
      {isAdding && (
        <div className="card" style={{ marginBottom: '16px', backgroundColor: '#f8f9fa' }}>
          <h3 style={{ marginBottom: '16px' }}>신규 회원 등록</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input type="text" placeholder="이름 (필수)" value={newName} onChange={e => setNewName(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="text" placeholder="연락처 (예: 01012345678)" value={newPhone} onChange={e => setNewPhone(formatPhone(e.target.value))} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <input type="email" placeholder="이메일" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ padding: '8px', flex: 1, border: '1px solid #ccc', borderRadius: '4px' }} />
            <button onClick={handleAddMember} style={{ padding: '8px 24px', backgroundColor: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>명단에 추가</button>
          </div>
        </div>
      )}

      {/* 회원 테이블 */}
      <div className="card">
        {loading ? <LoadingSpinner message="서버에서 회원 데이터를 찾는 중입니다..." /> : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} title="전체 선택" />
                </th>
                <th style={thStyle} onClick={() => handleSort('name')}>이름{sortIcon('name')}</th>
                <th style={thStyle} onClick={() => handleSort('created_at')}>시스템 등록일{sortIcon('created_at')}</th>
                <th style={thStyle} onClick={() => handleSort('phone')}>연락처{sortIcon('phone')}</th>
                <th style={thStyle} onClick={() => handleSort('email')}>이메일{sortIcon('email')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, idx) => (
                <tr key={m.id || idx} className="member-row" style={{ cursor: 'pointer' }}>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => handleSelectOne(m.id)} />
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--primary)' }} onClick={() => openMemberDetail(m)}>{m.name}</td>
                  <td style={{ color: 'var(--text-muted)' }} onClick={() => openMemberDetail(m)}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : '방금 전'}</td>
                  <td style={{ color: m.phone ? 'var(--text-main)' : '#ccc' }} onClick={() => openMemberDetail(m)}>{m.phone || '-'}</td>
                  <td style={{ color: m.email ? 'var(--text-main)' : '#ccc' }} onClick={() => openMemberDetail(m)}>{m.email || '-'}</td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan="5"><EmptyState icon="🔍" title="검색 결과가 없습니다" description="다른 검색어나 필터를 시도해보세요" /></td></tr>}
            </tbody>
          </table>
        )}
        <style jsx>{`.member-row:hover td { background-color: #f1f8ff; }`}</style>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtnStyle(page === 1)}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtnStyle(page === 1)}>‹</button>
            {getPageNumbers().map(p => (
              <button key={p} onClick={() => setPage(p)} style={{
                ...pgBtnStyle(false),
                backgroundColor: p === page ? 'var(--primary)' : '#fff',
                color: p === page ? '#fff' : '#374151',
                fontWeight: p === page ? 'bold' : 'normal',
              }}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtnStyle(page === totalPages)}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={pgBtnStyle(page === totalPages)}>»</button>
          </div>
        )}
      </div>

      {/* 회원 상세 & 수료증 수동 발급 관리 모달 */}
      {selectedMember && (
        <div onClick={closeMemberDetail} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '8px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>

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

              {/* Phase 2A 매칭 순위 뱃지 */}
              {matchRankMap[selectedMember.name] && (
                <div style={{ marginBottom: '12px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: matchRankMap[selectedMember.name].color,
                    backgroundColor: matchRankMap[selectedMember.name].bg,
                    border: `1px solid ${matchRankMap[selectedMember.name].color}`,
                  }}>
                    📋 연락처 매칭 {matchRankMap[selectedMember.name].label}
                  </span>
                </div>
              )}

              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>이름 (한글)</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>이름 (영문)</label>
                      <input type="text" value={editNameEn} onChange={e => setEditNameEn(e.target.value)} placeholder="예: Hong Gil Dong" style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>연락처</label>
                      <input type="text" value={editPhone} onChange={e => setEditPhone(formatPhone(e.target.value))} placeholder="010-1234-5678" style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateMember(); }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>이메일</label>
                      <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="abc@email.com" style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateMember(); }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>생년월일</label>
                      <input type="text" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)} placeholder="예: 1993-12-11" style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>주소</label>
                      <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="도로명 주소" style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>보유 자격</label>
                      <select value={editCurrentCert} onChange={e => setEditCurrentCert(e.target.value)} style={{ padding: '8px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}>
                        <option value="">없음</option>
                        <option value="ACC">ACC</option>
                        <option value="PCC">PCC</option>
                        <option value="MCC">MCC</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>메모</label>
                    <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} placeholder="내부 참고용 메모" rows={2}
                      style={{ padding: '8px', width: '100%', resize: 'vertical', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button onClick={handleUpdateMember} style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장하기</button>
                    <button onClick={handleHideMember} style={{ padding: '10px 20px', background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24', borderRadius: '4px', cursor: 'pointer' }}>숨기기</button>
                    <button onClick={handleDeleteMember} style={{ padding: '10px 20px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}>영구 삭제</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                    <div><span style={{ color: '#6b7280' }}>연락처:</span> <strong>{selectedMember.phone || '없음'}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>이메일:</span> <strong style={{ color: selectedMember.email ? '#333' : '#ccc' }}>{selectedMember.email || '없음'}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>영문이름:</span> <strong style={{ color: selectedMember.name_en ? '#333' : '#ccc' }}>{selectedMember.name_en || '-'}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>생년월일:</span> <strong style={{ color: selectedMember.birth_date ? '#333' : '#ccc' }}>{selectedMember.birth_date || '-'}</strong></div>
                    <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>주소:</span> <strong style={{ color: selectedMember.address ? '#333' : '#ccc' }}>{selectedMember.address || '-'}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>보유 자격:</span> <strong style={{ color: selectedMember.current_cert ? '#333' : '#ccc' }}>{selectedMember.current_cert || '-'}</strong></div>
                  </div>
                  {selectedMember.memo && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                      <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: 'bold' }}>📝 메모:</span>
                      <span style={{ fontSize: '13px', color: '#374151', marginLeft: '8px' }}>{selectedMember.memo}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 수강 신청 이력 */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', color: '#374151', marginBottom: '12px' }}>📋 수강 신청 이력</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                {memberEnrollments.length === 0 ? (
                  <li style={{ padding: '16px', textAlign: 'center', color: 'gray' }}>신청 이력이 없습니다.</li>
                ) : memberEnrollments.map(enr => (
                  <li key={enr.id} style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div>
                        <strong>{enr.course_name || enr.courses?.name || '-'}</strong>
                        {enr.is_retake && <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#fef3c7', color: '#d97706' }}>재수강</span>}
                        {enr.extra_cert && <span style={{ marginLeft: '4px', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', backgroundColor: '#e0e7ff', color: '#4338ca' }}>추가수료증</span>}
                      </div>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{enr.applied_at ? new Date(enr.applied_at).toLocaleDateString() : '-'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: '#6b7280' }}>참가비: <strong>{enr.amount ? enr.amount.toLocaleString() + '원' : '-'}</strong></span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>입금:</span>
                        <select value={enr.payment_status || 'pending'} onChange={async (e) => {
                          const newStatus = e.target.value;
                          await supabase.from('enrollments').update({
                            payment_status: newStatus,
                            payment_confirmed_at: newStatus === 'confirmed' ? new Date().toISOString() : null,
                            payment_confirmed_by: newStatus === 'confirmed' ? 'admin' : null,
                          }).eq('id', enr.id);
                          setMemberEnrollments(prev => prev.map(x => x.id === enr.id ? { ...x, payment_status: newStatus } : x));
                          logActivity({ action: 'update', targetType: 'enrollment', targetId: enr.id, targetName: selectedMember.name, details: `입금 상태: ${newStatus}` });
                        }} style={{
                          padding: '2px 8px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer',
                          border: '1px solid #d1d5db',
                          backgroundColor: enr.payment_status === 'confirmed' ? '#dcfce7' : enr.payment_status === 'refunded' ? '#fee2e2' : '#fff',
                          color: enr.payment_status === 'confirmed' ? '#16a34a' : enr.payment_status === 'refunded' ? '#dc2626' : '#374151',
                        }}>
                          <option value="pending">미확인</option>
                          <option value="confirmed">확인 완료</option>
                          <option value="refunded">환불</option>
                        </select>
                      </div>
                    </div>
                    {enr.payment_status === 'confirmed' && enr.payment_confirmed_at && (
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', textAlign: 'right' }}>
                        확인일: {new Date(enr.payment_confirmed_at).toLocaleString()}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
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
                      {comp.note && (
                        <div style={{ fontSize: '12px', color: '#c2410c', marginTop: '6px', backgroundColor: '#ffedd5', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                          📌 {comp.note}
                        </div>
                      )}
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
      {/* 확인 다이얼로그 */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

// 페이지네이션 버튼 스타일
function pgBtnStyle(disabled) {
  return {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: disabled ? '#f9fafb' : '#fff',
    color: disabled ? '#d1d5db' : '#374151',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '14px',
    minWidth: '36px',
    textAlign: 'center',
  };
}
