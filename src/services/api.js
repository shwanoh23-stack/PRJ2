/**
 * API Gateway (http://localhost:3000)와 표준 JSON 포맷으로 통신하는 클라이언트 모듈
 * 모든 응답은 { success: boolean, data: any, message: string } 규격을 따름 (docs/api_specs.md)
 */

const GATEWAY_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000';

async function requestJson(path, options = {}) {
  const url = `${GATEWAY_BASE_URL}${path}`;
  let response;

  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (networkErr) {
    const error = new Error(
      '서버와의 통신에 실패했습니다. (API Gateway 상태 확인 필요)'
    );
    error.isNetworkError = true;
    error.cause = networkErr;
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {
      success: false,
      data: null,
      message: `서버 응답을 JSON으로 해석할 수 없습니다. (HTTP ${response.status})`,
    };
  }

  if (!response.ok || payload.success === false) {
    const error = new Error(
      payload.message || `요청 처리에 실패했습니다. (HTTP ${response.status})`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

// 1. 파이프라인 전체 목록 조회 (GET /api/pipelines)
export async function fetchPipelines() {
  return requestJson('/api/pipelines', { method: 'GET' });
}

// 2. 파이프라인 단일 상세 조회 (GET /api/pipelines/:id)
export async function fetchPipelineById(id) {
  return requestJson(`/api/pipelines/${encodeURIComponent(id)}`, { method: 'GET' });
}

// 3. 신규 파이프라인 등록 (POST /api/pipelines)
export async function createPipeline(pipelineData) {
  return requestJson('/api/pipelines', {
    method: 'POST',
    body: JSON.stringify(pipelineData),
  });
}

// 4. 파이프라인 단계 변경 - 칸반 드래그 앤 드롭 (PATCH /api/pipelines/:id/status)
export async function updatePipelineStatus(id, status, changedBy = '담당자') {
  return requestJson(`/api/pipelines/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, changed_by: changedBy }),
  });
}

// 5. 파이프라인 기본 정보 수정 (PUT /api/pipelines/:id)
export async function updatePipeline(id, updateData) {
  return requestJson(`/api/pipelines/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

// 6. 파이프라인 삭제 (DELETE /api/pipelines/:id)
export async function deletePipeline(id) {
  return requestJson(`/api/pipelines/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// 7. 특정 파이프라인의 액티비티 목록 조회 (GET /api/activities?pipeline_id=:id)
export async function fetchActivities(pipelineId) {
  return requestJson(
    `/api/activities?pipeline_id=${encodeURIComponent(pipelineId)}`,
    { method: 'GET' }
  );
}

// 8. 신규 액티비티 등록 (POST /api/activities)
export async function createActivity(activityData) {
  return requestJson('/api/activities', {
    method: 'POST',
    body: JSON.stringify(activityData),
  });
}

// 9. API Gateway 및 마이크로서비스 헬스 체크 (GET /api/health)
export async function checkGatewayHealth() {
  return requestJson('/api/health', { method: 'GET' });
}
