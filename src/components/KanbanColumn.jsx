import React, { useState } from 'react';
import PipelineCard from './PipelineCard';
import { formatKRW } from '../types/constants';

export default function KanbanColumn({
  stage,
  pipelines,
  onSelectCard,
  onDragStartCard,
  onDragEndCard,
  onDropStage,
  draggingId,
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const count = pipelines.length;
  const totalAmount = pipelines.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    onDropStage(stage.code);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-72 shrink-0 rounded-2xl border border-slate-200/90 border-t-4 ${stage.headerAccent} bg-slate-100/80 transition-colors ${
        isDragOver ? 'ring-2 ring-indigo-400 bg-indigo-50/60' : ''
      }`}
    >
      {/* 컬럼 헤더: 단계명 + 건수 및 합계 금액 실시간 집계 (FR-01-2) */}
      <div className="p-3.5 bg-white rounded-t-xl border-b border-slate-200/80">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${stage.dotClass}`} />
            <h2 className="font-bold text-slate-800 text-sm">{stage.label}</h2>
          </div>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${stage.badgeClass}`}
          >
            {count}건
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
          <span className="text-slate-400">{stage.shortLabel} ({count}건)</span>
          <span className="font-semibold text-slate-700">
            합계 {formatKRW(totalAmount)}
          </span>
        </div>
      </div>

      {/* 컬럼 바디: 카드 목록 또는 빈 상태 플레이스홀더 */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[420px] max-h-[calc(100vh-230px)]">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 rounded-xl border border-dashed border-slate-300 bg-white/50 text-slate-400 text-xs">
            <span>진행 중인 딜이 없습니다</span>
          </div>
        ) : (
          pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              onSelect={onSelectCard}
              onDragStart={onDragStartCard}
              onDragEnd={onDragEndCard}
              isDragging={draggingId === pipeline.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
