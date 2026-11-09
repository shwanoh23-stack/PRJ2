const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.ACTIVITY_DB_PATH || path.join(DATA_DIR, 'activities.sqlite');
const db = new DatabaseSync(DB_PATH);

function daysAgoDateTimeStr(days, timeStr = '14:00') {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${timeStr}`;
}

function daysAgoIsoStr(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function initActivityDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id            TEXT PRIMARY KEY,
      pipeline_id   TEXT NOT NULL,
      activity_date TEXT NOT NULL,
      activity_type TEXT NOT NULL DEFAULT 'CALL'
                    CHECK (activity_type IN ('CALL', 'EMAIL', 'SMS', 'OTHER', 'MEETING')),
      assignee      TEXT NOT NULL,
      content       TEXT NOT NULL CHECK (length(trim(content)) >= 1),
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activities_pipeline_date
      ON activities(pipeline_id, activity_date DESC, created_at DESC);
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM activities').get();
  if (countRow.count === 0) {
    seedActivities();
  }
}

function seedActivities() {
  const insertStmt = db.prepare(`
    INSERT INTO activities (id, pipeline_id, activity_date, activity_type, assignee, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const seeds = [
    // pipe-001: 35일 전, 38일 전 활동 (30일 이상 미활동 시나리오)
    {
      id: 'act-101',
      pipeline_id: 'pipe-001',
      activity_date: daysAgoDateTimeStr(35, '14:00'),
      activity_type: 'OTHER',
      assignee: '홍길동',
      content: '담당 부서장 대면 미팅 진행. 1차 견적서 전달 완료.',
      created_at: daysAgoIsoStr(35),
    },
    {
      id: 'act-102',
      pipeline_id: 'pipe-001',
      activity_date: daysAgoDateTimeStr(38, '10:30'),
      activity_type: 'CALL',
      assignee: '홍길동',
      content: '도입 일정 유선 확인. 예산 편성 범위 파악 완료.',
      created_at: daysAgoIsoStr(38),
    },
    // pipe-002: 활동 0건 (삭제 가능 테스트용 파이프라인)
    // pipe-003: 최근(3일 전) 활동 1건 (정상 활성 파이프라인)
    {
      id: 'act-103',
      pipeline_id: 'pipe-003',
      activity_date: daysAgoDateTimeStr(3, '15:20'),
      activity_type: 'EMAIL',
      assignee: '박 보안',
      content: '클라우드 보안 아키텍처 기술검토서 및 데모 시나리오 메일 발송.',
      created_at: daysAgoIsoStr(3),
    },
    // pipe-004: 40일 전 활동 1건 (협상 단계 장기 미활동 딜)
    {
      id: 'act-104',
      pipeline_id: 'pipe-004',
      activity_date: daysAgoDateTimeStr(40, '11:00'),
      activity_type: 'CALL',
      assignee: '이협상',
      content: '최종 라이선스 단가 할인율 협의 통화. 내부 품의 대기 중.',
      created_at: daysAgoIsoStr(40),
    },
    // pipe-005: 수주 완료(WON) 딜 활동 2건
    {
      id: 'act-105',
      pipeline_id: 'pipe-005',
      activity_date: daysAgoDateTimeStr(10, '16:00'),
      activity_type: 'EMAIL',
      assignee: '홍길동',
      content: '최종 전자계약서 날인본 수령 및 착수 일정 안내 메일 발송.',
      created_at: daysAgoIsoStr(10),
    },
    {
      id: 'act-106',
      pipeline_id: 'pipe-005',
      activity_date: daysAgoDateTimeStr(18, '13:30'),
      activity_type: 'SMS',
      assignee: '홍길동',
      content: '계약서 법무 검토 완료 여부 문자 확인.',
      created_at: daysAgoIsoStr(18),
    },
    // pipe-006: 취소(CANCELED) 딜 활동 1건
    {
      id: 'act-107',
      pipeline_id: 'pipe-006',
      activity_date: daysAgoDateTimeStr(20, '09:45'),
      activity_type: 'CALL',
      assignee: '김영업',
      content: '고객사 하반기 IT 예산 동결로 인한 프로젝트 잠정 중단 통보 수령.',
      created_at: daysAgoIsoStr(20),
    },
  ];

  for (const item of seeds) {
    insertStmt.run(
      item.id,
      item.pipeline_id,
      item.activity_date,
      item.activity_type,
      item.assignee,
      item.content,
      item.created_at
    );
  }
}

initActivityDb();

module.exports = {
  db,
  seedActivities,
};
