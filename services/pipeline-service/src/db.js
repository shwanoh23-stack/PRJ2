const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.PIPELINE_DB_PATH || path.join(DATA_DIR, 'pipelines.sqlite');
const db = new DatabaseSync(DB_PATH);

function daysAgoIsoStr(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNowDateStr(days) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function initPipelineDb() {
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pipelines (
      id                  TEXT PRIMARY KEY,
      title               TEXT NOT NULL CHECK (length(trim(title)) >= 2),
      client_name         TEXT NOT NULL CHECK (length(trim(client_name)) >= 1),
      amount              INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
      status              TEXT NOT NULL DEFAULT 'LEAD'
                          CHECK (status IN ('LEAD', 'PROPOSAL', 'MEETING', 'NEGOTIATION', 'WON', 'CANCELED')),
      initial_status      TEXT NOT NULL DEFAULT 'LEAD'
                          CHECK (initial_status IN ('LEAD', 'PROPOSAL', 'MEETING', 'NEGOTIATION', 'WON', 'CANCELED')),
      status_change_count INTEGER NOT NULL DEFAULT 0 CHECK (status_change_count >= 0),
      activity_count      INTEGER NOT NULL DEFAULT 0 CHECK (activity_count >= 0),
      last_activity_at    TEXT NULL,
      created_by          TEXT NOT NULL,
      closing_date        TEXT NULL,
      canceled_date       TEXT NULL,
      created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_status_logs (
      id          TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status   TEXT NOT NULL,
      changed_by  TEXT DEFAULT '담당자',
      changed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
    CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_status_logs_pipeline_id ON pipeline_status_logs(pipeline_id);
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM pipelines').get();
  if (countRow.count === 0) {
    seedPipelines();
  }
}

function seedPipelines() {
  const insertPipe = db.prepare(`
    INSERT INTO pipelines (
      id, title, client_name, amount, status, initial_status,
      status_change_count, activity_count, last_activity_at,
      created_by, closing_date, canceled_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO pipeline_status_logs (id, pipeline_id, from_status, to_status, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const seeds = [
    {
      id: 'pipe-001',
      title: 'ERP 시스템 교체 프로젝트',
      client_name: '(주)삼성물산',
      amount: 50000000,
      status: 'PROPOSAL',
      initial_status: 'LEAD',
      status_change_count: 1,
      activity_count: 2,
      last_activity_at: daysAgoIsoStr(35),
      created_by: '홍길동',
      closing_date: daysFromNowDateStr(30),
      canceled_date: null,
      created_at: daysAgoIsoStr(45),
      updated_at: daysAgoIsoStr(35),
    },
    {
      id: 'pipe-002',
      title: 'AI 챗봇 도입 건',
      client_name: '(주)카카오엔터프라이즈',
      amount: 18000000,
      status: 'LEAD',
      initial_status: 'LEAD',
      status_change_count: 0,
      activity_count: 0,
      last_activity_at: null,
      created_by: '김영업',
      closing_date: daysFromNowDateStr(21),
      canceled_date: null,
      created_at: daysAgoIsoStr(2),
      updated_at: daysAgoIsoStr(2),
    },
    {
      id: 'pipe-003',
      title: '클라우드 보안 솔루션 구축',
      client_name: '현대오토에버',
      amount: 65000000,
      status: 'MEETING',
      initial_status: 'LEAD',
      status_change_count: 2,
      activity_count: 1,
      last_activity_at: daysAgoIsoStr(3),
      created_by: '박보안',
      closing_date: daysFromNowDateStr(15),
      canceled_date: null,
      created_at: daysAgoIsoStr(14),
      updated_at: daysAgoIsoStr(3),
    },
    {
      id: 'pipe-004',
      title: '차세대 빅데이터 분석 플랫폼',
      client_name: 'LG CNS',
      amount: 120000000,
      status: 'NEGOTIATION',
      initial_status: 'LEAD',
      status_change_count: 3,
      activity_count: 1,
      last_activity_at: daysAgoIsoStr(40),
      created_by: '이협상',
      closing_date: daysFromNowDateStr(10),
      canceled_date: null,
      created_at: daysAgoIsoStr(55),
      updated_at: daysAgoIsoStr(40),
    },
    {
      id: 'pipe-005',
      title: '사내 그룹웨어 연동 개발',
      client_name: '네이버클라우드',
      amount: 32000000,
      status: 'WON',
      initial_status: 'LEAD',
      status_change_count: 4,
      activity_count: 2,
      last_activity_at: daysAgoIsoStr(10),
      created_by: '홍길동',
      closing_date: daysFromNowDateStr(-10),
      canceled_date: null,
      created_at: daysAgoIsoStr(30),
      updated_at: daysAgoIsoStr(10),
    },
    {
      id: 'pipe-006',
      title: '물류 자동화 대시보드',
      client_name: '(주)우아한형제들',
      amount: 45000000,
      status: 'CANCELED',
      initial_status: 'LEAD',
      status_change_count: 2,
      activity_count: 1,
      last_activity_at: daysAgoIsoStr(20),
      created_by: '김영업',
      closing_date: null,
      canceled_date: daysAgoIsoStr(20),
      created_at: daysAgoIsoStr(35),
      updated_at: daysAgoIsoStr(20),
    },
  ];

  for (const p of seeds) {
    insertPipe.run(
      p.id,
      p.title,
      p.client_name,
      p.amount,
      p.status,
      p.initial_status,
      p.status_change_count,
      p.activity_count,
      p.last_activity_at,
      p.created_by,
      p.closing_date,
      p.canceled_date,
      p.created_at,
      p.updated_at
    );
  }

  // 기본 상태 변경 감사 로그 시드
  insertLog.run('log-001', 'pipe-001', 'LEAD', 'PROPOSAL', '홍길동', daysAgoIsoStr(36));
  insertLog.run('log-002', 'pipe-003', 'LEAD', 'PROPOSAL', '박보안', daysAgoIsoStr(10));
  insertLog.run('log-003', 'pipe-003', 'PROPOSAL', 'MEETING', '박보안', daysAgoIsoStr(4));
  insertLog.run('log-004', 'pipe-004', 'MEETING', 'NEGOTIATION', '이협상', daysAgoIsoStr(41));
  insertLog.run('log-005', 'pipe-005', 'NEGOTIATION', 'WON', '홍길동', daysAgoIsoStr(10));
  insertLog.run('log-006', 'pipe-006', 'PROPOSAL', 'CANCELED', '김영업', daysAgoIsoStr(20));
}

initPipelineDb();

module.exports = {
  db,
  seedPipelines,
};
