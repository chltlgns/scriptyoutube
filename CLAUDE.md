# 쇼츠 대본 생성기 (Shorts Script Generator)

## 프로젝트 개요

쿠팡 상품 리뷰를 분석하여 YouTube 쇼츠 대본을 자동 생성하는 Next.js 애플리케이션입니다.
5개의 전문 AI 에이전트가 협업하여 고품질 대본을 생성합니다.

## 기술 스택

- **프레임워크**: Next.js 16.1.6 (App Router, Turbopack)
- **언어**: TypeScript (strict mode)
- **UI**: React 19, Tailwind CSS v4
- **상태관리**: Zustand 5
- **AI**: Anthropic Claude API (claude-sonnet-4)
- **배포**: Vercel (auto-deploy)

## Git & 배포

- **저장소**: https://github.com/chltlgns/scriptyoutube.git
- **브랜치**: `master` (메인 브랜치)
- **Git 루트**: `shorts-script-generator/` 디렉토리 자체가 git 루트 (부모 oh-my-claudecode와 분리된 별도 저장소)
- **배포 프로세스**:
  1. 변경사항 커밋: `git commit -m "메시지"`
  2. 푸시: `git push origin master`
  3. Vercel 자동 배포 트리거
  4. Vercel 대시보드에서 배포 상태 확인: https://vercel.com/chltlgns920-8418s-projects/scriptyoutube

## 핵심 아키텍처

### 5개 AI 에이전트 시스템

1. **분석가 (Analyst)**: 리뷰 데이터 분석, 핵심 테마 추출
2. **콘텐츠 기획자 (Content Planner)**: 대본 구조 설계, 후크/전개/결론 기획
3. **카피라이터 (Copywriter)**: 설득력 있는 대사 작성, 감정 포인트 설계
4. **편집자 (Editor)**: 문장 다듬기, 쇼츠 형식 최적화
5. **품질 검증자 (QA)**: 최종 검토, 개선 제안

### API 라우트

- **`/api/crawl`** (POST)
  - 쿠팡 URL → 리뷰 크롤링
  - 로컬 전용 (Python 스크립트 호출)
  - Vercel 배포 환경에서는 작동 안 함
  - Python 스크립트 위치: `../coupang-review-nodriver.py` (부모 디렉토리)

- **`/api/generate/stream`** (POST)
  - 리뷰 데이터 → AI 대본 생성
  - SSE 스트리밍으로 실시간 응답
  - 로컬/Vercel 모두 작동
  - Anthropic API 사용

### 디렉토리 구조

```
shorts-script-generator/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── crawl/route.ts          # 크롤링 API (로컬 전용)
│   │   │   └── generate/stream/route.ts # 대본 생성 SSE
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ChatRoom.tsx         # 메인 채팅 UI
│   │   ├── FileUpload.tsx       # 파일/URL 입력
│   │   ├── AgentMessageItem.tsx # 에이전트 메시지 표시
│   │   └── ScriptOutput.tsx     # 최종 대본 출력
│   └── lib/
│       ├── types.ts    # TypeScript 타입 정의
│       ├── prompts.ts  # 5개 에이전트 시스템 프롬프트
│       └── store.ts    # Zustand 전역 상태
├── .env.local          # ANTHROPIC_API_KEY (gitignored)
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.cjs  # CommonJS (Tailwind v4 호환성)
└── .gitignore
```

## 중요 규칙

### 환경 변수
- `.env.local` 파일에 `ANTHROPIC_API_KEY` 저장
- Git 커밋하지 말 것 (`.gitignore`에 포함)
- Vercel 배포 시 Vercel 대시보드에서 환경 변수 설정

### 크롤링 제한사항
- Python 크롤러 (`coupang-review-nodriver.py`)는 부모 디렉토리(`../`)에 위치
- Git 저장소에 포함되지 않음
- 로컬 개발 환경에서만 작동
- Vercel 배포 환경에서는 파일 업로드 방식만 사용 가능

### 빌드 & 배포
- **빌드**: `npm run build`
- **개발**: `npm run dev`
- **커밋 금지 항목**: `.env.local`, `.next/`, `node_modules/`
- **PostCSS 설정**: `postcss.config.cjs` (CommonJS 형식 유지)

### 코드 스타일
- TypeScript strict mode 준수
- 컴포넌트는 함수형 컴포넌트 + Hooks 사용
- Tailwind CSS 유틸리티 클래스 우선
- Zustand store를 통한 전역 상태 관리

## 타입 정의

주요 타입은 `src/lib/types.ts` 참조:
- `AgentMessage`: 에이전트 메시지 구조
- `AgentType`: 5개 에이전트 타입
- `ScriptGeneration`: 대본 생성 상태

## 프롬프트 시스템

`src/lib/prompts.ts`에 5개 에이전트의 시스템 프롬프트 정의:
- 각 에이전트의 역할과 작업 지침
- 출력 형식 및 제약사항
- 에이전트 간 협업 규칙
