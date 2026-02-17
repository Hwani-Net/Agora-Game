# AI Agora — UI/UX 개선 태스크 (Codex용)

## 프로젝트 개요

AI Agora는 AI 에이전트들이 철학적 토론을 벌이고, 유저가 관전하며 투자하는 플랫폼입니다.
- **라이브 사이트**: https://ai-agora.pages.dev
- **스택**: React + TypeScript + Vite, Supabase 백엔드
- **배포**: Cloudflare Pages (자동 deploy via GitHub Actions)

## 현재 코드 구조

```
src/client/
  main.tsx            — React 앱 엔트리포인트
  App.tsx             — 라우터 (React Router)
  AuthContext.tsx      — Supabase Auth 컨텍스트
  supabase.ts         — Supabase 클라이언트 초기화
  api.ts              — Supabase 데이터 호출 함수
  index.css           — 전체 디자인 시스템 (CSS 변수, 컴포넌트 스타일)
  pages/
    HomePage.tsx      — 메인 히어로 + 통계
    AgentsPage.tsx    — AI 에이전트 갤러리
    ArenaPage.tsx     — 토론 배틀 목록
    MarketPage.tsx    — 주식시장 (에이전트 주가)
    QuestsPage.tsx    — 퀘스트/현상금
```

## 디자인 시스템 (이미 구축됨)

CSS 변수 기반 다크 테마:
- 배경: `#0a0b0f` (딥 블랙), `#171923` (카드)
- 악센트: Indigo (`#6366f1`) → Violet (`#8b5cf6`) 그라디언트
- 글래스모피즘: `backdrop-filter: blur(12px)`, 반투명 카드
- 티어 색상: Bronze, Silver, Gold, Diamond, Legend 각각 고유 색
- 폰트: Inter (산세리프), JetBrains Mono (숫자/코드)

## 개선 목표 5가지

### 1. 🏛️ 토론 상세 보기 페이지 (DebateDetailPage)

**새 파일**: `src/client/pages/DebateDetailPage.tsx`

Arena 목록에서 토론을 클릭하면 상세 페이지로 이동.

**필수 기능**:
- URL: `/arena/:debateId`
- Supabase에서 `debates` 테이블 조회 (`id`로 단일 조회)
- 3라운드 토론 내용 표시 (rounds JSONB 배열)
  - 각 라운드: `{ round, agent1_argument, agent2_argument }`
- 판사 판정 결과 (`judge_reasoning`)
- 승자 표시 + ELO 변동 (`elo_change_winner`, `elo_change_loser`)
- 점수 표시 (있으면 rounds 안에 포함)

**UI 레이아웃**:
```
┌─────────────────────────────────────┐
│  토론 주제: "AI 규제가 필요한가?"      │
│  소크라테스 2.0  ⚔️  다빈치 코드       │
├─────────────────────────────────────┤
│  [라운드 1: 주장]                     │
│  ┌──────────┐  ┌──────────┐         │
│  │ Agent 1  │  │ Agent 2  │         │
│  │ 논증...   │  │ 논증...   │         │
│  └──────────┘  └──────────┘         │
│  [라운드 2: 반박]                     │
│  ...                                │
│  [라운드 3: 최종 변론]                 │
│  ...                                │
├─────────────────────────────────────┤
│  🏆 판정 결과                         │
│  승자: 다빈치 코드 (+19 ELO)          │
│  패자: 소크라테스 2.0 (-19 ELO)       │
│  판정 이유: "..."                     │
└─────────────────────────────────────┘
```

**CSS 클래스**: `.debate-detail`, `.debate-round`, `.debate-round__speaker`, `.debate-round__text` (index.css에 이미 기본 정의 있음)

**api.ts에 추가할 함수**:
```typescript
export async function getDebateById(id: string) {
  const { data, error } = await supabase
    .from('debates_view')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
```

### 2. 🤖 에이전트 상세 프로필 페이지 (AgentDetailPage)

**새 파일**: `src/client/pages/AgentDetailPage.tsx`

**필수 기능**:
- URL: `/agents/:agentId`
- 에이전트 정보 (이름, 페르소나, 철학, 진영, ELO, 티어, 전적)
- 최근 토론 이력 (해당 에이전트 참여 토론 목록)
- 주식 정보 (해당 에이전트 주식 가격, 시총)

**UI 레이아웃**:
```
┌─────────────────────────────────────┐
│  🐙 소크라테스 2.0     [GOLD]        │
│  합리주의 | ELO 1431                 │
│  ──────────────────                 │
│  "끊임없는 질문을 통해 진리를 탐구..."   │
│  철학: 산파술을 통한 진리 도출          │
├─────────────────────────────────────┤
│  📊 전적                            │
│  8승 4패 1무 | 총 13전               │
│  승률 61.5%                         │
├─────────────────────────────────────┤
│  📈 주식 정보                        │
│  현재가: ₩1,280 | 시총: ₩1,280,000  │
│  24h 변동: +2.3%                    │
├─────────────────────────────────────┤
│  ⚔️ 최근 토론                        │
│  vs 다빈치코드 | 패 (-19) | 2/17     │
│  vs 마키아벨리안 | 승 (+15) | 2/16   │
│  ...                                │
└─────────────────────────────────────┘
```

**api.ts에 추가할 함수**:
```typescript
export async function getAgentById(id: string) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getAgentDebates(agentId: string) {
  const { data, error } = await supabase
    .from('debates_view')
    .select('*')
    .or(`agent1_id.eq.${agentId},agent2_id.eq.${agentId}`)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function getAgentStock(agentId: string) {
  const { data } = await supabase
    .from('agent_stocks')
    .select('*')
    .eq('agent_id', agentId)
    .single();
  return data;
}
```

### 3. 🎮 관전 시작하기 버튼 → 실시간 토론 실행

**수정 파일**: `src/client/pages/HomePage.tsx`, `src/client/pages/ArenaPage.tsx`

홈페이지의 "관전 시작하기" 버튼을 클릭하면:
1. `startAutoBattle()` (api.ts에 이미 정의됨) 호출
2. 로딩 스피너 + "AI 에이전트 매칭 중..." 표시
3. 결과 수신 후 → 토론 상세 페이지로 이동 (`/arena/{debateId}`)

ArenaPage에도 "새 토론 시작" 버튼 추가:
- 같은 로직

**이미 api.ts에 있는 함수**:
```typescript
export async function startAutoBattle(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('run-debate', {
    body: { mode: 'auto' },
  });
  if (error) throw new Error(error.message || 'AI 토론 시작에 실패했습니다.');
  return data;
}
```

**UX 주의점**:
- 토론 실행은 약 30-60초 소요 (Gemini API 7회 호출)
- 로딩 중 멋진 애니메이션 필요 (검 교차 아이콘 회전 등)
- 에러 시 알림 표시

### 4. 📱 모바일 반응형 개선

현재 기본적인 반응형은 있지만 (grid breakpoints) 세부 최적화 필요:

- **Navbar**: 768px 이하에서 햄버거 메뉴로 전환
- **카드**: 모바일에서 full-width, 정보 밀도 조정
- **토론 상세**: 2컬럼 → 1컬럼 스택
- **터치 친화적**: 버튼 최소 44px 높이

### 5. ✨ 마이크로 인터랙션 & 폴리시

- **페이지 전환 애니메이션**: framer-motion 사용 없이 CSS transition으로 fade-in
- **카드 등장**: staggered animation (각 카드 0.1s 딜레이)
- **로딩 스켈레톤**: 데이터 로딩 중 pulse 애니메이션 스켈레톤 표시
- **토스트 알림**: 토론 완료, 에러 등 피드백용
- **ELO 변동 애니메이션**: 숫자 카운트업/다운 효과

## App.tsx 라우터 수정

기존 라우터에 새 페이지 추가:
```tsx
<Route path="/arena/:debateId" element={<DebateDetailPage />} />
<Route path="/agents/:agentId" element={<AgentDetailPage />} />
```

## 기술 제약사항

1. **CSS만 사용** — Tailwind 금지, vanilla CSS (index.css에 추가)
2. **외부 라이브러리 최소화** — React Router (이미 설치), @supabase/supabase-js (이미 설치) 외 추가 금지
3. **한국어 UI** — 모든 텍스트는 한국어
4. **기존 디자인 시스템 활용** — index.css의 CSS 변수와 클래스 적극 재사용
5. **타입 안전** — TypeScript strict mode

## Supabase 데이터 구조 참고

```sql
-- debates 테이블:
id TEXT, topic TEXT, agent1_id TEXT, agent2_id TEXT,
rounds JSONB, judge_reasoning TEXT, winner_id TEXT,
elo_change_winner INT, elo_change_loser INT,
status TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ

-- debates_view (조인된 뷰):
위 + agent1_name TEXT, agent2_name TEXT, winner_name TEXT

-- agents 테이블:
id TEXT, name TEXT, persona TEXT, philosophy TEXT, faction TEXT,
elo_score INT, tier TEXT, wins INT, losses INT, draws INT,
total_debates INT, owner_id UUID, created_at TIMESTAMPTZ

-- agent_stocks 테이블:
id TEXT, agent_id TEXT, current_price REAL, total_shares INT,
available_shares INT, market_cap REAL, price_change_24h REAL
```

## 실행 & 테스트

```bash
npm run dev        # 로컬 개발 서버 (port 5174)
npm run build      # 프로덕션 빌드
```

환경변수 (.env):
```
VITE_SUPABASE_URL=https://ikpnytyaxukmglsecrtn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
