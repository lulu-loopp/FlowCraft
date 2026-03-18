'use client';

import React, { Suspense, lazy } from 'react';
import type { AnimationType } from '@/lib/presets/help';

const demos: Record<AnimationType, React.LazyExoticComponent<React.ComponentType<{ className?: string }>>> = {
  agent: lazy(() => import('./demos/agent-demo').then(m => ({ default: m.AgentDemo }))),
  tool: lazy(() => import('./demos/tool-demo').then(m => ({ default: m.ToolDemo }))),
  skill: lazy(() => import('./demos/skill-demo').then(m => ({ default: m.SkillDemo }))),
  human: lazy(() => import('./demos/human-demo').then(m => ({ default: m.HumanDemo }))),
  condition: lazy(() => import('./demos/condition-demo').then(m => ({ default: m.ConditionDemo }))),
  merge: lazy(() => import('./demos/merge-demo').then(m => ({ default: m.MergeDemo }))),
  input: lazy(() => import('./demos/input-demo').then(m => ({ default: m.InputDemo }))),
  output: lazy(() => import('./demos/output-demo').then(m => ({ default: m.OutputDemo }))),
  initializer: lazy(() => import('./demos/initializer-demo').then(m => ({ default: m.InitializerDemo }))),
  'coding-agent': lazy(() => import('./demos/coding-agent-demo').then(m => ({ default: m.CodingAgentDemo }))),
  packed: lazy(() => import('./demos/packed-demo').then(m => ({ default: m.PackedDemo }))),
};

interface NodeDemoAnimationProps {
  animationType: AnimationType;
  className?: string;
}

export function NodeDemoAnimation({ animationType, className }: NodeDemoAnimationProps) {
  const Demo = demos[animationType];
  if (!Demo) return null;

  return (
    <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">Loading...</div>}>
      <Demo className={className} />
    </Suspense>
  );
}
