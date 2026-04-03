# QA 검수 보고서 -- 선승인 일괄 리팩토링

**검수일**: 2026-04-04
**검수 대상**: v1.9-before-refactor 이후 3개 커밋 (9e3f336, f295212, e4a6cb8)
**검수 방법**: 코드 정적 분석 + webpack 빌드 검증 + dev 서버 실행 확인 (Turbopack/webpack)

---

**전체 판정**: CONDITIONAL
**가중 점수**: 5.6 / 10.0

**항목별 점수**:
- 기능 정확성: 5/10 -- Turbopack dev 서버에서 전체 앱 500 에러, 공유 유틸/컴포넌트 미사용, alert/confirm 교체 불완전
- UI/UX 일관성: 7/10 -- Toast/ConfirmDialog/LoadingSpinner/EmptyState 디자인 적절, 색상 팔레트 준수, 호버 효과 통일
- 데이터 무결성: 7/10 -- ConfirmDialog로 삭제 경고 강화, 활동 로그 기존 유지, 입력 검증 toast 교체 완료
- 성능: 7/10 -- 기존 병렬 쿼리 유지, 불필요한 재렌더링 없음, webpack 빌드 정상

---

## 1. 치명적 결함 (반드시 수정)

### 1-1. Turbopack 파싱 에러로 dev 서버 전면 장애
- **어디**: `app/members/page.js` 515행
- **증상**: `next dev` (Turbopack, Next.js 16 기본 모드) 실행 시 "Expression expected" 파싱 에러 발생. members 페이지뿐 아니라 대시보드 포함 전체 앱이 500 에러로 작동 불가.
- **원인**: `handleHideMember` 함수 내부 `setConfirmDialog({...})` 호출에서 `onConfirm` 화살표 함수 닫는 괄호+콤마 패턴(`},`)을 Turbopack(SWC) 파서가 인식 못함. `next build`(webpack)와 `next dev --webpack`에서는 정상 작동.
- **수정 방향**: `handleHideMember`, `handleDeleteMember`, `handleHideMemberSafe`, `handleBulkDelete` 등 `setConfirmDialog` 사용부에서 onConfirm 콜백을 별도 async 함수로 분리 후 참조로 전달. 예:
  ```js
  const doHide = async () => { setConfirmDialog(null); /* ... */ };
  setConfirmDialog({ title: '...', onConfirm: doHide });
  ```

### 1-2. Toast.js에서 useCallback 잘못된 사용
- **어디**: `app/components/Toast.js` 20-25행
- **증상**: `useCallback`에 함수가 아닌 객체 리터럴을 전달. React hooks 규약 위반.
- **원인**: `useCallback`의 첫 번째 인자는 반드시 함수여야 하지만 `{ success: ..., error: ... }` 객체를 전달함. 실제로는 바로 아래 `toastObj`(28-33행)가 컨텍스트 값으로 사용되어 동작에 영향은 없으나, 불필요한 hooks 호출이 React strict mode에서 경고를 유발할 수 있음.
- **수정 방향**: 20-25행의 `const toast = useCallback(...)` 블록 전체 삭제.

---

## 2. 주요 결함 (리팩토링 목표 미달성)

### 2-1. lib/utils.js 공유 유틸이 실제로 사용되지 않음
- **어디**: `lib/utils.js` (formatPhone, isValidEmail, pgBtnStyle, getPageNumbers)
- **증상**: 유틸 함수를 만들어놓고, 주 소비자인 `app/members/page.js`에서 import하지 않음. members/page.js 452-457행에 로컬 `formatPhone`, 460행에 `isValidEmail`, 566-573행에 `getPageNumbers`, 994-1006행에 `pgBtnStyle`이 중복 정의되어 있음.
- **수정 방향**: `app/members/page.js` 상단에 `import { formatPhone, isValidEmail, pgBtnStyle, getPageNumbers } from '../../lib/utils';` 추가 후 로컬 중복 함수 4개 삭제.

### 2-2. Pagination 컴포넌트 미적용 (데드 코드)
- **어디**: `app/components/Pagination.js`
- **증상**: 공통 Pagination 컴포넌트를 생성했으나, 어떤 페이지에서도 import/사용하지 않음. SELF_CHECK.md에도 "아직 기존 페이지에 미적용"으로 기재되어 있으나, 최소 members 페이지에는 적용했어야 함.
- **수정 방향**: `app/members/page.js`의 751-767행 인라인 페이지네이션을 `<Pagination page={page} totalPages={totalPages} onPageChange={setPage} />`로 교체. completions, logs 페이지도 동일 적용.

### 2-3. alert/confirm 교체 불완전
- **어디**: `app/completions/page.js`(alert 1건), `app/messages/page.js`(alert 5건, confirm 1건), `app/sync/page.js`(alert 3건, confirm 2건), `app/backup/page.js`(confirm 1건), `app/courses/page.js`(confirm 2건)
- **증상**: SELF_CHECK에서 "alert 17+7건 교체 완료"라 했으나, 실제로 10건의 alert()와 6건의 window.confirm()이 다른 페이지에 잔존함.
- **수정 방향**: 각 페이지에서 `useToast`와 `ConfirmDialog` import 후 교체. 특히 courses/page.js의 `handleToggleActive`(80행)와 `handleDeleteCourse`(98행)는 이번 리팩토링 대상인데도 window.confirm이 남아 있음.

---

## 3. 경미한 결함

### 3-1. courses/page.js에 ConfirmDialog 미적용
- **어디**: `app/courses/page.js` 80행, 98행
- **증상**: courses/page.js는 이번 리팩토링에서 Toast는 적용했으나 ConfirmDialog는 적용하지 않음. `handleToggleActive`와 `handleDeleteCourse`에서 여전히 `window.confirm()` 사용.
- **수정 방향**: members/page.js와 동일한 패턴으로 `confirmDialog` state 추가 + ConfirmDialog 컴포넌트 렌더링.

### 3-2. Toast 애니메이션 CSS 중복 정의
- **어디**: `app/globals.css` 165-168행, `app/components/Toast.js` 62행
- **증상**: `@keyframes slideIn`이 globals.css와 Toast.js의 인라인 `<style>` 태그에 중복 정의됨. `@keyframes spin`도 globals.css(171-173행)와 LoadingSpinner.js(18행)에 중복.
- **수정 방향**: Toast.js와 LoadingSpinner.js의 인라인 `<style>` 제거. globals.css에 정의된 것으로 통일.

---

## 4. SELF_CHECK.md 대조 결과

| 항목 | 자체 점검 | 실제 확인 | 판정 |
|------|----------|----------|------|
| lib/utils.js 생성 | OK | 파일 존재, 함수 4개 정의됨 | PASS (단, 미사용) |
| Toast 컴포넌트 + layout 연결 | OK | 생성됨, ClientProviders 통해 연결됨 | PASS (useCallback 오용 있음) |
| LoadingSpinner 적용 | OK | members, courses 페이지에 적용 확인 | PASS |
| EmptyState 적용 | OK | members 페이지 빈 검색 결과에 적용 | PASS |
| ConfirmDialog 4건 적용 | OK | members 페이지에 4건 확인 (bulkDelete, hide, delete, deleteCompletion) | PASS |
| Pagination 컴포넌트 생성 | OK | 생성됨 | PASS (단, 미적용) |
| alert -> toast 교체 17+7건 | OK | members 17건 + courses 7건 확인, 그러나 타 페이지 10건 잔존 | PARTIAL |
| confirm -> ConfirmDialog 4건 | OK | members 4건 확인, courses 2건 + 타 페이지 4건 잔존 | PARTIAL |
| 모달 바깥 클릭 닫기 | OK | members 모달에 onClick={closeMemberDetail} 확인 | PASS |
| 테이블 호버 효과 | OK | globals.css에 `tbody tr:hover td` 스타일 확인 | PASS |
| KPI 카드 호버 효과 | OK | `.card-hover` 클래스 + dashboard 적용 확인 | PASS |
| 차트 빈 데이터 안내 | OK | DashboardClient.js ChartEmpty 컴포넌트 확인 | PASS |
| 최근 발급 회원 클릭 -> /members 이동 | OK | RecentCompletions.js router.push 확인 | PASS |
| 기수 필터 cohort 통일 | OK | "10" -> "10기" 정규화 로직 확인 (87행) | PASS |

---

## 5. 방향 판단

**현재 방향 유지** -- 근본적 재작업 불필요.

리팩토링의 방향 자체(공통 컴포넌트 분리, alert->Toast, confirm->ConfirmDialog, 공유 유틸 추출)는 올바르다. 그러나 "만들어놓고 적용 안 함" 패턴이 반복되고 있어 실질적 코드 품질 개선 효과가 반감됨. 또한 Turbopack 호환성 문제는 개발 생산성에 직접 영향을 주므로 우선 해결 필요.

---

## 6. 다음 단계 (우선순위)

1. **[P0]** members/page.js의 setConfirmDialog 콜백 패턴을 Turbopack 호환 방식으로 수정 (별도 함수 분리)
2. **[P0]** Toast.js 20-25행 useCallback 오용 제거
3. **[P1]** members/page.js에서 lib/utils.js import + 로컬 중복 함수 삭제
4. **[P1]** Pagination 컴포넌트를 members/completions/logs에 실제 적용
5. **[P2]** courses/messages/sync/backup/completions의 잔여 alert/confirm 교체
6. **[P3]** CSS 애니메이션 중복 정의 정리
