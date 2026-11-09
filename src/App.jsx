import React, { useState, useEffect, useCallback, useMemo } from 'react';
import KanbanBoard from './components/KanbanBoard';
import DetailModal from './components/DetailModal';
import CreateModal from './components/CreateModal';
import {
  fetchPipelines,
  createPipeline,
  updatePipelineStatus,
  updatePipeline,
  deletePipeline,
  createActivity,
} from './services/api';
import { formatKRW, STAGE_MAP } from './types/constants';

export default function App() {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterInactiveOnly, setFilterInactiveOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [gatewayConnected, setGatewayConnected] = useState(true);

  const showToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const loadPipelines = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchPipelines();
        setPipelines(res.data || []);
        setGatewayConnected(true);
      } catch (err) {
        setGatewayConnected(false);
        showToast(
          err.message ||
            '서버와의 통신에 실패했습니다. (API Gateway 상태 확인 필요)',
          'error'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // 30일 미활동 딜 개수 집계
  const inactiveCount = useMemo(
    () => pipelines.filter((p) => Boolean(p.is_inactive_30d)).length,
    [pipelines]
  );

  // 화면에 표시할 필터링된 파이프라인 목록
  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (filterInactiveOnly && !p.is_inactive_30d) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchClient = (p.client_name || '').toLowerCase().includes(q);
        const matchOwner = (p.created_by || '').toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchOwner) return false;
      }
      return true;
    });
  }, [pipelines, filterInactiveOnly, searchQuery]);

  // 상단 요약 지표 계산
  const summaryStats = useMemo(() => {
    const activeDeals = pipelines.filter(
      (p) => p.status !== 'WON' && p.status !== 'CANCELED'
    );
    const wonDeals = pipelines.filter((p) => p.status === 'WON');
    const activeAmount = activeDeals.reduce(
      (acc, cur) => acc + Number(cur.amount || 0),
      0
    );
    const wonAmount = wonDeals.reduce(
      (acc, cur) => acc + Number(cur.amount || 0),
      0
    );
    return {
      totalCount: pipelines.length,
      activeCount: activeDeals.length,
      activeAmount,
      wonCount: wonDeals.length,
      wonAmount,
    };
  }, [pipelines]);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) || null,
    [pipelines, selectedPipelineId]
  );

  // UC-01: 신규 파이프라인 등록
  const handleCreatePipeline = async (formData) => {
    try {
      const res = await createPipeline(formData);
      const created = res.data;
      setPipelines((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      showToast('새 파이프라인이 성공적으로 등록되었습니다.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // UC-02: 칸반 드래그 앤 드롭 단계 변경 (낙관적 업데이트 + 에러 시 자동 롤백)
  const handleMovePipelineStage = async (pipeline, targetStatus) => {
    const previousPipelines = pipelines;
    const targetStageInfo = STAGE_MAP[targetStatus];

    // 1. UI 즉시 반영 (Optimistic Update)
    setPipelines((prev) =>
      prev.map((item) =>
        item.id === pipeline.id
          ? {
              ...item,
              status: targetStatus,
              status_change_count: Number(item.status_change_count || 0) + 1,
              can_delete: false,
              is_inactive_30d:
                targetStatus === 'WON' || targetStatus === 'CANCELED'
                  ? false
                  : item.is_inactive_30d,
            }
          : item
      )
    );

    // 2. API Gateway 호출 (PATCH /api/pipelines/:id/status)
    try {
      const res = await updatePipelineStatus(
        pipeline.id,
        targetStatus,
        pipeline.created_by
      );
      const updated = res.data;
      setPipelines((prev) =>
        prev.map((item) => (item.id === pipeline.id ? updated : item))
      );
      showToast(
        `'${pipeline.client_name}' 딜이 [${targetStageInfo?.shortLabel || targetStatus}] 단계로 이동되었습니다.`,
        'success'
      );
    } catch (err) {
      // 4a. 실패 시 원래 컬럼으로 롤백 (UC-02 예외 흐름)
      setPipelines(previousPipelines);
      showToast(`상태 변경 저장 실패: ${err.message}`, 'error');
    }
  };

  // FR-03-2: 상세 모달에서 기본 정보 수정
  const handleUpdatePipeline = async (id, updateData) => {
    try {
      const res = await updatePipeline(id, updateData);
      const updated = res.data;
      setPipelines((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
      showToast('파이프라인 기본 정보가 저장되었습니다.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // UC-05: 파이프라인 안전 삭제
  const handleDeletePipeline = async (id) => {
    try {
      await deletePipeline(id);
      setPipelines((prev) => prev.filter((item) => item.id !== id));
      setSelectedPipelineId(null);
      showToast('파이프라인이 안전하게 삭제되었습니다.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // UC-03: 신규 액티비티 등록 및 파이프라인 메타데이터 즉시 갱신
  const handleAddActivity = async (activityPayload) => {
    try {
      const res = await createActivity(activityPayload);
      const created = res.data;
      await loadPipelines(true);
      showToast('새 영업 액티비티가 기록되었습니다.', 'success');
      return created;
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 우측 상단 토스트 알림 (FD.md 4장 예외 처리 및 피드백) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg transition-all ${
              toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-white text-slate-800 border-slate-200'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="opacity-75 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 상단 네비게이션 및 컨트롤 헤더 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 좌측 브랜드 및 MSA 상태 표시 */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-xs">
                S
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    영업 파이프라인 관리 시스템
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                      gatewayConnected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        gatewayConnected ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {gatewayConnected ? 'API Gateway 연결됨' : 'Gateway 오프라인'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  카드를 드래그하여 단계를 이동하거나 클릭하여 액티비티 타임라인을 기록하세요.
                </p>
              </div>
            </div>

            {/* 우측 필터 & 액션 버튼 (FR-02-1, FR-04-3) */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* 검색창 */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="거래처, 딜 제목, 담당자 검색..."
                  className="w-52 sm:w-60 rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* FR-04-3: [⚠️ 주의 필요한 딜 모아보기 (N건)] 토글 버튼 */}
              <button
                type="button"
                onClick={() => setFilterInactiveOnly((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  filterInactiveOnly
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : inactiveCount > 0
                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>⚠️ 주의 필요한 딜 모아보기 ({inactiveCount}건)</span>
              </button>

              {/* 새로고침 */}
              <button
                type="button"
                onClick={() => loadPipelines()}
                title="데이터 새로고침"
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                ↻ 새로고침
              </button>

              {/* FR-02-1: [+ 새 파이프라인 등록] 버튼 */}
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                <span>+ 새 파이프라인 등록</span>
              </button>
            </div>
          </div>

          {/* 상단 KPI 요약 바 */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <span>
                전체 딜:{' '}
                <strong className="text-slate-900">
                  {summaryStats.totalCount}건
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                진행 중 파이프라인 ({summaryStats.activeCount}건):{' '}
                <strong className="text-indigo-600">
                  {formatKRW(summaryStats.activeAmount)}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                수주 완료 ({summaryStats.wonCount}건):{' '}
                <strong className="text-emerald-600">
                  {formatKRW(summaryStats.wonAmount)}
                </strong>
              </span>
            </div>

            {filterInactiveOnly && (
              <div className="flex items-center gap-2 text-rose-600 font-semibold">
                <span>
                  현재 30일 이상 미활동 위험 딜만 필터링하여 표시 중입니다.
                </span>
                <button
                  type="button"
                  onClick={() => setFilterInactiveOnly(false)}
                  className="underline hover:text-rose-800 cursor-pointer"
                >
                  필터 해제
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 메인 칸반보드 영역 */}
      <main className="flex-1 mx-auto w-full max-w-[1800px] px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-96 text-sm text-slate-500">
            파이프라인 칸반보드를 불러오는 중입니다...
          </div>
        ) : (
          <KanbanBoard
            pipelines={filteredPipelines}
            onSelectCard={(pipe) => setSelectedPipelineId(pipe.id)}
            onMovePipelineStage={handleMovePipelineStage}
          />
        )}
      </main>

      {/* 파이프라인 상세 조회/수정 & 액티비티 타임라인 모달 (FR-03) */}
      {selectedPipeline && (
        <DetailModal
          pipeline={selectedPipeline}
          onClose={() => setSelectedPipelineId(null)}
          onUpdatePipeline={handleUpdatePipeline}
          onDeletePipeline={handleDeletePipeline}
          onAddActivity={handleAddActivity}
          showToast={showToast}
        />
      )}

      {/* 신규 파이프라인 등록 모달 (FR-02) */}
      {isCreateOpen && (
        <CreateModal
          onClose={() => setIsCreateOpen(false)}
          onCreatePipeline={handleCreatePipeline}
        />
      )}
    </div>
  );
}
