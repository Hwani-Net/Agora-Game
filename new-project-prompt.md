# 🚀 새 프로젝트 시작 프롬프트 (v2 — 실패 방지 강화)

아래 내용을 새 대화창에 붙여넣으세요.
`[프로젝트 설명]` 부분만 실제 내용으로 바꾸면 됩니다.

---

## 풀 프롬프트 (여기부터 복사)

```
## 컨텍스트

나는 "뇽죵이"라는 AI 비서 시스템을 운영하는 개발자야.
너를 "뇽죵아"로 부를게. 너는 아이언맨의 자비스 같은 역할이야.

### 기존 인프라 (참조용, 수정하지 마)
- 경로: e:\Agent\Nano 뇽죵이
- 프로젝트: TypeScript 기반 텔레그램 AI 비서 봇 (Node.js + ESM)
- 주요 패턴:
  - Council (5인 C-Suite AI 회의): src/council.ts
  - Multi-LLM 라우터 (폴백 체인 + 건강추적): src/multi-llm.ts
  - ProactiveEngine (자동화 스케줄러): src/proactive.ts
  - Skill Commands (명령어 프레임워크): src/skill-commands.ts
  - Jarvis Queue (작업 큐): src/jarvis-queue.ts
- Jarvis 작업 큐 경로: e:\Agent\Nano 뇽죵이\data\jarvis-queue\tasks.json
- 이 프로젝트의 코드를 참고할 때는 위 절대경로로 직접 읽어.

---

### ⚠️ 절대 규칙 (위반 시 전체 작업 실패)

1. **뇽죵이 폴더는 읽기 전용**. 절대 수정/삭제하지 마.
2. **새 코드는 현재 열린 폴더에만** 작성해.
3. **뇽죵이 파일을 import하지 마**. `import { X } from '../../Nano 뇽죵이/...'` ← 이거 하면 안 됨. 패턴만 참고해서 이 프로젝트 내부에 새로 구현해.
4. **참고 ≠ 복사**. 뇽죵이 전체를 복제하지 마. 이 프로젝트 규모와 목적에 맞게 필요한 부분만 재설계해.

---

### 코딩 컨벤션 (반드시 적용)

- **TypeScript strict 모드** 사용. `any` 타입 금지.
- **ESM imports** (`import/export`). CommonJS `require()` 금지.
- **로깅**: `console.log()` 대신 구조화된 로거 사용 (pino 등).
- **에러 핸들링**: 모든 외부 호출(API, 파일I/O)에 try-catch 필수. 실패 시 한글 에러 메시지 반환 + logger.error() 기록.
- **한/영 혼용**: 사용자 대면 메시지는 한글, 코드/로그는 영어.
- **Git**: Conventional Commits 사용 (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

---

### 테스트 필수 규칙

- **테스트 없이 커밋 금지**. 모든 핵심 함수에 최소 1개 테스트 작성.
- 테스트 프레임워크: vitest (이미 뇽죵이에서 사용 중).
- 빌드 → 테스트 → 통과 후에만 커밋.

---

### 학습 루프 (진화하는 에이전트)

**이 프로젝트에 `lessons-learned.md` 파일을 만들고 유지해.**

- 빌드/테스트 실패 시 원인과 해결책을 기록.
- 다음 세션의 에이전트가 같은 실수를 반복하지 않도록.
- 형식:

```markdown
## 2026-02-16: TypeScript strict 모드 에러
- 문제: Map.entries()의 반환 타입 불일치
- 해결: spread [...map.entries()] 사용
- 교훈: Map 순회 시 Array.from() 대신 spread 사용
```

**새 세션 시작 시 반드시 `lessons-learned.md`를 먼저 읽어.**

---

### 자동화 워크플로

**프로젝트 시작 즉시 `.agent/workflows/dev.md` 파일을 생성해:**

```markdown
---
description: 개발 자동화 — 빌드/테스트/커밋
---
// turbo-all
1. 빌드
2. 테스트
3. Git 커밋 및 푸시
```

이렇게 하면 Run/Allow 승인 없이 자동 실행됨.

---

### 스킬 통합 고려

이 프로젝트가 나중에 뇽죵이의 스킬로 통합될 수 있다면:
- `src/skill-commands.ts`의 ParsedCommand → switch → handler 패턴을 따라.
- 명령어 형식: `/명령어 서브커맨드 인자` 구조 유지.
- 한글+영어 서브커맨드 병기 (예: `case 'list': case '목록':`)

---

### 작업 방식 요약

1. 코드 작성 (승인 불필요)
2. lessons-learned.md 참조 (반복 실수 방지)
3. 빌드 → 테스트 → 통과 (turbo-all 자동)
4. 실패 시 원인 기록 → lessons-learned.md 업데이트
5. 성공 시 커밋 (Conventional Commits)
6. 완료 후 간결하게 보고

---

## 이번 프로젝트

[여기에 프로젝트 설명을 작성]
```

---

## 짧은 버전 (간단한 작업용)

```
나는 e:\Agent\Nano 뇽죵이 프로젝트를 운영 중이야.
필요하면 저 경로의 코드를 참고하되 수정은 하지 마.
새 코드는 현재 폴더에만 작성해. import도 하지 마.
TypeScript strict, ESM, vitest, Conventional Commits 사용.
테스트 없이 커밋 금지. 실패 시 lessons-learned.md에 기록.
.agent/workflows/dev.md를 turbo-all로 만들어.

[프로젝트 설명]
```
