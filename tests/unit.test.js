const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const TEST_DATA_DIR = path.join(__dirname, 'tmp_unit_data');
if (fs.existsSync(TEST_DATA_DIR)) {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

process.env.PIPELINE_DB_PATH = path.join(TEST_DATA_DIR, 'unit_pipelines.sqlite');
process.env.ACTIVITY_DB_PATH = path.join(TEST_DATA_DIR, 'unit_activities.sqlite');

const { app: activityApp } = require('../services/activity-service/src/index');
const { app: pipelineApp } = require('../services/pipeline-service/src/index');

// In-memory Express request helper (no TCP socket required)
function invokeExpress(app, { method = 'GET', url = '/', query = {}, params = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      originalUrl: url,
      path: url.split('?')[0],
      query,
      params,
      body,
      headers: { 'content-type': 'application/json' },
      get(headerName) {
        return this.headers[headerName.toLowerCase()];
      },
    };

    const res = {
      statusCode: 200,
      headers: {},
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return this.headers[k.toLowerCase()];
      },
      json(payload) {
        this.headersSent = true;
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      end(data) {
        this.headersSent = true;
        resolve({ status: this.statusCode, body: data });
      },
    };

    try {
      app.handle(req, res, (err) => {
        if (err) reject(err);
        else resolve({ status: 404, body: null });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Mock global.fetch for internal MSA service-to-service communication in sandboxed tests
const originalFetch = global.fetch;
test.before(() => {
  global.fetch = async (urlStr, options = {}) => {
    const u = new URL(urlStr);
    if (u.port === '3002' && u.pathname === '/internal/activities/count') {
      const pipeline_id = u.searchParams.get('pipeline_id');
      const result = await invokeExpress(activityApp, {
        method: 'GET',
        url: `/internal/activities/count?pipeline_id=${pipeline_id}`,
        query: { pipeline_id },
      });
      return {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        json: async () => result.body,
      };
    }

    if (u.port === '3001' && u.pathname.startsWith('/internal/pipelines/')) {
      const parts = u.pathname.split('/');
      const id = decodeURIComponent(parts[3]);
      const parsedBody = options.body ? JSON.parse(options.body) : {};
      const result = await invokeExpress(pipelineApp, {
        method: options.method || 'PATCH',
        url: u.pathname,
        params: { id },
        body: parsedBody,
      });
      return {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        json: async () => result.body,
      };
    }

    return originalFetch(urlStr, options);
  };
});

test.after(() => {
  global.fetch = originalFetch;
});

test('1. 시드 데이터 적재 및 30일 미활동(is_inactive_30d) 플래그 자동 계산 검증', async () => {
  const res = await invokeExpress(pipelineApp, { method: 'GET', url: '/pipelines' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 6);

  const pipe001 = res.body.data.find((p) => p.id === 'pipe-001');
  assert.equal(pipe001.is_inactive_30d, true, 'pipe-001은 35일 미활동이므로 true여야 함');
  assert.equal(pipe001.can_delete, false);

  const pipe002 = res.body.data.find((p) => p.id === 'pipe-002');
  assert.equal(pipe002.is_inactive_30d, false);
  assert.equal(pipe002.can_delete, true, 'pipe-002는 초기 상태 + 활동 0건이므로 삭제 가능해야 함');

  const pipe005 = res.body.data.find((p) => p.id === 'pipe-005');
  assert.equal(pipe005.status, 'WON');
  assert.equal(pipe005.is_inactive_30d, false, '종결(WON) 딜은 30일 미활동에서 제외');
});

test('2. UC-01 & UC-05(시나리오 B): 신규 파이프라인 등록 후 조건 미충족 시 안전 삭제 성공', async () => {
  const createRes = await invokeExpress(pipelineApp, {
    method: 'POST',
    url: '/pipelines',
    body: {
      title: '신규 클라우드 구축 건',
      client_name: '(주)한화시스템',
      amount: 55000000,
      status: 'LEAD',
      created_by: '김영업',
    },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.data.can_delete, true);

  const newId = createRes.body.data.id;

  const delRes = await invokeExpress(pipelineApp, {
    method: 'DELETE',
    url: `/pipelines/${newId}`,
    params: { id: newId },
  });
  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
});

test('3. UC-02 & UC-05(시나리오 A-1): 상태가 한 번이라도 변경된 경우 원래 상태로 돌아와도 삭제 차단(400)', async () => {
  const createRes = await invokeExpress(pipelineApp, {
    method: 'POST',
    url: '/pipelines',
    body: {
      title: '상태 전이 보호 테스트',
      client_name: '(주)엘지유플러스',
      amount: 30000000,
      status: 'LEAD',
      created_by: '이담당',
    },
  });
  const id = createRes.body.data.id;

  // LEAD -> PROPOSAL 이동
  const move1 = await invokeExpress(pipelineApp, {
    method: 'PATCH',
    url: `/pipelines/${id}/status`,
    params: { id },
    body: { status: 'PROPOSAL' },
  });
  assert.equal(move1.status, 200);
  assert.equal(move1.body.data.status, 'PROPOSAL');
  assert.equal(move1.body.data.status_change_count, 1);

  // PROPOSAL -> LEAD(초기 상태)로 복귀
  const move2 = await invokeExpress(pipelineApp, {
    method: 'PATCH',
    url: `/pipelines/${id}/status`,
    params: { id },
    body: { status: 'LEAD' },
  });
  assert.equal(move2.status, 200);
  assert.equal(move2.body.data.status, 'LEAD');
  assert.equal(move2.body.data.status_change_count, 2);
  assert.equal(move2.body.data.can_delete, false);

  // 삭제 요청 시 400 Bad Request 차단 확인
  const delRes = await invokeExpress(pipelineApp, {
    method: 'DELETE',
    url: `/pipelines/${id}`,
    params: { id },
  });
  assert.equal(delRes.status, 400);
  assert.equal(delRes.body.success, false);
});

test('4. UC-03 & UC-05(시나리오 A-2): 액티비티가 1건 이상 등록된 파이프라인은 MSA 검증으로 삭제 차단(400)', async () => {
  const createRes = await invokeExpress(pipelineApp, {
    method: 'POST',
    url: '/pipelines',
    body: {
      title: '액티비티 보호 검증 딜',
      client_name: '(주)신세계아이앤씨',
      amount: 80000000,
      status: 'LEAD',
      created_by: '박매니저',
    },
  });
  const id = createRes.body.data.id;

  // 액티비티 1건 등록 -> 내부 동기화 API까지 자동 호출됨
  const actRes = await invokeExpress(activityApp, {
    method: 'POST',
    url: '/activities',
    body: {
      pipeline_id: id,
      activity_type: 'CALL',
      assignee: '박매니저',
      content: '초기 요구사항 유선 인터뷰 진행',
    },
  });
  assert.equal(actRes.status, 201);

  // 삭제 요청 시 액티비티 서비스 내부 검증을 통해 400 Bad Request 반환 확인
  const delRes = await invokeExpress(pipelineApp, {
    method: 'DELETE',
    url: `/pipelines/${id}`,
    params: { id },
  });
  assert.equal(delRes.status, 400);
  assert.equal(delRes.body.success, false);
});

test('5. UC-04: 30일 미활동 딜(pipe-001)에 새 액티비티 등록 시 미활동 경고(is_inactive_30d) 즉시 해제 검증', async () => {
  // 새 액티비티 등록 전에는 is_inactive_30d === true
  const beforeRes = await invokeExpress(pipelineApp, {
    method: 'GET',
    url: '/pipelines/pipe-001',
    params: { id: 'pipe-001' },
  });
  assert.equal(beforeRes.body.data.is_inactive_30d, true);

  // 오늘 날짜로 신규 액티비티 등록
  const actRes = await invokeExpress(activityApp, {
    method: 'POST',
    url: '/activities',
    body: {
      pipeline_id: 'pipe-001',
      activity_type: 'EMAIL',
      assignee: '홍길동',
      content: '재접촉 팔로업 견적서 발송 완료',
    },
  });
  assert.equal(actRes.status, 201);

  // 등록 후 즉시 is_inactive_30d === false로 해제되었는지 확인
  const afterRes = await invokeExpress(pipelineApp, {
    method: 'GET',
    url: '/pipelines/pipe-001',
    params: { id: 'pipe-001' },
  });
  assert.equal(afterRes.body.data.is_inactive_30d, false);
  assert.equal(afterRes.body.data.activity_count, 3);
});
