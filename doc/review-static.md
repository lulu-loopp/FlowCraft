# FlowCraft — 静态分析 Review 报告
**Reviewer:** Codex  |  **Date:** 2026-03-20

## Executive Summary

**3 critical, 8 medium, 12 minor** issues identified.

The codebase is well-structured overall with good auth middleware (`requireMutationAuth`) applied consistently on mutation endpoints, proper path traversal protection in workspace routes, and a safe expression evaluator. The most critical findings are: (1) real API keys committed in `.env.local`, (2) several GET endpoints lacking authentication allowing workspace data exfiltration, and (3) massive code duplication in `useFlowExecution.ts` (1115 lines with near-identical `runFlow`/`runFromNode` implementations).

---

## 1. TypeScript 编译

`npx tsc --noEmit` — **0 errors**. Clean pass.

---

## 2. ESLint

`npm run lint` — **5 errors, 24 warnings** (29 total).

### Errors (5)
| File | Rule | Description |
|------|------|-------------|
| `src/components/layout/left-panel-advanced-nodes.tsx:27` | `react-hooks/set-state-in-effect` | Calling `setOpen(true)` synchronously inside `useEffect` — triggers cascading render |
| `src/lib/tools/read-file.ts:57` | `@typescript-eslint/no-require-imports` | `require()` style import forbidden |
| `src/lib/tools/save-document.ts:82,88,94` | `@typescript-eslint/no-require-imports` | Three `require()` style imports forbidden |

### Warnings (24)
Most are `@typescript-eslint/no-unused-vars` (20 instances). Also:
- `src/components/ui/file-preview-modal.tsx:304` — `@next/next/no-img-element`: `<img>` instead of `<Image />`
- Various e2e test files with unused imports

---

## 3. 代码模式

### 3.1 硬编码 API Key
`src/` 中无硬编码真实 API key。`settings/page.tsx` 中仅有 placeholder 字符串 (`sk-ant-...`, `sk-...`)，属于正常 UI 提示。

**但 `.env.local` 中包含真实 API key**（见安全章节 4.1）。

### 3.2 console.log 遗留（6 处）

| File | Line | Content |
|------|------|---------|
| `src/app/api/condition/eval/route.ts` | 100 | `console.log(\`[condition/eval] provider=...`)` |
| `src/app/api/condition/eval/route.ts` | 102 | `console.log(\`[condition/eval] result=...\`)` |
| `src/app/api/flow/generate/route.ts` | 594 | `console.log('[flow/generate] sysPrompt length:', ...)` |
| `src/app/api/flow/generate/route.ts` | 595 | `console.log('[flow/generate] sysPrompt includes loop?', ...)` |
| `src/app/api/flow/generate/route.ts` | 596 | `console.log('[flow/generate] sysPrompt includes skills?', ...)` |
| `src/app/api/flow/generate/route.ts` | 817-818 | Two `console.log` for raw LLM output debugging |

**建议**: 替换为结构化 logger 或在生产 build 中 strip 掉。condition/eval 的日志可能泄露用户输入到 server logs。

### 3.3 `: any` 类型（1 处）

| File | Line | Usage |
|------|------|-------|
| `src/app/api/flow/generate/route.ts` | 396 | `(msg.tool_calls \|\| []).map((tc: any) => ...)` |

仅 1 处，影响不大。可定义 `ToolCall` 接口替代。

### 3.4 TODO/FIXME（1 处）

| File | Line | Content |
|------|------|---------|
| `src/components/layout/left-panel-individuals.tsx` | 36 | `// TODO: Add drag-to-reorder for individual agents list (Issue 4)` |

### 3.5 超过 300 行文件（20 个）

| Lines | File | 职责评估 |
|-------|------|----------|
| **1115** | `src/hooks/useFlowExecution.ts` | **严重过大**，runFlow + runFromNode + runSingleNode 大量重复逻辑 |
| **1070** | `src/lib/i18n.ts` | 翻译数据文件，行数多但职责单一，可接受 |
| **892** | `src/app/api/flow/generate/route.ts` | AI flow 生成，包含 prompt 模板 + 解析 + 路由，建议拆分 |
| 585 | `src/app/settings/page.tsx` | Settings 页面，含多个 section，尚可接受 |
| 502 | `src/app/api/flows/[id]/run/route.ts` | Server-side flow runner，与客户端执行器逻辑重复 |
| 396 | `src/components/layout/right-panel.tsx` | 配置面板，尚可接受 |
| 389 | `src/lib/github-downloader.ts` | GitHub 下载工具，职责单一 |
| 368 | `src/components/ui/file-preview-modal.tsx` | 文件预览 Modal |
| 368 | `src/components/canvas/ai-generate-orb.tsx` | AI 生成动画组件 |
| 358 | `src/components/layout/individual-config-modal.tsx` | Individual 配置弹窗 |
| 341 | `src/components/playground/ChatPanel.tsx` | Chat 面板 |
| 339 | `src/components/canvas/nodes/base-node.tsx` | 基础节点组件 |
| 335 | `src/lib/flow-storage.ts` | Flow 文件存储 + 回收站，职责偏多 |
| 332 | `src/components/layout/agent-config-panel.tsx` | Agent 配置面板 |
| 332 | `src/components/canvas/nodes/agent-node.tsx` | Agent 节点组件 |
| 323 | `src/lib/packed-executor.ts` | Pack 执行器 |
| 322 | `src/components/canvas/nodes/packed-node.tsx` | Pack 节点组件 |
| 318 | `src/lib/flow-run-helpers.ts` | Flow 执行辅助函数 |
| 317 | `src/components/layout/top-toolbar.tsx` | 顶部工具栏 |
| 301 | `src/lib/tools/server-executor.ts` | 服务端代码执行器 |

---

## 4. 安全性

### 4.1 `.env.local` 中包含真实 API Key（CRITICAL）

`.env.local` 文件包含 **真实** 的 Brave、Tavily、DeepSeek 和 OpenAI API key。虽然 `.env.local` 在 `.gitignore` 中（不会推送到远程仓库），但如果被意外分享或泄露将导致密钥被滥用。

**已确认的真实 key**:
- `BRAVE_API_KEY=BSAz...`（非 placeholder）
- `TAVILY_API_KEY=tvly-dev-...`（非 placeholder）
- `DEEPSEEK_API_KEY=sk-251a...`（非 placeholder）
- `OPENAI_API_KEY=sk-proj-cwy...`（非 placeholder，已完整暴露）

**建议**: 立即轮换这些 key。使用 secret manager 或至少确认 `.env.local` 在 `.gitignore` 中。

### 4.2 `new Function` 代码注入（LOW RISK — 已充分防护）

`src/lib/condition-expression.ts:45` 使用 `new Function` 执行算术表达式：

```typescript
const result = new Function(`"use strict"; return (${sanitized})`)() as unknown;
```

**现有防护措施（充分）**:
1. 输入经过严格白名单：仅允许 `[0-9+\-*/.()]` 字符
2. 长度限制 200 字符
3. 括号平衡检查
4. 禁止空括号和连续操作符
5. 结果类型检查（只接受 number）

**风险评估**: LOW。白名单足够严格，无法注入任意代码。唯一的理论风险是极深嵌套括号导致栈溢出，但 200 字符限制使这不可行。

### 4.3 文件系统路径遍历（LOW RISK — 已防护）

`src/lib/workspace-manager.ts` 的防护措施：
1. `flowId` 经过 `SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/` 验证
2. `readWorkspaceFile` 和 `writeWorkspaceFile` 使用 `path.resolve()` + `startsWith()` 检查确保路径在 workspace 内

`src/app/api/workspace/[flowId]/file/route.ts` 的防护措施：
1. `path.normalize()` 规范化路径
2. 拒绝 `..` 开头和绝对路径
3. `fullPath.startsWith(path.resolve(wsDir) + path.sep)` 二次验证

**发现的细微问题**：`readWorkspaceFile` 的检查条件包含 `fullPath === path.resolve(dir)`（即允许读取目录本身），这虽然不会导致安全问题（`fs.readFile` 读目录会报错），但逻辑上不够精确。

### 4.4 API 路由鉴权审查

| 路由 | 方法 | 鉴权 | 风险 |
|------|------|------|------|
| `/api/flows/{id}/run` | POST | `requireMutationAuth` ✅ | 安全 |
| `/api/agent/run` | POST | `requireMutationAuth` ✅ | 安全 |
| `/api/agent/chat` | POST | 需确认 | — |
| `/api/condition/eval` | POST | `requireMutationAuth` ✅ | 安全 |
| `/api/settings` | GET | **无鉴权** ⚠ | Key 已 REDACTED，低风险 |
| `/api/settings` | POST | `requireMutationAuth` ✅ | 安全 |
| `/api/workspace/{flowId}` | GET | **无鉴权** ⚠ MEDIUM | 可列出 workspace 文件和读取 session context |
| `/api/workspace/{flowId}/file` | GET | **无鉴权** ⚠ MEDIUM | 可读取 workspace 中任何文件内容 |
| `/api/workspace/{flowId}/file` | PUT/POST/DELETE | `requireMutationAuth` ✅ | 安全 |
| `/api/workspace/{flowId}/preview` | GET | **无鉴权** ⚠ | 可预览 workspace 文件 |
| `/api/workspace/{flowId}/documents` | GET | **无鉴权** ⚠ | 可下载生成的文档 |
| `/api/workspace/{flowId}/documents` | POST | `requireMutationAuth` ✅ | 安全 |

**关键问题**: Workspace 的 GET 端点全部无鉴权。如果应用暴露在非 localhost 环境，攻击者可以：
1. 枚举 flowId（`flow-{timestamp}` 格式可预测）
2. 读取任意 workspace 文件内容
3. 下载生成的文档

**建议**: 对所有 workspace GET 端点添加鉴权，或至少添加 read-auth 中间件。

### 4.5 Settings GET — API Key 泄露防护

`GET /api/settings` 使用 `maskSettings()` 将所有 key 字段替换为 `'REDACTED'`。`KEY_FIELDS` 集合覆盖完整（anthropic、openai、deepseek、google、minimax、tavily、brave、replicate、apiToken）。**安全**。

### 4.6 `NEXT_PUBLIC_` 前端暴露

`src/` 中 **0 处** 使用 `NEXT_PUBLIC_` 前缀环境变量。**安全**。

### 4.7 CORS 配置

未找到自定义 CORS 配置。Next.js 默认不添加 CORS 头，这意味着：
- 同源请求正常工作
- 跨域请求被浏览器阻止（安全默认值）

如果未来需要开放 API，需要显式配置 CORS。当前 **安全**。

---

## 5. 功能逻辑问题

### 5.1 `flow-executor.ts` — 拓扑排序与环检测

**拓扑排序 (`topologicalSort`)**: 使用 DFS，遇到已访问节点直接跳过（`if (visited.has(nodeId)) return`）。这意味着在有环的图中，back-edge 被自然跳过，不会无限递归。逻辑正确。

**环检测 (`detectCycles`)**: 使用三色 DFS（WHITE→GRAY→BLACK），标准算法，正确。

**Back-edge 检测 (`findLoopEdgeIds`)**: 同样使用三色 DFS，GRAY 节点的边标记为 back-edge，正确。

**潜在问题**: `isLoopEdge` 每次调用都重新计算 `findLoopEdgeIds(edges)`，如果在循环中多次调用会有性能开销。但目前只在 `getLoopNodeIds` 中使用一次，影响不大。

### 5.2 `useFlowExecution.ts` — 分支跳过与并发安全

**并发安全（runFlow/runFromNode）**:
- 使用 `useFlowStore.getState().isRunning` 作为 mutex，`setIsRunning(true)` 在任何 `await` 之前调用 — **正确**。
- `runSingleNode` 允许并发运行多个单节点（不设 `isRunning`），但检查 `currentNode?.data?.status === 'running'` 防止同一节点重复执行 — 合理。

**分支跳过逻辑**:
- `markBranchSkipped` 使用固定点迭代（`while (changed)`），正确处理多级跳过传播。
- Loop-aware：跳过传播排除 `loopEdgeIds`，避免错误跳过环中的节点。

**潜在问题 (MEDIUM)**:
1. **Log 被 clearLogs 覆盖**: 在 `runFromNode` 中，先调用 `addLog` 记录启动信息（L464-478），然后立即调用 `clearLogs()`（L481），导致启动日志被清除。应该将 `clearLogs()` 移到 `addLog` 之前。
2. **Map.values().next().value 的 fallback**: `initialInput = nodeOutputs.values().next().value || 'Start'` — 如果第一个 io 节点的输出恰好是空字符串，会错误地 fallback 到 `'Start'`。

### 5.3 `flow-storage.ts` + `useFlowPersistence.ts` — 读写一致性

**Auto-save 防抖**:
- 结构性变更（节点/边数量变化、名称变更）立即保存
- 非结构性变更 800ms 防抖
- 前一个 save 通过 `AbortController` 取消

**防护措施**:
- 运行中 (`isRunning`) 不保存 ✅
- 查看 Pack 内部 (`viewStack.length > 0`) 不保存 ✅
- 旧请求通过 AbortController 取消 ✅

**潜在问题 (MINOR)**:
- `flow-storage.ts` 的 `writeFlow` 和 `writeIndex` 不是原子操作。如果写 flow 文件成功但写 index 失败（如磁盘满），会出现数据不一致。不过 `listFlows` 有自愈机制（发现磁盘文件但 index 中没有时会补充），降低了影响。
- `renameFlow` 分别写 flow 文件和 index 文件，两步之间如果崩溃会导致不一致。

### 5.4 `agent/run/route.ts` — API Key 读取与回退

`resolveProviderWithFallback` 逻辑：
1. 尝试读取请求的 provider 的 key（settings 优先，fallback 到环境变量）
2. 如果失败，尝试 settings 中的 `defaultProvider`
3. 如果 fallback provider 与请求 provider 相同，返回 null（避免无限递归）

**正确性**: 逻辑清晰完整。`isPlaceholderKey` 过滤掉占位符 key。

### 5.5 `condition/eval/route.ts` — 表达式求值

**Expression mode**: 委托给 `evaluateConditionExpression`，已在 4.2 中分析，安全。

**Natural mode**: 发送给 LLM 判断，截断输入至最后 2000 字符。使用 `stripThinkTags` 清理推理模型的输出。

**潜在问题 (MINOR)**: Natural mode 的 prompt 没有防注入措施。恶意用户可以在 `input` 或 `condition` 中注入 prompt 来操纵判断结果。但由于这是内部 API（用于 flow 执行），实际风险很低。

### 5.6 Server-side Flow Runner (`flows/[id]/run/route.ts`) 与客户端 Runner 逻辑重复

`flows/[id]/run/route.ts`（502行）实现了完整的服务端 flow 执行器，与 `useFlowExecution.ts` 的客户端执行器大量重复：
- `runAgentServer` vs 客户端 agent runner
- `evaluateConditionServer` vs 客户端 condition evaluator
- `runPackedNodeServer` vs `packed-executor.ts`

**Loop 处理不完整 (MEDIUM)**: 服务端 runner 的循环处理（L434-449）只 `completed.delete(falseBackEdge.target)` 一个节点，不像客户端 runner 那样重置整个 loop path 的所有节点。多节点循环体在服务端执行时会行为不正确。

---

## 6. 代码结构建议

### 6.1 `useFlowExecution.ts` (1115 行) — 建议拆分

当前问题：`runFlow` (L42-423) 和 `runFromNode` (L425-863) 共享约 70% 的代码（执行调度器、条件分支、循环处理、post-execution）。

**建议拆分方案**:
1. 提取 `executeFlowScheduler(config: SchedulerConfig): Promise<RunResult>` — 统一的并发调度器
2. 提取 `handleConditionBranching(node, result, ...)` — 条件分支 + 循环反馈逻辑
3. `postExecuteNode` 已提取为独立函数（好的），但仍在同一文件中
4. 将 `postExecuteNode` 移到 `src/lib/flow-post-execute.ts`

**预期效果**: `useFlowExecution.ts` 从 1115 行降至 ~300 行，`runFlow` 和 `runFromNode` 各约 50 行。

### 6.2 `flow/generate/route.ts` (892 行) — 建议拆分

包含：AI prompt 模板 (~400行) + 响应解析 (~200行) + 路由处理 (~300行)

**建议**:
- `src/lib/flow-generate-prompts.ts` — 系统提示模板
- `src/lib/flow-generate-parser.ts` — LLM 响应解析（JSON 提取、清理）
- `src/app/api/flow/generate/route.ts` — 仅保留路由胶水代码

### 6.3 Server-side Flow Runner — 建议统一

`flows/[id]/run/route.ts` 中的 `runAgentServer` 和 `evaluateConditionServer` 与客户端逻辑重复。

**建议**: 提取 `src/lib/server-flow-runner.ts`，复用 `flow-executor.ts` 的拓扑排序和分支跳过逻辑，避免两套实现的 divergence（如已发现的 loop 处理不一致）。

### 6.4 `flow-storage.ts` (335 行)

包含：CRUD + 回收站。职责尚可接受，但回收站逻辑（165-320行）可以提取为 `flow-trash.ts`。

### 6.5 无过度拆分问题

未发现过度拆分导致理解困难的情况。当前的模块划分（`flow-executor`, `flow-run-helpers`, `flow-execution-state`, `packed-executor`）逻辑清晰。

---

## 7. 完整问题清单

| # | 严重程度 | 类别 | 描述 | 文件 | 修复建议 |
|---|---------|------|------|------|---------|
| 1 | **CRITICAL** | 安全 | `.env.local` 包含真实 API key（DeepSeek、OpenAI、Brave、Tavily） | `.env.local` | 立即轮换 key；确保 `.env.local` 在 `.gitignore`；使用 placeholder 值 |
| 2 | **CRITICAL** | 安全 | Workspace GET 端点无鉴权，可读取任意 workspace 文件 | `src/app/api/workspace/[flowId]/route.ts`, `file/route.ts`, `preview/route.ts`, `documents/route.ts` | 添加 read-auth 中间件或 `requireMutationAuth` |
| 3 | **CRITICAL** | 逻辑 | Server-side runner 循环处理不完整：只重置 loop target 单节点，不重置完整 loop path | `src/app/api/flows/[id]/run/route.ts:434-449` | 使用与客户端相同的 `removeFromCompleted` 逻辑 |
| 4 | MEDIUM | 逻辑 | `runFromNode` 中 `addLog` 在 `clearLogs` 之前调用，启动日志被立即清除 | `src/hooks/useFlowExecution.ts:464-481` | 交换 `clearLogs()` 和 `addLog()` 的顺序 |
| 5 | MEDIUM | 代码质量 | `useFlowExecution.ts` 1115 行，`runFlow` 与 `runFromNode` 约 70% 重复 | `src/hooks/useFlowExecution.ts` | 提取统一调度器 |
| 6 | MEDIUM | 代码质量 | 服务端 flow runner 与客户端逻辑重复且已出现 divergence | `src/app/api/flows/[id]/run/route.ts` | 提取共用 server-flow-runner |
| 7 | MEDIUM | ESLint | `left-panel-advanced-nodes.tsx` 在 useEffect 中同步 setState | `src/components/layout/left-panel-advanced-nodes.tsx:27` | 使用 `useState(() => localStorage.getItem(...) === 'true')` 惰性初始化 |
| 8 | MEDIUM | ESLint | 4 处 `require()` 导入违反 no-require-imports | `src/lib/tools/read-file.ts`, `save-document.ts` | 改用 `await import()` |
| 9 | MEDIUM | 安全 | condition/eval 的 console.log 可能泄露用户输入到 server logs | `src/app/api/condition/eval/route.ts:100-102` | 移除或降级为 debug 级别 |
| 10 | MEDIUM | 逻辑 | `initialInput` fallback 使用 `nodeOutputs.values().next().value`，空字符串会被跳过 | `src/hooks/useFlowExecution.ts:98,540` | 使用 `??` 代替 `\|\|` 或显式检查 |
| 11 | MEDIUM | 安全 | Workspace GET `/api/workspace/{flowId}` 的 `buildSessionContext` 暴露 workspace 绝对路径 | `src/lib/workspace-manager.ts:126` | 避免在 API 响应中返回服务器绝对路径 |
| 12 | MINOR | 代码质量 | 6 处遗留 console.log | 见 3.2 | 替换为结构化 logger 或移除 |
| 13 | MINOR | 代码质量 | 20 处 ESLint unused-vars 警告 | 见 2 | 清理未使用的导入和变量 |
| 14 | MINOR | 代码质量 | 1 处 `: any` 类型 | `src/app/api/flow/generate/route.ts:396` | 定义 `ToolCall` 接口 |
| 15 | MINOR | 代码质量 | `flow/generate/route.ts` 892 行，混合 prompt 模板和路由逻辑 | `src/app/api/flow/generate/route.ts` | 拆分为 prompts + parser + route |
| 16 | MINOR | 代码质量 | `isLoopEdge` 每次调用重新计算所有 back-edge | `src/lib/flow-executor.ts:180` | 接受预计算的 Set 参数，或仅内部使用 |
| 17 | MINOR | 逻辑 | `readWorkspaceFile` 的路径检查包含 `fullPath === path.resolve(dir)` 允许读目录路径 | `src/lib/workspace-manager.ts:57` | 移除 `fullPath === path.resolve(dir)` 分支 |
| 18 | MINOR | 代码质量 | `flow-storage.ts` 的 `writeFlow` + `writeIndex` 非原子操作 | `src/lib/flow-storage.ts:91-138` | 写临时文件后 rename（原子操作） |
| 19 | MINOR | 代码质量 | `file-preview-modal.tsx` 使用 `<img>` 而非 Next.js `<Image>` | `src/components/ui/file-preview-modal.tsx:304` | 替换为 `<Image />` |
| 20 | MINOR | 逻辑 | `runFromNode` 中 condition 默认 model 是 `claude-haiku-4-5-20251001` (带日期后缀) | `src/app/api/flows/[id]/run/route.ts:82` | 统一为 `claude-haiku-4-5`（不带日期后缀） |
| 21 | MINOR | 代码质量 | `flow-storage.ts` 的回收站逻辑 (165-320行) 与 CRUD 混在一起 | `src/lib/flow-storage.ts` | 提取为 `flow-trash.ts` |
| 22 | MINOR | ESLint | `src/app/api/agent/run/route.ts:9` 导入了 `getWorkspaceDir` 但未使用 | `src/app/api/agent/run/route.ts` | 移除 unused import |
| 23 | MINOR | 代码质量 | 1 处 TODO 标记未清理 | `src/components/layout/left-panel-individuals.tsx:36` | 实现或转为 issue tracker 跟踪 |

---

## 待办清单

### CRITICAL（必须立即修复）
- [ ] 轮换 `.env.local` 中泄露的 API key
- [ ] 为 workspace GET 端点添加读取鉴权
- [ ] 修复 server-side runner 的 loop path 重置逻辑

### MEDIUM（本迭代内修复）
- [ ] 修复 `runFromNode` 中 clearLogs/addLog 顺序
- [ ] 提取 `useFlowExecution.ts` 统一调度器，消除重复代码
- [ ] 修复 `left-panel-advanced-nodes.tsx` 的 setState-in-effect
- [ ] 将 `require()` 改为 `import()`
- [ ] 清理 condition/eval 的 debug console.log
- [ ] 修复 `initialInput` 的空字符串 fallback
- [ ] 不在 API 响应中暴露服务器绝对路径

### MINOR（后续迭代处理）
- [ ] 清理所有 console.log 遗留
- [ ] 清理 20 处 unused-vars 警告
- [ ] 替换 `: any` 为具体类型
- [ ] 拆分 `flow/generate/route.ts`
- [ ] 其他 minor 项
