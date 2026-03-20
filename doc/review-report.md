# FlowCraft — Code Review Report

**日期：** 2026-03-20
**Reviewers：** Codex (静态分析) + Gemini (架构评审) + Claude Code (E2E 测试)
**版本：** 1fc1808 (main)

---

## Executive Summary

**总体评分：7.5 / 10**

FlowCraft 是一个功能丰富的 AI Agent 工作流可视化编排工具，基于 Next.js 16 + React Flow + Zustand 构建。项目架构清晰、代码质量良好，核心功能（画布编辑、流程持久化、多模型支持、i18n）运行稳定。

**发现：3 严重 / 8 中等 / 12 轻微**（静态分析）+ **6 架构问题** + **4 E2E Bug**

**关键亮点：**
- TypeScript 零编译错误
- API key 泄露防护完善（REDACTED 机制）
- 路径遍历防护到位
- 表达式求值安全白名单充分
- i18n 覆盖率高
- 持久化机制可靠（auto-save + 防抖 + AbortController）

**关键风险：**
- Workspace GET 端点无鉴权（如暴露非 localhost 可被利用）
- Server-side runner 循环处理不完整
- `useFlowExecution.ts` 1115 行，70% 重复代码
- 执行引擎紧耦合 UI store，不支持后台运行

---

## 1. 代码质量（来源：review-static.md）

| 指标 | 结果 |
|------|------|
| TypeScript 编译 | ✅ 0 错误 |
| ESLint | ⚠️ 5 error, 24 warning |
| 硬编码 API Key | ✅ src/ 无（.env.local 有真实 key，需轮换） |
| console.log 遗留 | ⚠️ 6 处 |
| `: any` 类型 | ✅ 仅 1 处 |
| TODO/FIXME | ✅ 仅 1 处 |
| 超 300 行文件 | ⚠️ 20 个（最大 1115 行） |

**主要问题：**
- `useFlowExecution.ts` 1115 行，`runFlow` 与 `runFromNode` 约 70% 重复 → 需提取统一调度器
- `flow/generate/route.ts` 892 行，混合 prompt 模板和路由逻辑 → 建议拆分
- 4 处 `require()` 导入违反 ESLint 规则
- `left-panel-advanced-nodes.tsx` 在 useEffect 中同步 setState

---

## 2. 安全性（来源：review-static.md）

| 检查项 | 状态 | 详情 |
|--------|------|------|
| new Function / eval | ✅ 安全 | 白名单 `[0-9+\-*/.()]`，200 字符限制，括号平衡检查 |
| 路径遍历 | ✅ 安全 | path.resolve + startsWith 二次验证 |
| API Key 泄露 (GET /api/settings) | ✅ 安全 | maskSettings() REDACTED，覆盖完整 |
| NEXT_PUBLIC_ 暴露 | ✅ 安全 | 0 处使用 |
| CORS | ✅ 安全 | Next.js 默认同源 |
| Workspace GET 鉴权 | ❌ **无鉴权** | GET 端点可读取任意 workspace 文件 |
| .env.local | ⚠️ 风险 | 包含真实 API key（已在 .gitignore） |

---

## 3. 架构评审（来源：review-architecture.md）

**架构成熟度：3.5 / 5** | **Phase 3 就绪度：3 / 5**

| 维度 | 评估 |
|------|------|
| 状态管理 | 分拆合理，但 UI 状态与执行状态混合；`simulateRun` 紧耦合 Zustand |
| 执行引擎 | 拓扑排序和环检测实现出色；缺少可恢复的后台编排器 |
| API 层 | RESTful + SSE 良好；缺 Service 层抽象，错误格式不统一 |
| 组件架构 | 模块化良好；`flow-editor.tsx` 是 God Component |
| i18n | 覆盖率高，类型安全；单文件瓶颈 |
| 跨文件依赖 | 类型集中管理好；存在循环依赖风险 |
| Phase 3 就绪 | 子 Flow（packed-node）基础好；实时协作需 CRDT |

---

## 4. 功能完整性

| # | 功能 | 静态检查 | E2E 测试 | 综合状态 |
|---|------|---------|---------|---------|
| 1 | 首页 & 流程列表 | ✅ | ✅ T1 | ✅ 正常 |
| 2 | 画布拖拽添加节点 | ✅ | ✅ T2 | ✅ 正常 |
| 3 | 节点配置 & 右侧面板 | ✅ | ✅ T2 | ✅ 正常 |
| 4 | 流程持久化 | ✅ 防抖+AbortController | ✅ T3 | ✅ 正常 |
| 5 | Settings & API Key 管理 | ✅ REDACTED | ✅ T4 | ✅ 正常 |
| 6 | 中英文切换 | ✅ 类型安全 | ✅ T5 | ✅ 正常（时间戳未本地化） |
| 7 | YAML 导出 | — | ⚠️ T6 | ⚠️ Modal 展示，未验证内容 |
| 8 | 流程执行 | ⚠️ server loop 不完整 | ⚠️ T8 | ⚠️ 客户端正常，服务端有 bug |
| 9 | 运行历史 | ✅ | ⚠️ T8 | ✅ 正常 |
| 10 | Playground | ✅ | ✅ T9 | ✅ 正常 |
| 11 | API 端点 | ⚠️ workspace 无鉴权 | ⚠️ T7 | ⚠️ 安全+错误格式问题 |

---

## 5. E2E 测试结果摘要（来源：review-e2e.md）

| 场景 | 状态 | 关键发现 |
|------|------|---------|
| T1: 首页 | ✅ | 品牌、新建、列表、导航全部正常 |
| T2: 画布操作 | ✅ | 拖拽添加、节点配置、Condition true/false handles |
| T3: 持久化 | ✅ | 节点+配置刷新后保持，auto-save 工作 |
| T4: Settings | ✅ | 8+ key 输入框，保存刷新后持久 |
| T5: 中英文切换 | ✅ | 覆盖好，刷新保持，时间戳未本地化 |
| T6: YAML 导出 | ⚠️ | Export 按钮存在，Modal 弹出，内容未验证 |
| T7: API 端点 | ⚠️ | settings REDACTED ✅；agent/run 500 空 body；export 404 |
| T8: 运行历史 | ✅ | goal 输入 Modal，History tab 存在 |
| T9: Playground | ✅ | run/chat 双模式，完整工具列表 |

---

## 6. 完整 Bug 清单（三报告合并去重）

| # | 严重程度 | 来源 | 描述 | 文件/场景 | 修复建议 |
|---|---------|------|------|---------|---------|
| 1 | **CRITICAL** | 静态 | `.env.local` 包含真实 API key（DeepSeek/OpenAI/Brave/Tavily） | `.env.local` | 立即轮换 key |
| 2 | **CRITICAL** | 静态 | Workspace GET 端点无鉴权，可读取任意 workspace 文件 | `src/app/api/workspace/[flowId]/*.ts` GET routes | 添加 read-auth 中间件 |
| 3 | **CRITICAL** | 静态 | Server-side runner 循环处理只重置单节点，不重置完整 loop path | `src/app/api/flows/[id]/run/route.ts:434-449` | 使用与客户端相同的 `removeFromCompleted` 逻辑 |
| 4 | MEDIUM | 静态 | `runFromNode` 中 `addLog` 在 `clearLogs` 之前，启动日志被清除 | `src/hooks/useFlowExecution.ts:464-481` | 交换 clearLogs/addLog 顺序 |
| 5 | MEDIUM | 静态 | `useFlowExecution.ts` 1115 行，runFlow 与 runFromNode 约 70% 重复 | `src/hooks/useFlowExecution.ts` | 提取统一调度器函数 |
| 6 | MEDIUM | 静态 | 服务端 flow runner 与客户端逻辑重复且已 diverge | `src/app/api/flows/[id]/run/route.ts` | 提取共用 server-flow-runner |
| 7 | MEDIUM | 静态 | `left-panel-advanced-nodes.tsx` useEffect 中同步 setState | `src/components/layout/left-panel-advanced-nodes.tsx:27` | 惰性初始化替代 |
| 8 | MEDIUM | 静态 | 4 处 `require()` 违反 no-require-imports | `src/lib/tools/read-file.ts`, `save-document.ts` | 改用 `import()` |
| 9 | MEDIUM | 静态 | condition/eval console.log 可能泄露用户输入 | `src/app/api/condition/eval/route.ts:100-102` | 移除或降级 |
| 10 | MEDIUM | 静态 | `initialInput` fallback 用 `||` 跳过空字符串 | `src/hooks/useFlowExecution.ts:98,540` | 改用 `??` |
| 11 | MEDIUM | 静态 | Workspace GET 响应暴露服务器绝对路径 | `src/lib/workspace-manager.ts:126` | 返回相对路径 |
| 12 | MEDIUM | E2E | `/api/agent/run` POST 500 返回空响应体 | T7 API 测试 | 返回 `{ error: "..." }` |
| 13 | MEDIUM | 架构 | `flow-editor.tsx` 是 God Component | `src/components/canvas/flow-editor.tsx` | 拆分为 DropZone/Hotkeys/Hydration |
| 14 | MEDIUM | 架构 | API 路由缺少 Service 层抽象 | `src/app/api/*` | 抽取 `src/services/` |
| 15 | LOW | E2E | 中文模式下 Flow 卡片时间戳未本地化 | T5 首页 | 使用 `toLocaleString('zh-CN')` |
| 16 | LOW | E2E | `/api/flows/{id}/export` GET 返回 404 | T7 API 测试 | 实现 GET 方法或文档说明 |
| 17 | LOW | E2E | Playground 默认 provider 与 Settings 默认不一致 | T9 Playground | 统一读取 settings |
| 18 | LOW | 静态 | 6 处遗留 console.log | 见 review-static.md 3.2 | 清理 |
| 19 | LOW | 静态 | 20 处 ESLint unused-vars 警告 | 多文件 | 清理 |
| 20 | LOW | 静态 | 1 处 `: any` 类型 | `src/app/api/flow/generate/route.ts:396` | 定义 ToolCall 接口 |
| 21 | LOW | 静态 | `flow/generate/route.ts` 892 行混合职责 | `src/app/api/flow/generate/route.ts` | 拆分 prompts/parser/route |
| 22 | LOW | 静态 | `flow-storage.ts` writeFlow+writeIndex 非原子 | `src/lib/flow-storage.ts` | 写临时文件后 rename |
| 23 | LOW | 静态 | `file-preview-modal.tsx` 用 `<img>` 而非 `<Image>` | `src/components/ui/file-preview-modal.tsx:304` | 替换 |
| 24 | LOW | 架构 | i18n 单文件瓶颈，增加 bundle 大小 | `src/lib/i18n.ts` | 拆分+懒加载 |
| 25 | LOW | 架构 | 执行引擎紧耦合 UI store | `flowStore.ts` | 中期解耦到 Worker/后端 |

---

## 7. Phase 3 就绪度（来源：review-architecture.md）

| 能力 | 就绪度 | 评估 |
|------|--------|------|
| 三层共享内存 | ⚠️ 2/5 | 需要向量数据库或专用内存微服务 |
| 人工介入节点 | ⚠️ 3/5 | 基础存在 (`node.human`)，需暂停/恢复机制 |
| Orchestrator 子 Flow | ✅ 4/5 | packed-node + view stacks 基础出色 |
| 实时协作 | ❌ 1/5 | 需 CRDT (Yjs) + WebSocket，根本性改动 |

---

## 8. 改进建议（按优先级）

### P0 — 立即修复（安全 + 严重 bug）
- [ ] 轮换 `.env.local` 中泄露的真实 API key
- [ ] 为所有 Workspace GET 端点添加读取鉴权
- [ ] 修复 server-side runner 的 loop path 重置逻辑（与客户端对齐）

### P1 — Phase 2 收尾前
- [ ] 修复 `runFromNode` 中 clearLogs/addLog 顺序
- [ ] 修复 `initialInput` 空字符串 fallback（`||` → `??`）
- [ ] 修复 `/api/agent/run` 500 空响应体
- [ ] 修复 `left-panel-advanced-nodes.tsx` setState-in-effect
- [ ] 将 `require()` 改为 `import()`
- [ ] 清理 condition/eval debug console.log
- [ ] 不在 API 响应中暴露服务器绝对路径

### P2 — Phase 3 开始前
- [ ] 提取 `useFlowExecution.ts` 统一调度器（1115 → ~300 行）
- [ ] 统一服务端/客户端 flow runner
- [ ] 拆分 `flow-editor.tsx` God Component
- [ ] 抽取 Service 层（API route → services）
- [ ] 拆分 `flow/generate/route.ts`（prompts/parser/route）
- [ ] 统一 Playground 和 Settings 的默认 provider
- [ ] 中文模式时间戳本地化
- [ ] 清理全部 console.log / unused-vars / any

### P3 — 长期演进
- [ ] 执行引擎从 Zustand 解耦到 Web Worker 或后端服务
- [ ] i18n 拆分为多文件 + 懒加载
- [ ] 人工介入节点的暂停/恢复状态机
- [ ] 共享内存层（向量数据库）
- [ ] 实时协作 CRDT (Yjs) + WebSocket
- [ ] 分布式执行后端（Temporal / K8s 队列）
