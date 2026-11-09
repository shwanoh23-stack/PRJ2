const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// 테스트용 격리 SQLite DB 경로 설정
const TEST_DATA_DIR = path.join(__dirname, 'tmp_data');
if (fs.existsSync(TEST_DATA_DIR)) {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

process.env.PIPELINE_DB_PATH = path.join(TEST_DATA_DIR, 'test_pipelines.sqlite');
process.env.ACTIVITY_DB_PATH = path.join(TEST_DATA_DIR, 'test_activities.sqlite');

const { app: activityApp } = require('../services/activity-service/src/index');
const { app: pipelineApp } = require('../services/pipeline-service/src/index');
const { app: gatewayApp } = require('../services/api-gateway/src/index');

let activityServer;
let pipelineServer;
let gatewayServer;
const gatewayBaseUrl = 'http://127.0.0.1:3000';

test.before(async () => {
  await new Promise((resolve) => {
    activityServer = activityApp.listen(3002, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => {
    pipelineServer = pipelineApp.listen(3001, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => {
    gatewayServer = gatewayApp.listen(3000, '127.0.0.1', resolve);
  });
});

test.after(async () => {
  for (const srv of [gatewayServer, pipelineServer, activityServer]) {
    if (srv) {
      srv.closeAllConnections?.();
      await new Promise((resolve) => srv.close(() => resolve()));
    }
  }
  if (fs.existsSync(TEST_DATA_DIR)) {
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // ignore file lock cleanup errors on Windows
    }
  }
});

test('1. API Gateway 라우팅, 시드 데이터 및 30일 장기 미활동(is_inactive_30d) 판별 검증', async () => {
  const res = await fetch(`${gatewayBaseUrl}/api/pipelines`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 6);

  const pipe001 = body.data.find((p) => p.id === 'pipe-001');
  assert.ok(pipe001, 'pipe-001 시드 데이터가 존재해야 함');
  assert.equal(pipe001.is_inactive_30d, true, '35일 경과한 제안 딜은 30일 미활동이어야 함');
  assert.equal(pipe001.can_delete, false, '활동 및 상태변경이 있는 딜은 삭제 불가여야 함');

  const pipe005 = body.data.find((p) => p.id === 'pipe-005');
  assert.equal(pipe005.status, 'WON');
  assert.equal(pipe005.is_inactive_30d, false, '마무리(WON) 단계는 30일 미활동 대상에서 제외');
});

test('2. UC-01 & UC-05(시나리오 B): 신규 파이프라인 등록 후 활동/상태변경 없을 때 안전 삭제 허용', async () => {
  const createRes = await fetch(`${gatewayBaseUrl}/api/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '테스트 신규 영업건',
      client_name: '(주)테스트코퍼레이션',
      amount: 15000000,
      status: 'LEAD',
      created_by: '테스터',
    }),
  });
  assert.equal(createRes.status, 201);
  const createBody = await createRes.json();
  assert.equal(createBody.success, true);
  assert.equal(createBody.data.can_delete, true);

  const createdId = createBody.data.id;

  const delRes = await fetch(`${gatewayBaseUrl}/api/pipelines/${createdId}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200);
  const delBody = await delRes.json();
  assert.equal(delBody.success, true);
});

test('3. UC-02 & UC-05(시나리오 A-1): 상태가 한 번이라도 변경된 파이프라인은 원래 상태로 돌아와도 삭제 차단(400)', async () => {
  const createRes = await fetch(`${gatewayBaseUrl}/api/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '단계 변경 후 복귀 테스트 딜',
      client_name: '(주)상태검증',
      amount: 30000000,
      status: 'LEAD',
      created_by: '김검증',
    }),
  });
  const { data: created } = await createRes.json();

  // LEAD -> PROPOSAL로 변경
  const patch1 = await fetch(`${gatewayBaseUrl}/api/pipelines/${created.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PROPOSAL' }),
  });
  assert.equal(patch1.status, 200);

  // PROPOSAL -> LEAD(초기 상태)로 다시 복귀하더라도 status_change_count > 0 이므로 삭제 차단되어야 함
  const patch2 = await fetch(`${gatewayBaseUrl}/api/pipelines/${created.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'LEAD' }),
  });
  assert.equal(patch2.status, 200);
  const patch2Body = await patch2.json();
  assert.equal(patch2Body.data.can_delete, false);

  // 삭제 시도 -> 400 Bad Request 반환 검증
  const delRes = await fetch(`${gatewayBaseUrl}/api/pipelines/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 400);
  const delBody = await delRes.json();
  assert.equal(delBody.success, false);
});

test('4. UC-03 & UC-05(시나리오 A-2): 초기 상태 그대로여도 액티비티가 1건 이상 등록되면 MSA 검증을 통해 삭제 차단(400)', async () => {
  const createRes = await fetch(`${gatewayBaseUrl}/api/pipelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '액티비티 보호 테스트 딜',
      client_name: '(주)액티비티검증',
      amount: 42000000,
      status: 'LEAD',
      created_by: '박영업',
    }),
  });
  const { data: created } = await createRes.json();

  // API Gateway를 통해 액티비티 서비스에 활동 1건 등록
  const actRes = await fetch(`${gatewayBaseUrl}/api/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pipeline_id: created.id,
      activity_type: 'CALL',
      assignee: '박영업',
      content: '초기 도입 문의 유선 상담 완료',
    }),
  });
  assert.equal(actRes.status, 201);

  // 삭제 시도 -> 액티비티 서비스 내부 통신 검증에 의해 400 Bad Request 차단 확인
  const delRes = await fetch(`${gatewayBaseUrl}/api/pipelines/${created.id}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 400);
  const delBody = await delRes.json();
  assert.equal(delBody.success, false);
});
