import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';
import { useFlowStore } from '@/store/flowStore';

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  animated,
  selected,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    useFlowStore.getState().setEdges(
      useFlowStore.getState().edges.filter(e => e.id !== id)
    );
  };

  const isRunning = data?.status === 'running';
  const isError = data?.status === 'error';

  let edgeColor = '#94a3b8';
  if (isRunning) edgeColor = '#0d9488';
  if (isError) edgeColor = '#f43f5e';
  if (selected) edgeColor = '#0d9488';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isRunning || selected ? 3 : 2,
          stroke: edgeColor,
          strokeDasharray: isRunning ? '5 5' : 'none',
          filter: selected ? 'drop-shadow(0 0 6px rgba(13,148,136,0.5))' : 'none',
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
      />

      {selected && (
        <foreignObject
          width={32}
          height={32}
          x={labelX - 16}
          y={labelY - 16}
          className="pointer-events-auto"
        >
          <div className="edge-delete-btn flex items-center justify-center w-8 h-8">
            <button
              className="flex items-center justify-center w-7 h-7 bg-white border-2 border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:border-rose-300 hover:shadow-md transition-colors active:scale-90 cursor-pointer shadow-lg"
              onClick={onEdgeClick}
              title="Delete Edge"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </foreignObject>
      )}
    </>
  );
}
