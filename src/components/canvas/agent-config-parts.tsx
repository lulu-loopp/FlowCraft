'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// ── Per-node-type theme for config panel interactions ────────────────────────
export interface ConfigTheme {
  focusRing: string;
  chipActive: string;
  chipHover: string;
  dropdownSelected: string;
  linkText: string;
  addCriteriaBtn: string;
  accentColor: string;
}

export const NODE_CONFIG_THEMES: Record<string, ConfigTheme> = {
  agent: {
    focusRing: 'focus:ring-indigo-500 focus:border-indigo-400',
    chipActive: 'bg-indigo-600 text-white border-indigo-500 shadow-sm',
    chipHover: 'hover:border-indigo-200 hover:bg-indigo-50/50',
    dropdownSelected: 'text-indigo-700 font-medium bg-indigo-50',
    linkText: 'text-indigo-600',
    addCriteriaBtn: 'text-indigo-700 border-indigo-100 hover:bg-indigo-50',
    accentColor: '#6366f1',
  },
  tool: {
    focusRing: 'focus:ring-cyan-500 focus:border-cyan-400',
    chipActive: 'bg-cyan-600 text-white border-cyan-500 shadow-sm',
    chipHover: 'hover:border-cyan-200 hover:bg-cyan-50/50',
    dropdownSelected: 'text-cyan-700 font-medium bg-cyan-50',
    linkText: 'text-cyan-600',
    addCriteriaBtn: 'text-cyan-700 border-cyan-100 hover:bg-cyan-50',
    accentColor: '#06b6d4',
  },
  skill: {
    focusRing: 'focus:ring-amber-500 focus:border-amber-400',
    chipActive: 'bg-amber-600 text-white border-amber-500 shadow-sm',
    chipHover: 'hover:border-amber-200 hover:bg-amber-50/50',
    dropdownSelected: 'text-amber-700 font-medium bg-amber-50',
    linkText: 'text-amber-600',
    addCriteriaBtn: 'text-amber-700 border-amber-100 hover:bg-amber-50',
    accentColor: '#f59e0b',
  },
  human: {
    focusRing: 'focus:ring-rose-500 focus:border-rose-400',
    chipActive: 'bg-rose-600 text-white border-rose-500 shadow-sm',
    chipHover: 'hover:border-rose-200 hover:bg-rose-50/50',
    dropdownSelected: 'text-rose-700 font-medium bg-rose-50',
    linkText: 'text-rose-600',
    addCriteriaBtn: 'text-rose-700 border-rose-100 hover:bg-rose-50',
    accentColor: '#f43f5e',
  },
  io: {
    focusRing: 'focus:ring-sky-500 focus:border-sky-400',
    chipActive: 'bg-sky-600 text-white border-sky-500 shadow-sm',
    chipHover: 'hover:border-sky-200 hover:bg-sky-50/50',
    dropdownSelected: 'text-sky-700 font-medium bg-sky-50',
    linkText: 'text-sky-600',
    addCriteriaBtn: 'text-sky-700 border-sky-100 hover:bg-sky-50',
    accentColor: '#0ea5e9',
  },
  condition: {
    focusRing: 'focus:ring-slate-500 focus:border-slate-400',
    chipActive: 'bg-slate-600 text-white border-slate-500 shadow-sm',
    chipHover: 'hover:border-slate-300 hover:bg-slate-50',
    dropdownSelected: 'text-slate-700 font-medium bg-slate-100',
    linkText: 'text-slate-600',
    addCriteriaBtn: 'text-slate-700 border-slate-200 hover:bg-slate-50',
    accentColor: '#64748b',
  },
  initializer: {
    focusRing: 'focus:ring-violet-500 focus:border-violet-400',
    chipActive: 'bg-violet-600 text-white border-violet-500 shadow-sm',
    chipHover: 'hover:border-violet-200 hover:bg-violet-50/50',
    dropdownSelected: 'text-violet-700 font-medium bg-violet-50',
    linkText: 'text-violet-600',
    addCriteriaBtn: 'text-violet-700 border-violet-100 hover:bg-violet-50',
    accentColor: '#8b5cf6',
  },
  aiCodingAgent: {
    focusRing: 'focus:ring-[#D97757] focus:border-[#D97757]',
    chipActive: 'bg-[#D97757] text-white border-[#D97757] shadow-sm',
    chipHover: 'hover:border-orange-200 hover:bg-orange-50/50',
    dropdownSelected: 'text-orange-800 font-medium bg-orange-50',
    linkText: 'text-[#D97757]',
    addCriteriaBtn: 'text-orange-800 border-orange-100 hover:bg-orange-50',
    accentColor: '#D97757',
  },
};

export const ConfigThemeCtx = React.createContext<ConfigTheme>(NODE_CONFIG_THEMES.agent);

// ── Custom dropdown with portal (avoids overflow-y-auto clipping) ───────────
export interface DropdownOption { value: string; label: string }

export function DropdownSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
}) {
  const theme = React.useContext(ConfigThemeCtx);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as unknown as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener('scroll', handler, true);
    return () => document.removeEventListener('scroll', handler, true);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  const currentLabel = options.find(o => o.value === value)?.label ?? value;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`w-full flex items-center justify-between p-2.5 text-sm rounded-lg border border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white focus:ring-2 ${theme.focusRing} outline-none cursor-pointer transition-all`}
      >
        <span className="text-slate-700">{currentLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 'var(--z-dropdown)', animation: 'dropdown-in 0.12s ease-out' } as React.CSSProperties}
          className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                opt.value === value
                  ? theme.dropdownSelected
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Toggle chip ──────────────────────────────────────────────────────────────
export function ToggleChip({
  label,
  checked,
  onChange,
  disabled,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  const theme = React.useContext(ConfigThemeCtx);
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      title={title}
      className={`relative flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 border transition-all text-left ${
        disabled
          ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60'
          : checked
            ? theme.chipActive
            : `bg-white text-slate-600 border-slate-200 ${theme.chipHover}`
      }`}
    >
      {checked && !disabled && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white/70" />
      )}
      <span className="truncate pr-2">{label}</span>
    </button>
  );
}
