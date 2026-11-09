const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { db } = require('./db');

const app = express();
const PORT = Number(process.env.PIPELINE_PORT || 3001);
const ACTIVITY_SERVICE_URL = process.env.ACTIVITY_SERVICE_URL || 'http://localhost:3002';

app.use(cors());
app.use(express.json());

const VALID_STATUSES = ['LEAD', 'PROPOSAL', 'MEETING', 'NEGOTIATION', 'WON', 'CANCELED'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function todayDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function enrichPipeline(row) {
  if (!row) return null;

  const isClosed = row.status === 'WON' || row.status === 'CANCELED';
  const refDateStr = row.last_activity_at || row.created_at;
  const refTime = refDateStr ? new Date(refDateStr).getTime() : Date.now();
  const diffMs = Math.max(0, Date.now() - (Number.isNaN(refTime) ? Date.now() : refTime));
  const inactiveDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  const is_inactive_30d = !isClosed && diffMs >= THIRTY_DAYS_MS;
  const isStatusChanged =
    row.status !== row.initial_status || Number(row.status_change_count || 0) > 0;
  const hasActivities = Number(row.activity_count || 0) > 0;
  const can_delete = !isStatusChanged && !hasActivities;

  return {
    ...row,
    amount: Number(row.amount || 0),
    status_change_count: Number(row.status_change_count || 0),
    activity_count: Number(row.activity_count || 0),
    inactive_days: inactiveDays,
    is_inactive_30d,
    can_delete,
  };
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: { service: 'pipeline-service', status: 'UP', port: PORT },
    message: '파이프라인 서비스 정상 작동 중',
  });
});

// 1. 파이프라인 전체 목록 조회 (GET /pipelines)
app.get('/pipelines', (_req, res) => {
  try {
    const rows = db
      .prepare('SELECT * FROM pipelines ORDER BY created_at DESC')
      .all();
    const data = rows.map(enrichPipeline);

    return res.json({
      success: true,
      data,
      message: '파이프라인 목록을 성공적으로 조회했습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] GET /pipelines error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `파이프라인 목록 조회 실패: ${err.message}`,
    });
  }
});

// 2. 단일 파이프라인 상세 조회 (GET /pipelines/:id)
app.get('/pipelines/:id', (req, res) => {
  try {
    const row = db
      .prepare('SELECT * FROM pipelines WHERE id = ?')
      .get(req.params.id);

    if (!row) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '해당 파이프라인을 찾을 수 없습니다.',
      });
    }

    const logs = db
      .prepare(
        'SELECT * FROM pipeline_status_logs WHERE pipeline_id = ? ORDER BY changed_at DESC'
      )
      .all(req.params.id);

    return res.json({
      success: true,
      data: {
        ...enrichPipeline(row),
        status_logs: logs,
      },
      message: '파이프라인 상세 정보를 조회했습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] GET /pipelines/:id error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `파이프라인 조회 실패: ${err.message}`,
    });
  }
});

// 3. 새 파이프라인 등록 (POST /pipelines)
app.post('/pipelines', (req, res) => {
  try {
    const {
      title,
      client_name,
      amount,
      status = 'LEAD',
      created_by,
      closing_date = null,
    } = req.body || {};

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '딜 제목(title)은 2자 이상 입력해 주세요.',
      });
    }

    if (!client_name || String(client_name).trim().length < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '거래처명(client_name)은 필수 입력 항목입니다.',
      });
    }

    const parsedAmount = Number(amount);
    if (amount === undefined || amount === null || amount === '' || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '올바른 금액을 0원 이상의 숫자로 입력해 주세요.',
      });
    }

    if (!created_by || String(created_by).trim().length < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '담당자(created_by)는 필수 입력 항목입니다.',
      });
    }

    const upperStatus = String(status).toUpperCase();
    if (!VALID_STATUSES.includes(upperStatus)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `유효하지 않은 진행 단계입니다. 허용 값: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const id = `pipe-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const nowIso = new Date().toISOString();
    const finalClosingDate =
      closing_date && String(closing_date).trim() !== ''
        ? String(closing_date).trim()
        : upperStatus === 'WON'
        ? todayDateStr()
        : null;
    const finalCanceledDate = upperStatus === 'CANCELED' ? nowIso : null;

    db.prepare(
      `INSERT INTO pipelines (
        id, title, client_name, amount, status, initial_status,
        status_change_count, activity_count, last_activity_at,
        created_by, closing_date, canceled_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?, ?, ?, ?)`
    ).run(
      id,
      String(title).trim(),
      String(client_name).trim(),
      Math.round(parsedAmount),
      upperStatus,
      upperStatus,
      String(created_by).trim(),
      finalClosingDate,
      finalCanceledDate,
      nowIso,
      nowIso
    );

    const created = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);

    return res.status(201).json({
      success: true,
      data: enrichPipeline(created),
      message: '파이프라인이 성공적으로 등록되었습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] POST /pipelines error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `파이프라인 등록 실패: ${err.message}`,
    });
  }
});

// 4. 파이프라인 단계 변경 (칸반 드래그 앤 드롭: PATCH /pipelines/:id/status)
app.patch('/pipelines/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, changed_by = '담당자' } = req.body || {};

    const existing = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '대상 파이프라인을 찾을 수 없습니다.',
      });
    }

    const nextStatus = String(status || '').toUpperCase();
    if (!VALID_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `유효하지 않은 상태값입니다. 허용 값: ${VALID_STATUSES.join(', ')}`,
      });
    }

    if (existing.status === nextStatus) {
      return res.json({
        success: true,
        data: enrichPipeline(existing),
        message: '동일한 단계입니다.',
      });
    }

    const nowIso = new Date().toISOString();
    const nextChangeCount = Number(existing.status_change_count || 0) + 1;
    let nextClosingDate = existing.closing_date;
    let nextCanceledDate = existing.canceled_date;

    if (nextStatus === 'WON' && !nextClosingDate) {
      nextClosingDate = todayDateStr();
    }
    if (nextStatus === 'CANCELED') {
      nextCanceledDate = nowIso;
    }

    db.prepare(
      `UPDATE pipelines
       SET status = ?,
           status_change_count = ?,
           closing_date = ?,
           canceled_date = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(nextStatus, nextChangeCount, nextClosingDate, nextCanceledDate, nowIso, id);

    const logId = `log-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    db.prepare(
      `INSERT INTO pipeline_status_logs (id, pipeline_id, from_status, to_status, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(logId, id, existing.status, nextStatus, changed_by, nowIso);

    const updated = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);

    return res.json({
      success: true,
      data: enrichPipeline(updated),
      message: '파이프라인 단계가 성공적으로 변경되었습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] PATCH /pipelines/:id/status error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `상태 변경 중 오류가 발생했습니다: ${err.message}`,
    });
  }
});

// 5. 파이프라인 기본 정보 수정 (PUT 또는 PATCH /pipelines/:id)
function updatePipelineHandler(req, res) {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '대상 파이프라인을 찾을 수 없습니다.',
      });
    }

    const {
      title = existing.title,
      client_name = existing.client_name,
      amount = existing.amount,
      closing_date = existing.closing_date,
      created_by = existing.created_by,
      status = existing.status,
    } = req.body || {};

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '딜 제목(title)은 2자 이상 입력해 주세요.',
      });
    }

    if (!client_name || String(client_name).trim().length < 1) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '거래처명(client_name)은 필수 입력 항목입니다.',
      });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '올바른 금액을 0원 이상의 숫자로 입력해 주세요.',
      });
    }

    const upperStatus = String(status).toUpperCase();
    if (!VALID_STATUSES.includes(upperStatus)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `유효하지 않은 진행 단계입니다.`,
      });
    }

    const nowIso = new Date().toISOString();
    const didStatusChange = upperStatus !== existing.status;
    const nextChangeCount = didStatusChange
      ? Number(existing.status_change_count || 0) + 1
      : Number(existing.status_change_count || 0);

    let nextClosingDate =
      closing_date && String(closing_date).trim() !== '' ? String(closing_date).trim() : null;
    if (upperStatus === 'WON' && !nextClosingDate) {
      nextClosingDate = todayDateStr();
    }
    const nextCanceledDate =
      upperStatus === 'CANCELED' ? existing.canceled_date || nowIso : existing.canceled_date;

    db.prepare(
      `UPDATE pipelines
       SET title = ?,
           client_name = ?,
           amount = ?,
           closing_date = ?,
           canceled_date = ?,
           created_by = ?,
           status = ?,
           status_change_count = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      String(title).trim(),
      String(client_name).trim(),
      Math.round(parsedAmount),
      nextClosingDate,
      nextCanceledDate,
      String(created_by).trim(),
      upperStatus,
      nextChangeCount,
      nowIso,
      id
    );

    if (didStatusChange) {
      const logId = `log-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
      db.prepare(
        `INSERT INTO pipeline_status_logs (id, pipeline_id, from_status, to_status, changed_by, changed_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(logId, id, existing.status, upperStatus, String(created_by).trim(), nowIso);
    }

    const updated = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
    return res.json({
      success: true,
      data: enrichPipeline(updated),
      message: '파이프라인 정보가 수정되었습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] UPDATE /pipelines/:id error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `파이프라인 수정 실패: ${err.message}`,
    });
  }
}

app.put('/pipelines/:id', updatePipelineHandler);
app.patch('/pipelines/:id', updatePipelineHandler);

// 6. 파이프라인 삭제 (DELETE /pipelines/:id) - 핵심 비즈니스 불변 규칙 검증
app.delete('/pipelines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '대상 파이프라인을 찾을 수 없습니다.',
      });
    }

    // [불변 규칙 1] 초기 생성 상태에서 상태가 한 번이라도 변경된 경우 삭제 불가
    const isStatusChanged =
      existing.status !== existing.initial_status ||
      Number(existing.status_change_count || 0) > 0;

    // [불변 규칙 2] 액티비티 서비스에 내부 HTTP 통신으로 활동 개수 실시간 질의
    let remoteActivityCount = Number(existing.activity_count || 0);
    try {
      const resp = await fetch(
        `${ACTIVITY_SERVICE_URL}/internal/activities/count?pipeline_id=${encodeURIComponent(id)}`
      );
      if (resp.ok) {
        const body = await resp.json();
        const verifiedCount =
          typeof body.count === 'number'
            ? body.count
            : body.data && typeof body.data.count === 'number'
            ? body.data.count
            : 0;
        remoteActivityCount = Math.max(remoteActivityCount, verifiedCount);
      }
    } catch (fetchErr) {
      console.warn(
        '[PipelineService] 액티비티 서비스 내부 검증 호출 실패, 로컬 캐시 카운트로 폴백:',
        fetchErr.message
      );
    }

    if (isStatusChanged || remoteActivityCount > 0) {
      return res.status(400).json({
        success: false,
        data: {
          id,
          activity_count: remoteActivityCount,
          status: existing.status,
          initial_status: existing.initial_status,
          status_change_count: Number(existing.status_change_count || 0),
        },
        message: '활동 이력이 존재하거나 상태가 변경된 영업건은 삭제할 수 없습니다.',
      });
    }

    db.prepare('DELETE FROM pipelines WHERE id = ?').run(id);

    return res.json({
      success: true,
      data: { id },
      message: '파이프라인이 안전하게 삭제되었습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] DELETE /pipelines/:id error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: `파이프라인 삭제 처리 중 오류가 발생했습니다: ${err.message}`,
    });
  }
});

// 7. 내부 MSA 동기화 API: 액티비티 등록 시 activity_count 및 last_activity_at 갱신
app.patch('/internal/pipelines/:id/activity-sync', (req, res) => {
  try {
    const { id } = req.params;
    const { activity_count, last_activity_at } = req.body || {};

    const existing = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        data: null,
        message: '대상 파이프라인을 찾을 수 없습니다.',
      });
    }

    const nextCount =
      typeof activity_count === 'number'
        ? activity_count
        : Number(existing.activity_count || 0) + 1;
    const nextLastActivityAt = last_activity_at || new Date().toISOString();
    const nowIso = new Date().toISOString();

    db.prepare(
      `UPDATE pipelines
       SET activity_count = ?,
           last_activity_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(nextCount, nextLastActivityAt, nowIso, id);

    const updated = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
    return res.json({
      success: true,
      data: enrichPipeline(updated),
      message: '파이프라인 활동 메타데이터가 동기화되었습니다.',
    });
  } catch (err) {
    console.error('[PipelineService] PATCH /internal/pipelines/:id/activity-sync error:', err);
    return res.status(500).json({
      success: false,
      data: null,
      message: err.message,
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ [Pipeline Service] running on http://localhost:${PORT}`);
  });
}

module.exports = { app };
