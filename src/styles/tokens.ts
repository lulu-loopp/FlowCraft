export const NodeColors = {
  agent: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-500',
    text: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700',
    hex: '#6366f1'
  },
  tool: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    hex: '#10b981'
  },
  skill: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    hex: '#f59e0b'
  },
  human: {
    bg: 'bg-rose-50',
    border: 'border-rose-500',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    hex: '#f43f5e'
  },
  io: {
    bg: 'bg-sky-50',
    border: 'border-sky-500',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
    hex: '#0ea5e9'
  },
  control: {
    bg: 'bg-slate-50',
    border: 'border-slate-500',
    text: 'text-slate-700',
    badge: 'bg-slate-100 text-slate-700',
    hex: '#64748b'
  },
  system: {
    bg: 'bg-violet-50',
    border: 'border-violet-500',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    hex: '#8b5cf6'
  },
  output: {
    bg: 'bg-slate-100',
    border: 'border-slate-400',
    text: 'text-slate-600',
    badge: 'bg-slate-200 text-slate-600',
    hex: '#64748b'
  }
} as const;

export type NodeType = keyof typeof NodeColors;

export const FlowStatusColors = {
  running: 'text-blue-500 bg-blue-50 border-blue-200',
  success: 'text-green-500 bg-green-50 border-green-200',
  waiting: 'text-gray-500 bg-gray-50 border-gray-200',
  error: 'text-red-500 bg-red-50 border-red-200',
} as const;
