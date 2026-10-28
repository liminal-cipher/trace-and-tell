# Trace & Tell — 기술 설계 제안

- **상태:** v0.2 · 배포 우선 기술 스택 합의 · 미구현 · 2026-10-28
- **저장소 기준:** 2026-10-28 확인한 `liminal-cipher/trace-and-tell`은 Private이며 빈 Git 저장소다. 실행 소스, manifest, 테스트가 없다.
- **목표:** 모듈형 단일 웹앱으로 지속성 있는 기록 E2E와 별도로 검증된 Meta API E2E를 만든다.
- **참조:** [PRD](product.md) · [UX Spec](ux-functional-spec.md) · [Delivery Plan](implementation-plan.md)


## 1. 확정된 아키텍처 방향

```text
Public browser  ──→ Public synthetic showcase (read-only, no paid AI calls)
Signed-in browser ─→ Next.js App Router + Supabase Auth session
                       ├─ Domain commands and revision/evidence validator
                       ├─ Supabase PostgreSQL (ownership + RLS + explicit grants)
                       ├─ Private Storage (staged direct upload + policy checks)
                       └─ Server-only AI adapter (fixture | replay | meta-live)
                            └─ Meta Model API (later, only with approved budget)
Hosting candidate: Vercel, Seoul-region Functions where supported
```

단일 Next.js 앱으로 프론트엔드와 서버 경계를 유지한다. Supabase는 관리형 DB·Auth·Storage 서비스다. 공개 시연 자료는 별도 정적/읽기 전용 자산으로 제공하고, 비공개 자료와 섞지 않는다. 이미지·메모 입력은 모델에 대한 지시가 아닌 신뢰되지 않은 데이터다.

## 2. 확정된 기술 스택 및 구현 경계

| 계층 | 결정 | 구현·검증 경계 |
| --- | --- | --- |
| UI + server | Next.js App Router · TypeScript | 실제 버전은 앱 초기화 시 pin, 미설치 |
| 스타일 | Tailwind CSS + semantic CSS tokens | Figma는 시안, 팔레트 변경 가능 |
| 입력 검증 | Zod | 네트워크·메타데이터·AI JSON의 런타임 검증 |
| DB | Supabase PostgreSQL 17 | Seoul `ap-northeast-2` 프로젝트 활성 확인; 테이블 미작성 |
| 인증 | Supabase Auth email magic link | 로그인·세션·Workspace 소유권 검증 |
| 저장 | Supabase Storage **private** bucket | 소유자별 접근 정책과 삭제/복구 검증 |
| 마이그레이션 | Supabase SQL migrations | 테이블·RLS·GRANT를 함께 버전 관리; ORM 추가 안 함 |
| 배포 | Vercel (Seoul `icn1` 목표) | 실제 계정 플랜/배포/region 설정 미검증 |
| 테스트 | Vitest + Playwright + DB/RLS 테스트 | 명령·CI는 구현 후 확인, 실행 결과 없음 |
| 모델 | 서버 전용 Meta Model API adapter | 모델/키/입력 품질과 허용 비용은 호출 전 확인 |

무료 사용 범위에서 시작하며 유료 전환·실제 배포·계정 설정·실제 Meta 비용 발생은 각각 사용자 승인 후 수행한다. Vercel Hobby는 개인 비상업적 이용만 허용한다. 상금이 있는 해커톤의 구체적 적합성은 Vercel로부터 확인되지 않았으므로 자동으로 허용된다고 단정하지 않는다.

### 2.1 배포형 업로드 계약 (M1a)

1. 로그인한 사용자가 서버에 `createUploadIntent(workspaceId, metadata, idempotencyKey)`를 요청한다. 서버는 소유권, 파일 크기(초기 안전 상한 제안 6 MiB), 허용 형식(JPEG/PNG/WebP), 파일 수(Workspace당 20개)를 확인한다.
2. 인증된 사용자 권한으로 특정 private bucket/key의 단기 업로드 URL 또는 동등한 Storage 정책 기반의 직접 업로드 권한을 얻는다. 키·경로는 서버가 만들고 다른 소유자의 경로를 지정할 수 없다. 제한은 클라이언트뿐 아니라 서버·Storage에서 강제한다.
3. 브라우저가 파일을 직접 업로드한다. 이 단계는 **검증 대기**이고 활성 Asset이 아니다. 서명 URL이 유효한 동안의 접근/업로드 성질을 별도로 검증한다.
4. `finaliseUpload(intentId)`에서 서버는 실제 저장된 객체·바이트 크기·파일 시그니처/디코딩·선택한 메타데이터를 검증하고 RLS로 보이는 영구 Asset/AssetRevision을 등록한다. 실패 객체는 격리/정리하고 부분 실패를 표시한다.
5. 다운로드는 owner 검증 이후 인증 기반 read 또는 **짧은 만료 시간**의 서명 URL만 허용한다. URL은 만료 전 접근 가능한 토큰으로 취급하며 public link로 오해하지 않는다. 삭제·revocation·캐시 제약은 별도 테스트한다.

M1a에는 실제 PostgreSQL transaction/Storage 비원자성, 중복 업로드와 만료된 intent의 정리·재시도 흐름을 포함한다. Next.js/Vercel의 임시 파일시스템은 영속 원본 저장소로 사용하지 않는다.

### 2.2 인증 및 RLS 경계 (M1a)

- Supabase Auth의 유효 세션과 `auth.uid()`로 Workspace 소유자를 확인한다. UI에서 숨기는 것으로 권한 검증을 대체하지 않는다.
- 모든 노출 테이블에 RLS를 적용하고 데이터 API 접근 권한은 필요한 테이블·연산에만 명시적으로 GRANT한다. `TO authenticated`만으로는 사용자 격리가 되지 않는다. `USING`과 적절한 `WITH CHECK`에 owner 조건을 포함한다.
- 새 테이블 자동 RLS 트리거와 보수적인 `postgres` 기본 GRANT 설정은 조회로 확인했다. 실제 정책의 존재·작동과 Data API 스위치 자체의 체크 상태는 **아직 검증되지 않았다**.
- `service_role`/secret key를 브라우저에 전달하지 않는다. 접근 제어를 우회하는 일반적인 서버 클라이언트 사용은 피하고 최소 권한으로 구현한다.
- 공개 합성 데모는 인증되지 않은 쓰기/실사용 데이터 읽기/무제한 AI 호출 경로를 제공하지 않는다.
- 배포 전 타 사용자 ID 변조, 비공개 파일 직접 URL, 인증 만료, 잘못된 grants/RLS, Storage 정리 실패를 실제로 테스트한다.

## 3. 최소 데이터 모델(논리 계약)

MVP에서는 `Workspace` 하나가 UI의 자료 묶음/조사 케이스와 대응한다. 둘을 별도 DB 엔터티로 분리하는 것은 복수 사용자·여러 사건이 필요해질 때 재검토한다.

| Entity | 필수 관계/속성 | 주의 |
| --- | --- | --- |
| Workspace | id, name, owner_user_id (auth.users), demo_flag, created_at | 실제 소유자 기반의 RLS 경계. 공개 synthetic demo는 별도 경로 |
| Asset | id, workspace_id, kind, active_revision, deletion_state | 사진·메모(typed note 포함) 대표 |
| AssetRevision | id, asset_id, revision, storage_key, size, content_type, user_date, source_note | 원본과 파생물 구분, 불변 판본 |
| Observation | id, workspace_id, asset_revision_id, kind, claim, locator, origin_run, revision | 관찰은 틀릴 수 있음 |
| ReviewDecision | target_kind, target_id, target_revision, decision, actor_scope, timestamp | 모델 제안 수정/거절을 이력으로 보존 |
| Hypothesis | id, workspace_id, relation_kind, statement, review_state, evidence_version, revision | `accepted_for_inquiry`가 참 인증은 아님 |
| EvidenceLink | claim/target revision → source id/revision/locator, role | `supports`, `contradicts`, `context` 역할 |
| Question | id, workspace_id, source_hypothesis_or_observation, text, status, revision | 사람이 수정한 질문은 원문과 분리 |
| Testimony | id, workspace_id, question_id, speaker_label, recorder_scope, source_mode, text, revision | 발화자/기록자/원음/전달 정보 분리 |
| Exhibit, ExhibitCard | workspace_id, ordered cards, references, version, review_state | 변경·삭제 근거 때문에 `needs_review` |
| ModelRun / ProcessingJob | operation, provider_mode, model_id, source_revision_ids, schema_version, state, usage, error_class | 실제 Meta와 fixture를 혼동하지 않음 |

모든 모델 생성 ID는 **제안 데이터**로 취급한다. 실제 DB의 ID와 소유권, 삭제 여부, 리비전은 서버에서 검증하고 매핑한다. 근거가 없는 연결을 전시 문장으로 확정하지 않는다.

### 근거 계약

```json
{
  "claim_kind": "hypothesis",
  "claim_id": "hyp_demo_01",
  "claim_revision": 1,
  "source_kind": "observation",
  "source_id": "obs_demo_02",
  "source_revision": 2,
  "locator": {"type": "whole_image", "description": "왼쪽 위 간판으로 보임"},
  "role": "supports"
}
```

위 ID·내용은 **가짜 데이터 계약 예시**다. 실제 분석 결과나 검증된 위치 좌표가 아니다.

### 타입과 검토/유효성의 분리

- `observation` / `hypothesis` / `testimony`는 정보의 종류다.
- `review_state`는 사람의 결정이다. `accepted_for_inquiry`는 가설을 역사적 사실로 승격하지 않는다.
- `evidence_validity`는 현재 근거의 유효성(`current`, `needs_review`, `invalidated`)이다.

서로 독립된 축을 하나의 상태 enum으로 합치지 않는다.

## 4. 최소 명령/API 계약

다음은 구현 전 **논리 명령**이며 실제 서버에 존재하는 API가 아니다.

| 명령 | 입력·검증 | 결과 |
| --- | --- | --- |
| `createWorkspace(name)` | Auth 세션·owner_user_id 확인 | Workspace ID |
| `createUploadIntent(workspaceId, metadata, idempotencyKey)` / `finaliseUpload(intentId)` | Auth/owner, private staged upload, 파일 검증, 만료·중복 방지 | 검증된 Asset/AssetRevision + private storage key |
| `saveTypedNote(workspaceId, content, idempotencyKey)` | Auth/owner, 본문 검증 | 텍스트 Asset/Revision |
| `readAsset(assetId, revision?)` | 인증/owner, 삭제·접근 차단 | 원본/파생물의 승인된 응답 |
| `reviseAsset(assetId, expectedRevision, changes)` | 일치하는 현재 판본·권한 | 새 AssetRevision |
| `extractObservations(assetRevisionIds, mode, requestKey)` | 모든 자료의 접근·활성 판본·호출 예산 | ModelRun + validated Observation proposals |
| `reviewObservation(id, expectedRevision, decision)` | 동일 판본, decision enum | 새 판본·ReviewDecision·하위 needs_review |
| `suggestConnections(observationRevisions, mode)` | 근거 참조 검증·거절 이력 | 근거·반대 근거가 있는 Hypothesis 또는 none |
| `reviewHypothesis(id, expectedRevision, decision)` | 최신 판본 검증 | 검토 이력 + 질문 사용 가능 상태 |
| `proposeQuestions(sourceIds, mode)` | 출처·불확실성·문구 제약 | Question draft(s) |
| `saveTestimony(questionId, speaker, recorder, textOrUnknown)` | 발화자/기록자, 권한, 형식 | Testimony revision |
| `saveExhibit(workspaceId, cards, expectedRevision)` | 카드별 실존·활성·동일 작업 공간 출처 | 비공개 Exhibit revision |
| `resolveEvidence(reference)` | 원본/판본/소유권/삭제 여부 | 조회 가능 근거 또는 명시적 무효 응답 |
| `deleteAsset(assetId, expectedRevision)` | 소유권, 확인, 자산 참조 무효화 | 즉시 접근 차단 + 파일 삭제 작업 결과 |

`expectedRevision`을 이용한 낙관적 충돌 검사와 `idempotencyKey`를 이용한 중복 요청 방지의 책임은 서버에 둔다. 업로드 완료와 DB/파일 저장 완료를 원자적으로 착각하지 않는다.

## 5. AI provider 계약

```text
interface AIProvider {
  extractObservations(assetRevisions, options)
  suggestConnections(observationRevisions, options)
  proposeQuestions(evidence, options)
  transcribeTestimony(audioRevision, options)  // M3 / optional
}
```

| 모드 | 의미 | 반드시 표시할 것 |
| --- | --- | --- |
| `fixture` | 작성한 합성 고정 응답으로 E2E 검증 | 'DEMO/FIXTURE' |
| `replay` | 실제 과거 응답을 출처와 함께 재생 | 'REPLAY'; 과거 요청의 일시/모델 정보 |
| `meta-live` | 실제 Meta Model API 요청 | 정확한 model ID, 실행 상태, 실제 받은 usage |

현재 공식 Meta 문서는 `muse-spark-1.3`을 영상·이미지 이해와 구조화 출력이 가능한 최신 Muse Spark 후보로 소개한다. 그러나 **이 계정에서 실제 키/모델 접근과 이미지·한국어 판독 품질은 아직 호출 검증되지 않았다.** 모델 ID를 코드에 확정하기 전에 `GET /v1/models` 또는 계정의 실제 제공 목록과 최소 샘플을 확인한다.

Meta API는 OpenAI 호환 SDK와 server-only key를 사용할 수 있다. 이미지 입력은 user message의 `image_url` 또는 base64 형태가 가능하다는 공식 문서가 있다. 공개 사진 URL을 만들기보다는 필요한 축소 이미지를 서버에서 안전하게 전송하는 방식을 우선 검토한다. JSON Schema 구조화 출력은 형식 일관성을 높여도 **응답의 사실성/근거 타당성을 보장하지 않는다.**

- 모델 응답의 근거 ID는 애플리케이션이 제공한 유효한 후보 집합 내에서 검증한다.
- 출력에는 불확실성·판독 불가·근거 없음이 명시적으로 가능해야 한다.
- 문서와 이미지의 텍스트는 untrusted data다. 그 안의 지시를 상위 시스템 지시로 실행하지 않는다.
- `meta-live` 실패 시 fixture 자동 전환을 금지한다.
- `ModelRun`에는 사용 모델, 프롬프트/스키마 버전, 입력 판본, 상태, 오류, 실제 usage를 남긴다. 응답이 usage를 반환하지 않으면 `unknown`으로 표기한다.
- API 비용은 승인된 호출/토큰/예산 범위로 관리하고, 앱 제한을 계정 전체의 결제 하드캡으로 주장하지 않는다.

## 6. 개인정보·보안·약관 경계

- **배포 우선:** 인증·소유권/RLS·Private Storage 검증을 M1a에서 구현한다. 미인증 쓰기나 개인 데이터 접근이 가능한 프로토타입을 배포하지 않는다.
- 실제 가족사진·증언을 다루기 전에 사용자 동의·접근 제어·파일 비공개·개인정보 처리방침·삭제 방식을 검증한다.
- Meta Contributor 서비스에는 개인·기밀 정보를 입력하지 않는다. 공식 자료는 Standard와 Contributor의 데이터 사용을 구분하고, Contributor에서 개인정보 전송을 금지한다. **개인정보 처리가 허용되는 Standard 경로와 해당 약관을 실자료 사용 전에 재확인**한다.
- 공개 데모 데이터만 허용. 손글씨·사진 속 실제 인물의 허락/라이선스가 불명확하면 사용하지 않는다.
- 서버의 private 파일 키를 브라우저 public static 경로, 로그, 깃 저장소에 두지 않는다. EXIF GPS 등 민감한 메타데이터는 무심코 외부에 노출하지 않는다.
- Workspace 소유권·파일 접근·정정·삭제에 서버 검사와 실제 RLS/Storage 정책을 사용한다. UI 숨김만으로는 보안이 아니다.
- API key, 토큰, 신용카드, 실명·계정번호 같은 비밀값은 코드/문서/로그에 포함하지 않는다.

## 7. 작업·수정·삭제 복구

- 분석 상태: `queued → running → succeeded | partial | failed | cancelled | unknown_remote_outcome`.
- 작업이 오래 걸려도 브라우저 새로고침으로 결과가 사라지지 않도록 DB에 상태를 보존한다.
- 재시작 시 장시간 `running`이 남으면 서버가 복구 가능 상태로 전환할 수 있어야 한다.
- 동시에 들어온 수정은 최신 revision 검사 후 거부/재시도하며 사용자 변경을 덮어쓰지 않는다.
- 자료 삭제를 요청한 순간 접근을 막고 근거를 무효화한다. 파일·파생물 삭제가 뒤따르며 실패 시 작업 상태를 명시한다.
- 삭제/정정 이후 뒤늦게 온 AI 결과는 입력 판본을 검사하여 활성 데이터로 부활시키지 않는다.
- 원격 API의 과금이 정확히 한 번만 발생한다고 보장하지 않는다. 앱 내부의 중복 방지와 별개 문제다.


## 8. 배포 전 필수 관문

1. Supabase Auth 로그인·세션 갱신과 정확한 callback/redirect 설정을 확인한다.
2. 모든 관련 테이블에 명시적 GRANT + RLS owner 정책, Storage private bucket 정책을 적용하고 다른 사용자/익명 사용자의 읽기·쓰기·삭제를 실제 거부 테스트한다.
3. 직접 업로드 intent 및 검증 대기 상태, 스토리지 URL 만료, 파일 포맷/용량 검증, 정정·삭제와 orphan 객체 처리, 기초 CSRF/동시성 테스트를 통과한다.
4. 공개 synthetic demo와 private Workspace 사이에 API·DB·파일·모델 호출 정보 누출이 없는지 검증한다.
5. Vercel 계정 플랜·Hobby 약관 적합성, Seoul 리전, Supabase 무료 사용 한도, 비용 제한을 확인한다. 유료 전환과 배포 실행은 별도 승인이다.
6. 실제 참가자용 Official Rules/제출 폼 요구를 재확인한다. 동작 URL이 필수인지, 영상 길이·소스 공개 요구가 무엇인지 임의 추정하지 않는다.

**현재:** Supabase 프로젝트 생성·Seoul 리전·Postgres 17·자동 RLS 이벤트 트리거·보수적인 `postgres` 기본 권한 설정이 확인됐다. 현재 앱 테이블은 없고 인증/RLS 정책/배포/테스트는 아직 구현되지 않았다.

## 9. 확정 사항과 남은 확인

| 항목 | 결정 또는 상태 |
| --- | --- |
| DB·파일·호스팅 방향 | **확정:** Supabase PostgreSQL/Auth/Private Storage + Vercel 배포 우선 |
| 구현 프레임워크 | **확정:** Next.js App Router · TypeScript · Tailwind · Zod · SQL migrations |
| 사용자 경험 | **확정:** 영어 기본, 공개 읽기 전용 합성 데모 + 인증된 개인 작업 공간 |
| 비용 | **확정:** 무료 플랜 우선. 실제 유료 호출/전환은 명시적으로 승인받음 |
| 모델 | **후보:** `muse-spark-1.3` Standard, 실제 계정 모델 목록/품질은 미검증 |
| 음성 | **후순위:** Transcribe 지원·한국어 결과 측정 후 결정 |
| 배포 | **미실행:** Vercel 계정·플랜 및 Hobby 행사 적합성 확인 전 |
| 행사 요구사항 | **미확인:** 참가자용 규정 수락, 제출 폼/영상/URL/공개 요건 |

## 10. 검증 근거

- Meta API reference: https://dev.meta.ai/docs/api-reference
- SDKs: https://dev.meta.ai/docs/sdks
- Models: https://dev.meta.ai/docs/models
- Vision input: https://dev.meta.ai/docs/cookbook/vision-input
- Structured output: https://dev.meta.ai/docs/structured-output
- Contributor privacy requirements: https://dev.meta.ai/help/policies-and-privacy/contributor-tier
- Geographic use and model designations: https://dev.meta.ai/legal/geographic-use-policy
- Supabase RLS and grants: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage privacy: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Signed upload URLs: https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- Vercel fair use: https://vercel.com/docs/limits/fair-use-guidelines

구현 시 각 문서의 현재 버전과 실제 API 응답을 다시 확인한다.
