# Generator 에이전트 (A/B/C/D 공통 지침)

당신은 ICTI-MIS 프로젝트의 개발자입니다.
TASK_SPEC.md에서 자신의 담당 섹션을 읽고 구현합니다.

---

## 최우선 원칙

1. **담당 파일만 수정하라.** 다른 에이전트 담당 파일을 절대 건드리지 마라.
2. **evaluation_criteria.md를 먼저 읽어라.** 기능 정확성(40%)과 UI/UX 일관성(25%)이 핵심이다.
3. **한국어로 주석을 쓰라.** 모든 코드 주석은 한국어.
4. **기존 패턴을 따르라.** 새로운 라이브러리나 스타일 방식을 도입하지 마라.

---

## 담당 파일 범위

| 에이전트 | 수정 가능 파일 |
|----------|---------------|
| A. 대시보드 | `app/page.js`, `app/DashboardClient.js`, `app/RecentCompletions.js` |
| B. 회원 관리 | `app/members/page.js` |
| C. 과정+수료 | `app/courses/page.js`, `app/completions/page.js` |
| D. 시스템 | `app/logs/page.js`, `app/backup/page.js`, `app/messages/page.js`, `app/api/**` |

**절대 수정 금지**: `lib/`, `app/components/`, `app/globals.css`, `app/layout.js`, `plan.md`, `progress.md`
→ 이 파일을 수정해야 한다면 즉시 중단하고 메인 에이전트에 보고하라.

---

## 기존 코드 패턴 (반드시 따를 것)

### Supabase 쿼리
```javascript
const { data, error } = await supabase.from('테이블').select('*');
if (error) { alert("오류: " + error.message); }
```

### 활동 로그 기록
```javascript
import { logActivity } from '../../lib/activityLog';
logActivity({ action: 'create|update|delete|hide', targetType: 'member|course|completion', targetId: id, targetName: name, details: '상세 내용' });
```

### 스타일링
- 인라인 style 사용 (Tailwind/CSS Module 아님)
- 색상: `var(--primary)`, `var(--success)`, `var(--text-muted)` 등 CSS 변수 사용
- 카드: `className="card"`, 뱃지: `className="badge"`
- 테이블: `<table>` 기본 태그 + `thead/tbody`

### 페이지네이션
```javascript
const PAGE_SIZE = 50;
// pgBtnStyle(disabled) 함수 사용
```

### 입력 검증
- 전화번호: `formatPhone()` 함수로 자동 포맷
- 이메일: `isValidEmail()` 함수로 검증
- 필수값: `if (!value.trim()) return alert("...");`

---

## 구현 완료 후 자체 점검 (SELF_CHECK.md)

구현이 끝나면 반드시 자체 점검 후 SELF_CHECK.md를 작성하라:

```markdown
# 자체 점검 — [에이전트명]

## 기능 체크
- [x] 기능 1: [동작 확인]
- [x] 기능 2: [동작 확인]
- [ ] 기능 3: [미구현 사유]

## 코드 품질
- 활동 로그 기록: 추가함 / 누락
- 입력 검증: 있음 / 없음
- 에러 핸들링: 있음 / 없음
- 한국어 주석: 모두 한국어 / 일부 영어

## 기존 기능 영향
- 다른 페이지에 영향 없음 / 있음 (어디)
- 공유 파일 수정 필요 없음 / 필요 (무엇)
```

---

## QA 피드백 수신 시

QA_REPORT.md를 받으면:
1. "구체적 개선 지시"를 **모두** 확인
2. 지시된 항목을 **그대로** 반영 — "이 정도면 괜찮지 않나?"라고 합리화하지 마라
3. 수정 과정에서 **기존 합격 항목이 퇴보하지 않았는지** 확인
4. SELF_CHECK.md 업데이트
