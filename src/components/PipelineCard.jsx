import React from 'react';
import { formatKRW } from '../types/constants';

export default function PipelineCard({
  pipeline,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
}) {
  const isInactive30d = Boolean(pipeline.is_inactive_30d);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, pipeline)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(pipeline)}
      className={`group relative cursor-grab active:cursor-grabbing rounded-xl border p-3.5 transition-all duration-150 select-none ${
        isDragging
          ? 'opacity-40 scale-95 border-indigo-400 bg-indigo-50/40'
          : isInactive30d
          ? 'bg-white border-rose-300 ring-1 ring-rose-200/80 shadow-xs hover:shadow-md hover:border-rose-400'
          : 'bg-white border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-300'
      }`}
    >
      {/* 상단: 거래처명(굵은 글씨) + 30일 미활동 경고 뱃지 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-bold text-slate-900 text-sm leading-snug break-keep">
          {pipeline.client_name}
        </span>

        {isInactive30d && (
          <span
            title={`최근 활동일로부터 ${pipeline.inactive_days ?? 30}일 경과`}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          >
            ⚠️ 30일 미활동
          </span>
        )}
      </div>

      {/* 딜 제목 */}
      <p className="text-xs text-slate-600 font-medium line-clamp-2 mb-3">
        {pipeline.title}
      </p>

      {/* 예상 금액 (₩ 단위 천단위 콤마) */}
      <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
        <span className="text-[11px] text-slate-400">예상 금액</span>
        <span className="text-sm font-bold text-slate-800 tracking-tight">
          {formatKRW(pipeline.amount)}
        </span>
      </div>

      {/* 하단 메타 정보: 마감일, 담당자, 액티비티 건수 */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
            👤 {pipeline.created_by}
          </span>
          {pipeline.closing_date && (
            <span className="text-slate-500" title="목표 마감일">
              📅 {pipeline.closing_date}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${
              pipeline.activity_count > 0
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-slate-100 text-slate-400'
            }`}
            title="등록된 액티비티 건수"
          >
            💬 {pipeline.activity_count || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
