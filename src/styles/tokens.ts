export const NodeColors = {
  agent: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-500',
    text: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-700',
    hex: '#6366f1'
  },
  tool: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-500',
    text: 'text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
    hex: '#06b6d4'
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
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    hex: '#10b981'
  },
  packed: {
    bg: 'bg-violet-50',
    border: 'border-violet-500',
    text: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    hex: '#7c3aed'
  },
  aiCodingAgent: {
    bg: 'bg-orange-50',
    border: 'border-[#D97757]',
    text: 'text-orange-900',
    badge: 'bg-orange-100 text-orange-900',
    hex: '#D97757'
  },
  merge: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    hex: '#a855f7'
  },
  dispatcher: {
    bg: 'bg-teal-50',
    border: 'border-teal-500',
    text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700',
    hex: '#14b8a6'
  }
} as const;

export const AiCodingAgentColors = {
  claudeCode: {
    headerBg: '#D97757',
    bodyBg: '#FDF0E9',
    bg: 'bg-orange-50',
    border: 'border-[#D97757]',
    text: 'text-orange-900',
    hex: '#D97757',
  },
  codex: {
    headerBg: '#0D0D0D',
    bodyBg: '#F3F4F6',
    bg: 'bg-gray-50',
    border: 'border-[#0D0D0D]',
    text: 'text-gray-900',
    hex: '#0D0D0D',
  },
} as const;

export type NodeType = keyof typeof NodeColors;

export const FlowStatusColors = {
  running: 'text-blue-500 bg-blue-50 border-blue-200',
  success: 'text-green-500 bg-green-50 border-green-200',
  waiting: 'text-gray-500 bg-gray-50 border-gray-200',
  error: 'text-red-500 bg-red-50 border-red-200',
} as const;
