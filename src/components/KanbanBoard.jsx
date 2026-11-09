import React, { useState } from 'react';
import KanbanColumn from './KanbanColumn';
import { PIPELINE_STAGES } from '../types/constants';

export default function KanbanBoard({
  pipelines,
  onSelectCard,
  onMovePipelineStage,
}) {
  const [draggingPipeline, setDraggingPipeline] = useState(null);

  const handleDragStartCard = (e, pipeline) => {
    setDraggingPipeline(pipeline);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pipeline.id);
  };

  const handleDragEndCard = () => {
    setDraggingPipeline(null);
  };

  const handleDropStage = (targetStageCode) => {
    if (!draggingPipeline) return;
    const sourcePipeline = draggingPipeline;
    setDraggingPipeline(null);

    if (sourcePipeline.status !== targetStageCode) {
      onMovePipelineStage(sourcePipeline, targetStageCode);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1">
      {PIPELINE_STAGES.map((stage) => {
        const stagePipelines = pipelines.filter(
          (item) => item.status === stage.code
        );
        return (
          <KanbanColumn
            key={stage.code}
            stage={stage}
            pipelines={stagePipelines}
            onSelectCard={onSelectCard}
            onDragStartCard={handleDragStartCard}
            onDragEndCard={handleDragEndCard}
            onDropStage={handleDropStage}
            draggingId={draggingPipeline?.id || null}
          />
        );
      })}
    </div>
  );
}
