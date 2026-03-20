# FlowCraft — 架构评审报告
**Reviewer:** Gemini  |  **Date:** 2026-03-20

## Executive Summary

FlowCraft is a visually-driven AI workflow builder with a solid React-based frontend and Next.js backend. The architecture demonstrates a competent use of modern web paradigms (Zustand, React Flow, Next.js App Router). It has a functional foundation for execution, packing (sub-flows), and state management. However, as the application scales towards collaborative and deeply orchestrated features (Phase 3), the current state management and execution engine will require decoupling from the UI, and real-time synchronization mechanisms will need to be introduced.

* **架构成熟度：** 3.5 / 5
* **Phase 3 就绪度：** 3 / 5

**最关键的 3 个架构问题：**
1. 执行逻辑 (`simulateRun`) 紧耦合于 UI 状态 store，无法后台或弹性执行
2. 缺乏 CRDT 或 WebSocket 同步，实时协作需大规模重构
3. API 路由直接与文件系统交互，缺少 Service 层抽象

---

## 1. 状态管理架构

* **实现：** 使用 `Zustand` 分拆 stores (`flowStore.ts`, `agent-store.ts`, `registry-store.ts`, `uiStore.ts`)
* **优势：** 逻辑部分解耦，通过独立 action 文件（如 `flowStore-pack-actions.ts`）避免主 store 过于庞大。View stacks (`pushViewStack`) 有效支持嵌套/打包节点遍历。
* **问题：** UI 状态（如 `nodeClickTick`, `selectedNodeId`）与执行/领域状态（如 `nodes`, `edges`, `globalLogs`, `simulateRun`）存在重叠。执行逻辑 (`simulateRun`) 直接嵌入 Zustand store，副作用与状态更新紧耦合。
* **文件系统同步：** Workspace 操作 (`api/workspace/`) 通过 REST 处理而非集成同步层，本地 UI 状态与后端文件可能产生竞态。

## 2. 执行引擎设计

* **实现：** `src/lib/flow-executor.ts` 中的纯函数（`topologicalSort`, `detectCycles`, `getDownstreamNodes`）
* **优势：** 图逻辑分离出色。环检测和循环展开 (`findLoopEdgeIds`) 实现良好，通过 `DEFAULT_MAX_LOOP_ITERATIONS` 确保安全执行。条件分支通过 `markBranchSkipped` 安全处理。
* **问题：** 执行依赖 UI store (`simulateRun` in Zustand) 或 Next.js API 路由编排 (`flows/[id]/run/route.ts`)。浏览器关闭则客户端模拟丢失。缺少专用的、可恢复的、解耦的后端编排器，无法支持长时间运行的工作流或复杂并行化。

## 3. API 层设计

* **实现：** Next.js App Router API routes (`src/app/api/`)
* **优势：** RESTful 规范和 Next.js `NextResponse` 使用一致。按资源模块化 (`/flows`, `/workspace`, `/usage`, `/agents`)。SSE 流式实现提供流畅的 AI 响应体验。
* **问题：** 错误格式较随意（返回 `{ error: '...' }` 而非标准 RFC 7807 问题详情）。API 处理器直接与文件系统/DB 交互，缺少 Service 层抽象，影响可测试性和复用性。

## 4. 组件架构

* **实现：** React 组件按领域结构化 (`canvas/`, `agent/`, `home/`, `ui/`)。使用 `@xyflow/react` 构建画布。
* **优势：** 自定义边和节点组件 (`canvas/nodes/`) 模块化良好。`StoreHydration.tsx` 确保 Zustand 安全的客户端 hydration。
* **问题：** `flow-editor.tsx` 是 "God Component"，承担过多编排职责（画布布局、drop 事件、预览模式）。复杂 Modal 对话框存在 Props drilling。React Flow 节点虽然分离良好但常直接拉取 Zustand state，降低了画布上下文外的复用性。

## 5. i18n 完整性

* **实现：** `src/lib/i18n.ts` 静态字典（英文和中文）
* **优势：** 翻译 key 覆盖率非常高，涵盖工具栏、节点类型、错误消息和细粒度 UI 元素。严格类型 (`Lang`, `TranslationKey`) 确保开发者添加功能时不会遗漏 key。
* **问题：** 硬编码在单个文件中。随着应用增长，`i18n.ts` 将成为巨大瓶颈。缺少动态 locale 加载，增加了初始 JS bundle 大小。

## 6. 跨文件依赖与耦合

* **实现：** 类型集中在 `src/types/flow.ts`
* **优势：** 类型集中管理出色 (`FlowData`, `NodeStatus`, `AgentNodeData`)。共享定义减少了前后端重复接口。
* **问题：** 节点组件、自定义边和 flow store 之间存在循环依赖风险，原因是 React Flow 事件处理器 (`onNodesChange`, `onConnect`) 与 Zustand 紧密集成。

## 7. Phase 3 就绪度评估

* **三层共享内存扩展：** 需要架构改造。当前 `AgentNodeData` 处理本地化上下文 (`_overrideSystemPrompt`, `logs`)，但真正的跨 flow 共享内存需要集中式向量数据库或专用内存微服务。
* **人工介入节点：** 基础支持存在 (`node.human`)，但需要执行引擎中的状态暂停/恢复机制来处理异步人工输入而不阻塞执行线程。
* **子 Flow 编排：** 非常有前景。`packed-node` 逻辑和 view stacks (`createPushViewStack`) 为子 flow 提供了强大的 UI 和逻辑基础。
* **实时协作：** 就绪度低。Zustand 和 REST API 不足以支持多人编辑。需要迁移到基于 CRDT 的系统（如 Yjs）通过 WebSocket 同步。

---

## 完整问题清单

| # | 优先级 | 类别 | 描述 | 涉及文件 | 建议方案 |
|---|--------|------|------|---------|---------|
| 1 | High | 状态/引擎 | 执行逻辑 (`simulateRun`) 紧耦合于 UI 状态 store，无法后台或弹性执行 | `flowStore.ts` | 将 `simulateRun` 提取到独立 Worker 或后端服务 |
| 2 | High | Phase 3 | 缺乏 CRDT 或 WebSocket 同步，实时协作需大规模重构 | `src/store/*` | 引入 Yjs + WebSocket Provider |
| 3 | Medium | API | API 路由直接与 FS/DB 交互，缺少 Service 层，影响可测试性和复用 | `src/app/api/*` | 抽取 `src/services/` 目录 |
| 4 | Medium | 架构 | `flow-editor.tsx` 承担过多职责（布局、hydration、拖放编排） | `flow-editor.tsx` | 拆分为 `CanvasDropZone`, `CanvasHotkeys`, `CanvasHydration` |
| 5 | Low | i18n | 翻译集中在单一大文件中，增加初始 bundle 大小 | `src/lib/i18n.ts` | 拆分为多个 JSON 文件或模块化 namespace，支持懒加载 |
| 6 | Low | 类型 | `NodeData` 接口中 `Record<string, unknown>` 使用不一致，降低动态负载的类型安全性 | `src/types/flow.ts` | 统一使用泛型或 discriminated union |

---

## 改进建议

### 短期（Phase 2 收尾前）
1. **抽取 Service 层：** 将文件系统和持久化逻辑从 `route.ts` 移至 `src/services/` 目录
2. **重构 God Component：** 将 `flow-editor.tsx` 拆分为更小的聚焦编排器（`CanvasDropZone`, `CanvasHotkeys`, `CanvasHydration`）
3. **i18n 代码分割：** 将 `i18n.ts` 拆分为多个 JSON 文件或模块化命名空间支持懒加载

### 中期（Phase 3 开始前）
1. **执行与 UI 解耦：** 从 Zustand 移除 `simulateRun`，创建后台编排器（Web Worker 或专用后端服务），纯粹依赖 `flow-executor.ts` 的拓扑排序逻辑，通过事件更新状态
2. **人工介入弹性：** 实现数据库中的状态机暂停/恢复功能，允许 flow 安全暂停等待外部（人工）输入
3. **内存上下文抽象：** 引入向量数据库或结构化 SQL 内存层，让 Agent 跨执行实现真正的"共享内存"

### 长期（架构演进方向）
1. **实时协作 (CRDTs)：** 用 Yjs document 替换或包装 Zustand 的 `nodes` 和 `edges` 状态，将 React Flow 直接绑定到 Yjs provider 实现多人编辑
2. **分布式执行：** 将执行引擎完全移至可扩展后端（如 Temporal 或 Kubernetes 队列），将 Next.js 应用转为纯粹的控制面板和 UI
