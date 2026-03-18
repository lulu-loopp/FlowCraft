# FlowCraft — Gemini Review 任务说明（架构与逻辑评审）

> **职责范围：** 架构设计评审、跨文件逻辑 review、Phase 3 扩展性评估、改进建议
> **不包含：** lint/tsc 等工具扫描（Codex 负责）、浏览器测试（Claude Code 负责）
> **最终输出：** `doc/review-architecture.md`
> **工作方式：** 请一次性阅读整个 `src/` 目录，基于全局视角进行评审

---

## 项目背景

FlowCraft 是一个可视化 AI agent 编排平台，目标用户是非技术人员，核心体验类似 Scratch。

**技术栈：** Next.js 16 App Router + TypeScript + Zustand + React Flow + Tailwind CSS + next-intl

**三层核心架构：**
- **Tool** — 单一原子操作（web_search、calculator 等）
- **Skill** — SKILL.md 格式，注入领域知识
- **Agent** — 自主推理，执行循环：think → act → observe → repeat

**产品路线图：**
- Phase 1（已完成）：Playground + Agent 引擎验证
- Phase 2（当前）：Canvas 可视化编排 ← **review 范围**
- Phase 3（下一步）：多 Agent 协作、共享内存、人工节点
- Phase 4（远期）：Agent 社会，自由通信

**页面路由：** `/`（首页）、`/canvas/[flowId]`（画布）、`/playground`（对话）、`/settings`（配置）

---

## 已实现功能清单（Stage 2）

| # | 功能 | 核心文件 |
|---|------|---------|
| 1 | Flow 持久化（保存/加载到 `flows/` 目录） | `src/lib/flow-storage.ts`, `src/hooks/useFlowPersistence.ts` |
| 2 | 首页 — flow 列表、新建、删除 | `src/app/page.tsx`, `src/components/home/` |
| 3 | Settings — API Key 配置 | `src/app/settings/page.tsx`, `src/lib/settings-storage.ts` |
| 4 | Output 节点 | `src/components/canvas/nodes/output-node.tsx` |
| 5 | Pack into Agent（节点封装） | `src/components/canvas/pack-agent-dialog.tsx`, `src/app/api/agents/local/route.ts` |
| 6 | 条件节点（true/false 分支路由） | `src/components/canvas/nodes/condition-node.tsx`, `src/app/api/condition/eval/route.ts` |
| 7 | Workspace 文件系统 | `src/lib/workspace-manager.ts`, `src/app/api/workspace/` |
| 8 | 运行历史 | `src/app/api/flows/[id]/runs/route.ts`, `src/store/flowStore.ts` |
| 9 | YAML 导出 | `src/app/canvas/[flowId]/page.tsx` 或 toolbar |
| 10 | API 发布 | `src/app/api/flows/[id]/run/route.ts` |
| 11 | 中英文切换 | `src/lib/i18n.ts`, `src/store/uiStore.ts` |

---

## 评审维度

### 1. 状态管理架构

阅读 `src/store/` 下所有文件（flowStore、uiStore、agent-store），评估：

- **职责划分：** 三个 store 的边界是否清晰？是否有状态放错了 store？
- **数据流：** 组件 → store → API 的数据流是否单向清晰？有无循环依赖？
- **派生状态：** 是否有应该用 selector/computed 但直接存储在 store 中的冗余状态？
- **持久化一致性：** flowStore 的内存状态与 `flows/` 目录的文件系统状态之间，同步策略是否可靠？有无脏数据风险？
- **Phase 3 扩展性：** 多 Agent 协作需要共享内存（private/public/global 三层），当前 store 设计是否能自然扩展？

### 2. 执行引擎设计

阅读 `src/lib/flow-executor.ts` 和 `src/hooks/useFlowExecution.ts`，评估：

- **拓扑排序：** 算法是否正确处理了所有 DAG 情况？环检测是否存在？
- **分支逻辑：** 当 condition 节点输出 false 时，false 分支下游的所有节点是否被正确跳过？如果两条分支最终汇合到同一个 Merge 节点呢？
- **错误传播：** 某个节点执行失败时，下游节点的行为是什么？是否有"部分成功"的状态？
- **并发模型：** 同一层级的独立节点是否并行执行？如果是，有无竞态风险？
- **可观测性：** 执行过程中是否有足够的状态更新供 UI 显示进度（节点状态、日志、时间线）？
- **Phase 3 扩展性：** 如果引入 Orchestrator 节点（协调子 Agent），当前引擎需要做哪些改动？

### 3. API 层设计

阅读 `src/app/api/` 下所有 route 文件，评估：

- **RESTful 规范：** URL 设计、HTTP method 使用是否合理？
- **错误处理一致性：** 所有 API 是否使用统一的错误响应格式？
- **SSE 实现：** `agent/run` 的 streaming 实现是否正确（连接管理、错误中断、客户端重连）？
- **API 间耦合：** route 文件之间、route 与 lib 之间的依赖关系是否清晰？
- **幂等性：** `POST /api/flows/{id}/run` 重复调用是否安全？

### 4. 组件架构

阅读 `src/components/` 目录结构和关键组件，评估：

- **分层是否合理：** `canvas/`、`layout/`、`home/`、`ui/` 的划分是否恰当？
- **组件职责：** 是否存在"上帝组件"同时处理 UI 渲染和业务逻辑？
- **Props 设计：** 关键组件的 props 接口是否简洁、可组合？
- **React Flow 集成：** 自定义节点组件（agent-node、condition-node、output-node）的实现模式是否一致？
- **代码结构建议：** 对于超过 300 行的文件，如果职责混杂，建议具体的拆分方案；如果内聚性高则标注"无需拆分"。对于过度拆分的情况，建议合并。

### 5. i18n 完整性

阅读 `src/lib/i18n.ts` 和所有使用 `t()` 函数的文件，评估：

- 中英文翻译 key 是否完整对应？
- 是否有 UI 文字直接硬编码而未走 `t()` 的情况？
- 翻译 key 的命名结构是否一致、可维护？
- 新增功能时添加翻译的流程是否方便？

### 6. 跨文件依赖与耦合分析

从全局视角评估：

- **依赖方向：** 是否存在 `lib/` 依赖 `components/` 或 `store/` 依赖 `components/` 的反向依赖？
- **循环依赖：** 文件 A import B，B import A 的情况
- **共享类型：** TypeScript 类型定义是否集中管理（如 `src/types/`）？还是散落各处？
- **重复逻辑：** 多处相似代码是否应抽取为公用函数

### 7. Phase 3 就绪度评估

基于对整体架构的理解，评估当前代码对 Phase 3（多 Agent 协作）的准备程度：

- **共享内存（三层 memory）：** 当前 workspace 设计能否自然扩展为 private/public/global？
- **人工介入节点（Human Node）：** 执行引擎是否支持"暂停等待人工输入"的中间状态？
- **Orchestrator 节点：** 一个 Agent 节点能否作为子 flow 调用另一组节点？
- **实时协作：** 如果未来多人编辑同一个 flow，当前状态管理需要做哪些根本性改动？

---

## 输出格式

输出文件：`doc/review-architecture.md`

```markdown
# FlowCraft — 架构评审报告

**日期：** YYYY-MM-DD
**Reviewer：** Gemini
**版本：** git commit hash

---

## Executive Summary

架构成熟度评级：（1-5，5 = production-ready）
Phase 3 就绪度评级：（1-5，5 = 无需重构即可扩展）
最关键的 3 个架构问题：（一句话描述）

---

## 1. 状态管理架构

### 1.1 当前设计评估
### 1.2 问题与风险
### 1.3 改进建议

## 2. 执行引擎设计

### 2.1 拓扑排序与分支逻辑
### 2.2 错误传播与恢复
### 2.3 并发模型
### 2.4 Phase 3 扩展方案

## 3. API 层设计

### 3.1 RESTful 合规性
### 3.2 错误处理一致性
### 3.3 SSE 实现质量

## 4. 组件架构

### 4.1 分层评估
### 4.2 问题组件
### 4.3 代码结构建议（拆分/合并/重命名，附理由）

## 5. i18n 完整性

## 6. 依赖与耦合分析

### 6.1 依赖图（可选，文字描述即可）
### 6.2 问题点

## 7. Phase 3 就绪度

### 7.1 共享内存扩展路径
### 7.2 人工介入节点可行性
### 7.3 Orchestrator 节点可行性
### 7.4 需要提前重构的部分

---

## 完整问题清单

| # | 优先级 | 类别 | 描述 | 涉及文件 | 建议方案 |
|---|-------|------|------|---------|---------|

---

## 改进建议（按优先级排序）

### 短期（Phase 2 收尾前）
### 中期（Phase 3 开始前）
### 长期（架构演进方向）
```

---

## 注意事项

1. **请一次性阅读整个 `src/` 目录** — 本次评审需要全局视角，不要逐文件孤立分析
2. **不需要运行任何命令** — tsc/lint/grep 由 Codex 负责，你专注于逻辑和设计
3. **不需要做浏览器测试** — E2E 测试由 Claude Code 负责
4. **代码结构建议应具体** — "这个文件太大了"不够，要说"建议把 X 函数抽到 Y 文件，因为 Z"
5. **Phase 3 评估是本次 review 的独特价值** — 这部分 Codex 和 Claude Code 做不了，请深入分析
6. **对于文件行数** — 不强制要求所有文件低于某个阈值。以"能否用一句话说清职责"为判断标准。超过 300 行且职责混杂的建议拆分，内聚性高的大文件标注"无需拆分"即可
