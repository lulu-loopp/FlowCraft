# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
```

No test runner is configured — `@playwright/test` is installed for E2E use only.

## Architecture Overview

FlowCraft is a **Next.js 16 App Router** application for building and running AI agent workflows visually. Two main surfaces:

1. **Canvas** (`/canvas/[flowId]`) — ReactFlow-based visual flow editor
2. **Playground** (`/playground`) — Agent chat/test interface

### State Management (Zustand)

Three stores, no cross-store imports:

- **`flowStore`** (`src/store/flowStore.ts`) — Nodes, edges, execution logs, run state. The single source of truth for canvas state.
- **`uiStore`** (`src/store/uiStore.ts`) — Language toggle (en/zh), persisted to `localStorage` as `flowcraft-ui`. Exposes `t(key)` for translations.
- **`agent-store`** (`src/store/agent-store.ts`) — Playground agent config, chat history, tools/skills/agents registry.

### Internationalization

All UI strings use `src/lib/i18n.ts` (inline `translations` object, `en` + `zh`). Access via `const { t } = useUIStore()` in components. **Not** next-intl.

### Canvas / ReactFlow

- **`src/components/canvas/flow-editor.tsx`** — Root canvas component with drag-and-drop node creation, wraps everything in `ReactFlowProvider`.
- **`src/components/canvas/nodes/index.ts`** — Registers all custom node types (`nodeTypes` object passed to `<ReactFlow>`).
- **Node types**: `input`, `output`, `agent`, `base` (generic). `InputNode` and `OutputNode` use ReactFlow's built-in type names — their CSS overrides in `globals.css` are critical to avoid selection flash/border artifacts.
- **`src/components/canvas/custom-edge.tsx`** — Animated custom edge with delete button.

### Layout

Canvas page layout is composed of four panels around a center canvas:
- `LeftPanel` (256px) — node palette + saved agents
- `RightPanel` (320px) — node config (agent settings, files, history)
- `TopToolbar` — flow name, run/stop, language toggle
- `BottomPanel` (224px expanded / 46px collapsed) — execution logs + terminal tab

Panel dimension tokens are defined in `globals.css` as CSS custom properties (`--panel-left-w`, `--panel-right-w`, etc.).

### API Routes (`src/app/api/`)

All server-side AI calls. Key routes:
- `agent/run/route.ts` — Executes an agent with tools
- `agent/chat/route.ts` — Single-turn chat (Playground)
- `skills/route.ts`, `agents/route.ts` — File-system registry management

AI providers: Anthropic Claude (`@anthropic-ai/sdk`) and OpenAI (`openai`). MCP support via `@modelcontextprotocol/sdk`.

### Styling

- **Tailwind CSS v4** — config-less, uses `@import "tailwindcss"` in `globals.css`.
- Design tokens (colors, z-index scale, panel dimensions) are CSS custom properties in `:root` in `globals.css`.
- Accent color: teal-600 (`#0d9488`). Avoid introducing secondary accent colors.
- `.glass-panel` utility class for frosted-glass panels.
- ReactFlow default selection styles for `input`/`output` built-in node types are neutralized in `globals.css` — do not remove those overrides.

### File System Skills & Agents

Skills and agents are stored on disk and scanned at runtime:
- Skills: `~/.claude/skills/` (global) or project `skills/` dir
- Agents: `agents/` directory at project root
- `src/lib/skills/` and `src/lib/agents/` contain the loader/scanner utilities

## 调试方法

1. 运行 `npm run dev` 启动应用，日志输出到 logs/app.log
2. 遇到Bug先看日志，再修改代码，再验证
3. 运行 `npm test` 确认修复没有引入新问题
