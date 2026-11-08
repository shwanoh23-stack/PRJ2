# 프로젝트 인수인계 및 진행상황 요약 (HANDOVER.md)

> **작성일시**: 2026-11-08  
> **문서 목적**: 다른 PC에서 Antigravity를 실행할 때, 이전 대화 내용 없이도 즉시 개발을 이어갈 수 있도록 설계 결정사항 및 다음 실행 단계를 요약한 문서입니다.

---

## 1. 현재까지 완료된 작업 (Phase 1 완료)

설계 및 요구사항 정의 단계가 모두 완료되었으며, 아래 5개 핵심 문서가 구축되었습니다.

| 문서명 | 파일 위치 | 주요 내용 |
| :--- | :--- | :--- |
| **AGENTS.md** | [AGENTS.md](file:///c:/VIBECD/PRJ2/AGENTS.md) | 에이전트 작업 지침서, 비즈니스 불변 규칙(삭제 차단) 정의 |
| **시스템 아키텍처** | [docs/architecture.md](file:///c:/VIBECD/PRJ2/docs/architecture.md) | React + API Gateway(3000) + 파이프라인(3001) + 액티비티(3002) 경량 MSA 및 SQLite 구조 |
| **API 명세서** | [docs/api_specs.md](file:///c:/VIBECD/PRJ2/docs/api_specs.md) | React $\leftrightarrow$ Gateway 간 실제 오가는 표준 JSON 요청/응답 규격서 |
| **기능 요구사항서** | [FD.md](file:///c:/VIBECD/PRJ2/FD.md) | 6단계 칸반보드, 카드 세부정보, 팝업 모달, 30일 미활동 뱃지 UI 기능 정의 |
| **유스케이스 명세서**| [UC.md](file:///c:/VIBECD/PRJ2/UC.md) | 글로벌 CRM(Pipedrive/HubSpot) 베스트 프랙티스 기반 6대 사용자 시나리오 |

---

## 2. 핵심 비즈니스 규칙 및 아키텍처 결정 요약

1. **기술 스택**: React(Vite) + Node.js(Express) + SQLite
2. **학습 포인트**:
   - 프론트엔드와 백엔드 간의 **표준 JSON 통신**
   - **API Gateway**를 단일 진입점으로 사용하는 **경량 MSA 구조**
3. **영업 6단계**: `리드` $\rightarrow$ `제안` $\rightarrow$ `미팅` $\rightarrow$ `협상` $\rightarrow$ `마무리(수주)` / `취소(실패)`
4. **액티비티 4종**: `전화 📞`, `메일 ✉️`, `문자 💬`, `기타 📌`
5. **삭제 불가 불변 규칙**: 액티비티가 1건 이상 있거나, 초기 상태에서 변경된 적이 있는 파이프라인은 삭제 불가 (프론트 버튼 비활성화 + 백엔드 400 차단)
6. **30일 미활동 딜 관리**: 최종 활동일 기준 30일 경과 시 `⚠️ 30일 미활동` 붉은 뱃지 표시 및 상단 모아보기 필터 제공

---

## 3. 다른 PC에서 다음 단계로 시작할 작업 (Phase 2)

내일 다른 PC에서 Antigravity를 켜고 아래 작업을 진행하면 됩니다.

1. **루트 패키지 및 1-클릭 실행 환경 세팅**
   - 전체 서비스(Gateway, Pipeline 서비스, Activity 서비스, React 프론트)를 `npm run dev` 하나로 켜는 스크립트 구성
2. **백엔드 마이크로서비스 및 API Gateway 구현**
   - `services/api-gateway`: 포트 3000 프록시 및 라우팅
   - `services/pipeline-service`: 포트 3001 파이프라인 CRUD & SQLite 연동
   - `services/activity-service`: 포트 3002 액티비티 CRUD & SQLite 연동
3. **React 프론트엔드 UI 구현**
   - 6단계 칸반보드 (드래그 앤 드롭)
   - 파이프라인 상세 팝업 및 액티비티 표(타임라인)

---

## 4. 내일 입력할 시작 프롬프트

> 💬 **"HANDOVER.md와 지침서 문서들을 읽었어. Phase 2인 프로젝트 세팅 및 실제 백엔드/프론트엔드 구현을 시작해줘!"**
