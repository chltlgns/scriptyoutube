# 에이전트 시스템 아키텍처 리디자인 핸드오프

## 변경 날짜: 2026-02-04

---

## 문제 요약

기존 시스템은 단일 Claude API 호출로 5개 에이전트를 시뮬레이션하는 구조였습니다.

**기존 문제점:**
- `prompts.ts`에 정의된 5개 개별 에이전트 프롬프트가 미사용 상태
- 오케스트레이터 프롬프트 하나로 모든 에이전트를 시뮬레이션
- 스트리밍 없이 전체 라운드 완료까지 대기 필요
- JSON 배열 파싱이 불안정 (정규식 기반)
- Vercel Hobby 10초 타임아웃에 취약

---

## 아키텍처 변경

```
[변경 전] 클라이언트 ← JSON 응답 ← /api/generate ← 1번 Claude API 호출 (모든 에이전트 시뮬레이션)
[변경 후] 클라이언트 ←SSE 스트림← /api/generate/stream ← Claude API x N (에이전트별 개별 호출)
```

### 라운드별 API 호출 변경

| 라운드 | 변경 전 | 변경 후 |
|--------|---------|---------|
| R1 분석 | 1 API 호출 (모든 에이전트) | 3~4 병렬 API 호출 (에이전트별 개별) |
| R2 토론 | 1 API 호출 | 1 API 호출 (오케스트레이터, 개별 프롬프트 컨텍스트 포함) |
| R3 최종 | 1 API 호출 | 1 API 호출 (BOSS 전용) |
| 수정 | 1 API 호출 | 1 API 호출 (BOSS 전용) |

---

## 파일별 변경 내역

### 1. `src/lib/types.ts` — 스트리밍 이벤트 타입 추가
- `StreamEventType` 타입 추가: `round_start`, `agent_start`, `agent_chunk`, `agent_complete`, `round_complete`, `final_script`, `error`
- `StreamEvent` 인터페이스 추가: SSE 이벤트 데이터 구조 정의

### 2. `src/lib/prompts.ts` — 컨텍스트 빌더 함수 추가
- `AGENT_SYSTEM_PROMPTS` 매핑: 에이전트별 시스템 프롬프트 직접 매핑 (드디어 실사용!)
- `buildAgentAnalysisPrompt()`: Round 1 개별 에이전트용 유저 메시지 빌더
- `buildDebatePrompt()`: Round 2 오케스트레이터용 토론 프롬프트 빌더
- `buildFinalScriptPrompt()`: Round 3 BOSS용 최종 대본 프롬프트 빌더
- `buildRevisionPrompt()`: 수정 요청 프롬프트 빌더
- `summarizeContext()`: 이전 메시지 요약 함수 (토큰 절약)

### 3. `src/app/api/generate/stream/route.ts` — 신규 SSE 스트리밍 API
- SSE(Server-Sent Events) 기반 실시간 스트리밍 엔드포인트
- `executeRound1Parallel()`: `Promise.allSettled()`로 에이전트 병렬 실행
- `callAgentWithStreaming()`: 에이전트별 개별 Claude API 스트리밍 호출
- `callAgentWithRetry()`: 에이전트별 재시도 (최대 1회, 지수 백오프)
- `executeRound2Debate()`: 오케스트레이터 단일 호출로 토론 진행
- `executeRound3Final()`: BOSS 단일 호출로 최종 대본 생성
- `executeRevision()`: BOSS 단일 호출로 수정 대본 생성
- 기존 헬퍼 함수 이전: `extractTitles`, `extractScript`, `extractTarget`, `extractKeyPoints`

### 4. `src/lib/store.ts` — 스트리밍 상태 관리 추가
- `activeAgents: Set<AgentId>` — 현재 응답 중인 에이전트 추적
- `streamingContent: Record<string, string>` — 에이전트별 실시간 텍스트 버퍼
- 신규 액션: `setAgentActive`, `setAgentInactive`, `appendStreamingContent`, `clearStreamingContent`, `clearAllStreaming`

### 5. `src/app/page.tsx` — SSE 클라이언트로 전환
- `processSSEStream()`: `ReadableStream` 리더 기반 SSE 파싱
- 불완전한 청크 처리를 위한 버퍼 관리
- 모든 SSE 이벤트 타입 실시간 처리 (`round_start`, `agent_start`, `agent_chunk`, `agent_complete`, `final_script`, `error`)
- `runRoundStreaming()`: 기존 `runRound()` 대체

### 6. `src/components/ChatRoom.tsx` — 실시간 타이핑 UI
- `StreamingMessage` 컴포넌트: 에이전트별 실시간 타이핑 표시 (커서 애니메이션 포함)
- 에이전트 고유 색상 로딩 인디케이터 (텍스트 수신 전 바운스 점)
- 헤더에서 활성 에이전트 하이라이트 (boxShadow 링 + scale 효과)
- 스트리밍 콘텐츠 업데이트 시 자동 스크롤

### 7. `src/app/api/generate/route.ts` — 삭제
- 스트리밍 엔드포인트로 완전 대체되어 삭제됨

---

## 핵심 개선 사항

1. **Round 1 병렬 처리**: 3~4개 에이전트가 동시에 분석 실행 (기존: 하나의 프롬프트에서 순차 시뮬레이션)
2. **SSE 스트리밍**: 첫 바이트가 10초 내 전송되어 Vercel Hobby 타임아웃 우회, 실시간 텍스트 표시
3. **에러 격리**: 한 에이전트 실패가 다른 에이전트에 영향 없음 (`Promise.allSettled` + 재시도)
4. **개별 프롬프트 실사용**: 5개 상세 에이전트 프롬프트가 시스템 프롬프트로 실제 전송됨
5. **JSON 파싱 불안정 해소**: Round 1은 개별 에이전트 텍스트 응답으로 JSON 파싱 불필요

---

## 기술 스택

- Next.js 16.1.6 (App Router, Turbopack)
- Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- `@anthropic-ai/sdk` 0.71.2 (스트리밍 지원)
- Zustand 5.0.9 (상태 관리)
- Vercel Hobby (서버리스 배포)

---

## 검증

- `npm run build` 성공 확인
- 라우트 구조: `/api/generate/stream` 정상 등록, `/api/generate` 제거 완료
