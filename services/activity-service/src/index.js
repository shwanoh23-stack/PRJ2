const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { db } = require('./db');

const app = express();
const PORT = Number(process.env.ACTIVITY_PORT || 3002);
const PIPELINE_SERVICE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

const VALID_ACTIVITY_TYPES = ['CALL', 'EMAIL', 'SMS', 'OTHER', 'MEETING'];

function formatNowDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function toIsoSafe(activityDateStr) {
  if (!activityDateStr) return new Date().toISOString();
  const normalized = activityDateStr.includes('T')
    ? activityDateStr
    : activityDateStr.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { service: 'activity-service', status: 'UP', port: PORT },
    message: '액티비티 서비스 정상 작동 중',
  });
});

// 1. 특정 파이프라인의 활동 목록 조회 (GET /activities?pipeline_id=pipe-001)
app.get('/activities', (req, res) => {
  try {
    const { pipeline_id } = req.query;
    let rows;
    if (pipeline_id) {
      rows = db
        .prepare(
          `SELECT id, pipeline_id, activity_date, activity_type, assignee, content, created_at
           FROM activities
           WHERE pipeline_id = ?
           ORDER BY activity_date DESC, created_at DESC`
        )
        .all(String(pipeline_id));
    } else {
      rows = db
        .prepare(
          `SELECT id, pipeline_id, activity_date, activity_type, assignee, content, created_at
           FROM activities
           ORDER BY activity_date DESC, created_at DESC`
        )
        .all();
    }

    return res.json({
      success: true,
      data: rows,
      message: '액티비티 목록을 성공적으로 조회했습니다.',
    });
  } catch (err) {
    console.error('[ActivityService] GET /activities error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `액티비티 조회 중 오류가 발생했습니다: ${err.message}`,
    });
  }
});

// 2. 새 액티비티 등록 (POST /activities)
app.post('/activities', async (req, res) => {
  try {
    const {
      pipeline_id,
      activity_date,
      activity_type = 'CALL',
      assignee,
      content,
    } = req.body || {};

    if (!pipeline_id || String(pipeline_id).trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        message: '대상 파이프라인 ID(pipeline_id)는 필수입니다.',
      });
    }

    if (!content || String(content).trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        message: '활동 상세 내용(content)을 입력해 주세요.',
      });
    }

    const upperType = String(activity_type).toUpperCase();
    if (!VALID_ACTIVITY_TYPES.includes(upperType)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `유효하지 않은 활동 유형입니다. 허용 값: ${VALID_ACTIVITY_TYPES.join(', ')}`,
      });
    }

    const id = `act-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const finalDate =
      activity_date && String(activity_date).trim() !== ''
        ? String(activity_date).trim()
        : formatNowDateTime();
    const finalAssignee =
      assignee && String(assignee).trim() !== '' ? String(assignee).trim() : '영업담당자';
    const createdAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO activities (id, pipeline_id, activity_date, activity_type, assignee, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      String(pipeline_id).trim(),
      finalDate,
      upperType,
      finalAssignee,
      String(content).trim(),
      createdAt
    );

    const created = db
      .prepare('SELECT * FROM activities WHERE id = ?')
      .get(id);

    // 해당 파이프라인의 총 활동 건수 조회
    const countRow = db
      .prepare('SELECT COUNT(*) AS count FROM activities WHERE pipeline_id = ?')
      .get(String(pipeline_id).trim());

    const totalCount = countRow ? Number(countRow.count) : 1;
    const latestIso = toIsoSafe(finalDate);

    // 파이프라인 서비스에 활동 건수 및 최종 활동 일시 동기화 (Internal MSA Call)
    try {
      await fetch(
        `${PIPELINE_SERVICE_URL}/internal/pipelines/${encodeURIComponent(
          String(pipeline_id).trim()
        )}/activity-sync`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activity_count: totalCount,
            last_activity_at: latestIso,
          }),
        }
      );
    } catch (syncErr) {
      console.warn(
        '[ActivityService] 파이프라인 서비스 활동 동기화 실패(비치명적):',
        syncErr.message
      );
    }

    return res.status(201).json({
      success: true,
      data: created,
      message: '새 액티비티가 성공적으로 등록되었습니다.',
    });
  } catch (err) {
    console.error('[ActivityService] POST /activities error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `액티비티 등록 중 오류가 발생했습니다: ${err.message}`,
    });
  }
});

// 3. 내부 MSA 검증용 API: 특정 파이프라인의 액티비티 개수 조회
// 파이프라인 서비스가 DELETE 요청 처리 전 호출함 (GET /internal/activities/count?pipeline_id=:id)
app.get('/internal/activities/count', (req, res) => {
  try {
    const { pipeline_id } = req.query;
    if (!pipeline_id) {
      return res.status(400).json({
        success: false,
        count: 0,
        data: { count: 0 },
        message: 'pipeline_id 파라미터가 필요합니다.',
      });
    }

    const row = db
      .prepare('SELECT COUNT(*) AS count FROM activities WHERE pipeline_id = ?')
      .get(String(pipeline_id));
    const count = row ? Number(row.count) : 0;

    return res.json({
      success: true,
      count,
      data: { pipeline_id: String(pipeline_id), count },
      message: '액티비티 건수 검증 완료',
    });
  } catch (err) {
    console.error('[ActivityService] GET /internal/activities/count error:', err);
    return res.status(500).json({
      success: false,
      count: 0,
      data: { count: 0 },
      message: err.message,
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ [Activity Service] running on http://localhost:${PORT}`);
  });
}

module.exports = { app };
