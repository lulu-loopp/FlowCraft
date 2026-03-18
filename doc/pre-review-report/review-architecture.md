# FlowCraft — 架构评审报告
**Reviewer:** Gemini  |  **Date:** 2026-03-18

## Executive Summary
- **架构成熟度:** 3.5/5
- **Phase 3 就绪度:** 3/5

FlowCraft 项目展现了坚实的架构基础。执行引擎正确处理拓扑排序、动态跳过未激活的条件分支，以及通过 "packed" 节点执行子流程。组件结构和 API 边界定义合理。但状态管理与直接 API 调用过度耦合（破坏了单向数据流），执行引擎在失败处理方面存在一个关键竞态条件。为 Phase 3（实时协作、人工介入）做准备需要将核心 Zustand 状态迁移到 CRDT 模型，并重构执行引擎以支持异步挂起。

---

## 1. 状态管理架构
**分析 `src/store/`:**
- **Store 边界:** flowStore、agent-store、registry-store、uiStore 的领域划分是合理的
- **数据流与混合职责:** `flowStore-pack-actions.ts` 中存在显著的状态纯度违规。状态设置器 action（如 `createPopViewStack`）直接发起 HTTP `fetch` `PUT` 请求来同步共享定义。状态变更应该是严格同步/纯函数的，副作用应委托给专门的 API 服务层或中间件
- **文件系统同步:** 严重依赖全对象 API 替换。缺乏细粒度 patch 系统限制了性能和未来离线优先能力

## 2. 执行引擎设计
**分析 `src/lib/flow-executor.ts` & `packed-executor.ts`:**
- **图遍历:** 实现了健壮的 Kahn 算法等价物和 DFS 着色用于可靠的环检测（`detectCycles`, `findLoopEdgeIds`）
- **条件跳过:** `markBranchSkipped` 智能地向下传播跳过，并通过忽略循环回边成功防止无限跳过
- **并行调度与合并:** `packed-executor.ts` 使用 `inFlight` map 正确镜像了并行处理方法
- **失败处理问题:** `packed-executor.ts` 中存在关键逻辑缺陷。如果内部节点失败，`catch` 块记录错误但随后将节点添加到 `completedIds`。因为下游节点检查 `areUpstreamsCompleteOrSkipped`，它们会在缺少或无效输入的情况下继续执行，导致失败级联

## 3. API 层设计
**分析 `src/app/api/`:**
- **RESTful 规范:** 节点和 flow 配置（`/api/flows/[id]`）正确使用 GET、PUT、DELETE HTTP 动词
- **错误一致性:** 标准端点正确返回 JSON（`{ error: '...' }`）映射到 HTTP 4xx/500 状态码；SSE 端点如 `/api/agent/run` 通过流协议传递错误（`{ type: 'error', data: '...' }`）。可接受但要求客户端处理分裂的错误域
- **端点耦合:** `runAgent` API 与 prompt 构建逻辑（注入 tools 和 skills）紧密耦合。将 prompt 组装抽象为独立服务层将使测试更容易

## 4. 组件架构
**分析 `src/components/`:**
- **分层:** 按领域良好分区（`canvas`、`agent`、`home`、`playground`）
- **God Component 检测:** `src/components/canvas/flow-editor.tsx` 目前充当 God Component。它在概念上处理拖放操作、键盘监听、节点 pack 转换逻辑（`handlePack`），以及原生在组件内进行 API 状态同步，超过 300 行
- **React Flow 一致性:** 自定义节点抽象（`nodeTypes`）和边（`edgeTypes`）设计良好

## 5. i18n 完整性
**分析 `src/lib/i18n.ts` & UI:**
- **完整性:** `i18n.ts` 内原生 en/zh 并行定义优秀
- **硬编码文本:** 多个组件绕过翻译字典。示例包括 `SkillInstaller.tsx` 中的 `github.com/user/repo 或 user/repo`，以及 `packed-demo.tsx` 和 `RegistryComponents.tsx` 中的若干硬编码 UI 元素
- **E2E 发现:** 中文模式下 "Run" 按钮文本未翻译

## 6. 跨文件依赖与耦合
- **重复逻辑:** 并行执行调度逻辑在 `packed-executor.ts` 和 `flowStore.ts`（`simulateRun`、`simulateRunDemo`）中冗余存在
- **反向依赖:** 典型清洁流（Components -> Hooks -> Store -> API Service）被 `flowStore-pack-actions.ts` 手动导入 Next.js API 端点所打破
- **循环引用:** 处理正确。React Flow providers 和 Zustand stores 不存在直接循环依赖问题

## 7. Phase 3 就绪度评估
- **共享内存:** `packed-memory-injector` 允许外层 packs 向下传递 memory 层，这是良好的可扩展起点
- **人工介入:** 未就绪。当前运行器（`executeAgentNode` 通过 `/api/agent/run`）在持续流读取器内执行。长时间运行的人工任务需要引擎能够挂起其状态并在外部 Webhook/Callback 时唤醒
- **子流程调用:** 就绪度优秀。嵌套实例（共享定义 vs 独立副本）已优雅实现
- **实时协作:** 就绪度低。Zustand 状态替换整个数组和做完整 JSON diff 将导致显著的合并冲突。将核心 node/edge stores 过渡到 CRDT 库（如 Yjs）是严格必需的

---

## 完整问题清单

| # | 优先级 | 类别 | 描述 | 涉及文件 | 建议方案 |
|---|--------|------|------|----------|----------|
| 1 | High | 执行引擎 | 失败节点被错误标记为已完成，导致下游无效执行 | `src/lib/packed-executor.ts` | 标记失败为 `failedIds`，并停止所有下游依赖的 `trySchedule` |
| 2 | High | 状态管理 | Zustand actions 包含直接网络 `fetch` 调用，破坏状态纯度 | `src/store/flowStore-pack-actions.ts` | 将网络调用重构到数据访问层 / React Query / SWR hooks |
| 3 | Medium | 架构 | `flow-editor.tsx` 作为 God Component 混合了重业务逻辑与展示 | `src/components/canvas/flow-editor.tsx` | 提取 `handlePack` 到通用 `useFlowPack` hook |
| 4 | Medium | i18n | 组件模板中发现硬编码中英文文本绕过 `useUIStore().t` | `SkillInstaller.tsx`, `packed-demo.tsx`, `GoalInput.tsx` | 将硬编码 UI 文本提取到 `i18n.ts` |
| 5 | Medium | 执行引擎 | 并行执行调度循环重复 | `packed-executor.ts`, `flowStore.ts` | 将并行节点处理集中到统一 Scheduler 类 |
| 6 | Low | Phase 3 | 执行模型完全同步，阻塞人工介入能力 | `src/lib/node-executors.ts` | 实现任务挂起架构（序列化状态，等待外部恢复） |

---

## 改进建议

### 短期（Phase 2 收尾前）
- 修补 `packed-executor.ts` 中的执行循环，使失败节点不注册为成功完成
- 扫描 `src/components` 树，将已识别的硬编码字符串替换为 `t()` keys

### 中期（Phase 3 开始前）
- 通过将 `flow-editor.tsx` 中的 packing/unpack 逻辑提取到独立 hooks，解耦 UI 与业务规则
- 将 `flowStore-pack-actions.ts` 中的直接 API 数据获取抽象到标准工具 API 服务定义

### 长期（架构演进方向）
- 通过将数组式 node/edge 数据结构替换为 CRDT 标准（如 Yjs），为 `flowStore` 准备实时协作，允许多用户细粒度编辑
- 重构执行引擎为依赖持久化状态机，可完全暂停，在等待 "Human" 节点异步解析时将当前拓扑进度持久化到磁盘
