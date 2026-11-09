const express = require('express');
const cors = require('cors');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.GATEWAY_PORT || 3000);
const PIPELINE_SERVICE_URL = process.env.PIPELINE_SERVICE_URL || 'http://localhost:3001';
const ACTIVITY_SERVICE_URL = process.env.ACTIVITY_SERVICE_URL || 'http://localhost:3002';

app.use(cors());
app.use(express.json());

// 공통 요청 로깅 미들웨어
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[API Gateway] ${ts} | ${req.method} ${req.originalUrl}`);
  next();
});

// Gateway 및 하위 마이크로서비스 통합 상태 점검 API
app.get('/api/health', async (_req, res) => {
  const checkService = async (name, url) => {
    try {
      const resp = await fetch(`${url}/health`);
      return { name, status: resp.ok ? 'UP' : 'DOWN', url };
    } catch {
      return { name, status: 'DOWN', url };
    }
  };

  const [pipelineHealth, activityHealth] = await Promise.all([
    checkService('pipeline-service', PIPELINE_SERVICE_URL),
    checkService('activity-service', ACTIVITY_SERVICE_URL),
  ]);

  const allUp = pipelineHealth.status === 'UP' && activityHealth.status === 'UP';

  res.status(allUp ? 200 : 503).json({
    success: allUp,
    data: {
      gateway: { status: 'UP', port: PORT },
      services: [pipelineHealth, activityHealth],
    },
    message: allUp
      ? 'API Gateway 및 모든 마이크로서비스가 정상 작동 중입니다.'
      : '일부 마이크로서비스와 통신할 수 없습니다.',
  });
});

// 1. 파이프라인 서비스 라우팅 (/api/pipelines/* -> http://localhost:3001/pipelines/*)
app.use(
  '/api/pipelines',
  createProxyMiddleware({
    target: `${PIPELINE_SERVICE_URL}/pipelines`,
    changeOrigin: true,
    on: {
      proxyReq: fixRequestBody,
      error: (err, _req, res) => {
        console.error('[API Gateway] Pipeline Service Proxy Error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            data: null,
            message:
              '서버와의 통신에 실패했습니다. (파이프라인 서비스 상태 확인 필요)',
          });
        }
      },
    },
  })
);

// 2. 액티비티 서비스 라우팅 (/api/activities/* -> http://localhost:3002/activities/*)
app.use(
  '/api/activities',
  createProxyMiddleware({
    target: `${ACTIVITY_SERVICE_URL}/activities`,
    changeOrigin: true,
    on: {
      proxyReq: fixRequestBody,
      error: (err, _req, res) => {
        console.error('[API Gateway] Activity Service Proxy Error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            data: null,
            message:
              '서버와의 통신에 실패했습니다. (액티비티 서비스 상태 확인 필요)',
          });
        }
      },
    },
  })
);

// 알 수 없는 API 경로 처리
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: `존재하지 않는 API 경로입니다: ${req.originalUrl}`,
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 [API Gateway] running on http://localhost:${PORT}`);
    console.log(`   ├─ /api/pipelines  -> ${PIPELINE_SERVICE_URL}/pipelines`);
    console.log(`   └─ /api/activities -> ${ACTIVITY_SERVICE_URL}/activities`);
  });
}

module.exports = { app };
