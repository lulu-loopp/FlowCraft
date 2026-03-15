'use client';

import React from 'react';
import { Panel } from '../ui/panel';
import { Bot, Wrench, Lightbulb, User, ArrowRightLeft, GitBranch, PlayCircle, Settings2 } from 'lucide-react';

const NODE_TYPES = [
  { type: 'agent', label: 'Agent', icon: Bot, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { type: 'tool', label: 'Tool', icon: Wrench, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { type: 'skill', label: 'Skill', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-50' },
  { type: 'human', label: 'Human', icon: User, color: 'text-rose-500', bg: 'bg-rose-50' },
  { type: 'io', label: 'I/O', icon: ArrowRightLeft, color: 'text-sky-500', bg: 'bg-sky-50' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'text-slate-500', bg: 'bg-slate-50' },
  { type: 'initializer', label: 'Initializer', icon: PlayCircle, color: 'text-violet-500', bg: 'bg-violet-50' },
];

export function LeftPanel() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Panel className="absolute top-24 bottom-4 left-4 w-64 flex flex-col overflow-hidden z-40">
      <div className="p-4 border-b border-slate-100/50">
        <h2 className="font-semibold text-sm text-slate-800 flex items-center">
          <Settings2 className="w-4 h-4 mr-2 text-slate-500" /> Elements
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Node Types</div>

        {NODE_TYPES.map((node) => {
          const Icon = node.icon;
          return (
            <div
              key={node.type}
              className={`flex items-center p-3 rounded-xl border border-slate-100 bg-white/60 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing`}
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
            >
              <div className={`p-2 rounded-lg ${node.bg} ${node.color} mr-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm text-slate-700">{node.label}</span>
            </div>
          );
        })}

        <div className="mt-8">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 pb-2 border-b border-slate-100">Saved Agents</div>
          <div className="text-sm text-slate-500 text-center py-4">No saved agents yet.</div>
        </div>
      </div>
    </Panel>
  );
}
