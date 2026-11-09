import React, { useState, useEffect } from 'react';
import ActivityTable from './ActivityTable';
import { PIPELINE_STAGES, STAGE_MAP, formatKRW } from '../types/constants';
import { fetchActivities, fetchPipelineById } from '../services/api';

const DELETE_BLOCK_TOOLTIP =
  '활동 이력이 있거나 단계가 변경된 영업건은 데이터 무결성을 위해 삭제할 수 없습니다.';

export default function DetailModal({
  pipeline,
  onClose,
  onUpdatePipeline,
  onDeletePipeline,
  onAddActivity,
  showToast,
}) {
  const [title, setTitle] = useState(pipeline.title || '');
  const [clientName, setClientName] = useState(pipeline.client_name || '');
  const [amountInput, setAmountInput] = useState(String(pipeline.amount ?? 0));
  const [status, setStatus] = useState(pipeline.status || 'LEAD');
  const [createdBy, setCreatedBy] = useState(pipeline.created_by || '');
  const [closingDate, setClosingDate] = useState(pipeline.closing_date || '');

  const [activities, setActivities] = useState([]);
  const [statusLogs, setStatusLogs] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    setTitle(pipeline.title || '');
    setClientName(pipeline.client_name || '');
    setAmountInput(String(pipeline.amount ?? 0));
    setStatus(pipeline.status || 'LEAD');
    setCreatedBy(pipeline.created_by || '');
    setClosingDate(pipeline.closing_date || '');
  }, [pipeline]);

  useEffect(() => {
    let mounted = true;
    async function loadDetailAndActivities() {
      setLoadingActivities(true);
      try {
        const [actRes, detailRes] = await Promise.all([
          fetchActivities(pipeline.id),
          fetchPipelineById(pipeline.id),
        ]);
        if (!mounted) return;
        setActivities(actRes.data || []);
        setStatusLogs(detailRes.data?.status_logs || []);
      } catch (err) {
        if (mounted && showToast) {
          showToast(err.message, 'error');
        }
      } finally {
        if (mounted) setLoadingActivities(false);
      }
    }
    loadDetailAndActivities();
    return () => {
      mounted = false;
    };
  }, [pipeline.id, showToast]);

  // 삭제 불가 조건 판별 (FR-05-1, FR-05-2)
  // 1) 액티비티가 1건 이상 존재하거나
  // 2) 초기 생성 상태에서 상태가 한 번이라도 변경된 경우
  const effectiveActivityCount = Math.max(
    Number(pipeline.activity_count || 0),
    activities.length
  );
  const isStatusEverChanged =
    pipeline.status !== pipeline.initial_status ||
    Number(pipeline.status_change_count || 0) > 0 ||
    statusLogs.length > 0;
  const isDeleteBlocked = effectiveActivityCount > 0 || isStatusEverChanged;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title || title.trim().length < 2) {
      setFieldError('딜 제목은 2자 이상 입력해 주세요.');
      return;
    }
    if (!clientName || !clientName.trim()) {
      setFieldError('거래처명을 입력해 주세요.');
      return;
    }
    const numericAmount = Number(amountInput);
    if (
      amountInput === '' ||
      Number.isNaN(numericAmount) ||
      numericAmount < 0 ||
      !/^\d+(\.\d+)?$/.test(String(amountInput).trim())
    ) {
      setFieldError('올바른 금액을 숫자로 입력해 주세요');
      return;
    }
    if (!createdBy || !createdBy.trim()) {
      setFieldError('담당자를 입력해 주세요.');
      return;
    }

    setFieldError('');
    setSaving(true);
    try {
      await onUpdatePipeline(pipeline.id, {
        title: title.trim(),
        client_name: clientName.trim(),
        amount: Math.round(numericAmount),
        status,
        created_by: createdBy.trim(),
        closing_date: closingDate || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddActivityItem = async (newActInput) => {
    const created = await onAddActivity({
      pipeline_id: pipeline.id,
      ...newActInput,
    });
    if (created) {
      setActivities((prev) => [created, ...prev]);
    }
  };

  const handleDeleteClick = async () => {
    if (isDeleteBlocked) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDeletePipeline(pipeline.id);
    } finally {
      setDeleting(false);
    }
  };

  const currentStage = STAGE_MAP[pipeline.status] || STAGE_MAP.LEAD;
  const initialStage = STAGE_MAP[pipeline.initial_status] || STAGE_MAP.LEAD;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${currentStage.badgeClass}`}
              >
                {currentStage.label}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ID: {pipeline.id}
              </span>
              {pipeline.is_inactive_30d && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  ⚠️ 30일 미활동 ({pipeline.inactive_days ?? 30}일 경과)
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {pipeline.client_name} — {pipeline.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {/* 기본 정보 조회 및 수정 폼 (FR-03-2) */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                📌 파이프라인 기본 정보
              </h3>
              <span className="text-xs text-slate-500">
                최초 등록 단계: <strong>{initialStage.shortLabel}</strong> | 상태 변경 횟수:{' '}
                <strong>{Math.max(Number(pipeline.status_change_count || 0), statusLogs.length)}회</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  거래처명 (고객사) *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    if (fieldError) setFieldError('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  딜 제목 *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldError) setFieldError('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  예상 금액 (₩) *{' '}
                  <span className="font-normal text-indigo-600">
                    ({formatKRW(amountInput)})
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    if (fieldError) setFieldError('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  진행 단계 (Status)
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  {PIPELINE_STAGES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  담당자 *
                </label>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => {
                    setCreatedBy(e.target.value);
                    if (fieldError) setFieldError('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  목표 마감일
                </label>
                <input
                  type="date"
                  value={closingDate || ''}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {fieldError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600">
                {fieldError}
              </div>
            )}

            {/* 수정 저장 & 삭제 버튼 영역 (FR-05-2) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* 좌측: 삭제 버튼 + 툴팁 */}
              <div className="relative group inline-flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeleteBlocked || deleting}
                  onClick={handleDeleteClick}
                  title={isDeleteBlocked ? DELETE_BLOCK_TOOLTIP : '파이프라인 삭제'}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold border transition-all ${
                    isDeleteBlocked
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : confirmDelete
                      ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 cursor-pointer'
                      : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 cursor-pointer'
                  }`}
                >
                  {deleting
                    ? '삭제 중...'
                    : confirmDelete
                    ? '정말 삭제하시겠습니까? (클릭 시 확정)'
                    : '🗑️ 삭제'}
                </button>

                {confirmDelete && !isDeleteBlocked && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
                  >
                    취소
                  </button>
                )}

                {/* 삭제 차단 시 호버 툴팁 & 인라인 안내 배지 */}
                {isDeleteBlocked && (
                  <>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      🔒 삭제 보호됨 ({effectiveActivityCount > 0 ? `활동 ${effectiveActivityCount}건` : '단계 변경 이력 존재'})
                    </span>
                    <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block w-80 rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg z-20">
                      {DELETE_BLOCK_TOOLTIP}
                    </div>
                  </>
                )}
              </div>

              {/* 우측: 기본정보 저장 버튼 */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  {saving ? '저장 중...' : '기본 정보 수정 저장'}
                </button>
              </div>
            </div>
          </form>

          {/* 구분선 */}
          <hr className="border-slate-200" />

          {/* 액티비티 타임라인 표 및 등록 폼 (FR-03-3, FR-03-4) */}
          <ActivityTable
            activities={activities}
            loading={loadingActivities}
            defaultAssignee={pipeline.created_by}
            onAddActivity={handleAddActivityItem}
          />
        </div>
      </div>
    </div>
  );
}
