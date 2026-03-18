# FlowCraft — 静态分析 Review 报告
**Reviewer:** Codex  |  **Date:** 2026-03-18

## Executive Summary
0 critical, 3 medium, 5 minor

TypeScript 编译和 ESLint 均通过（src/ 零错误零警告）。`.env.local` 含真实 API keys 但未被 git 追踪。安全层面，`new Function` 表达式求值器有白名单保护但存在边缘绕过风险，鉴权的 localhost 检查依赖可伪造的 Host 头。代码质量方面，8 处 `any` 类型、4 个超长文件，整体干净无 TODO/FIXME。

---

## 1. TypeScript 编译

```
npx tsc --noEmit → 0 errors
```
TypeScript 编译完全通过，`strict` 模式下无类型错误。

## 2. ESLint

```
npm run lint → 0 errors, 0 warnings (src/)
```

src/ 目录零错误零警告。7 条 warnings 全部来自 `e2e/` 测试文件，不影响生产代码。

## 3. 代码模式扫描

### 3.1 硬编码 API Keys

- `.env.local` 包含：
  - `ANTHROPIC_API_KEY=sk-ant-xxxxxxxx`（占位符）
  - `DEEPSEEK_API_KEY=sk-251a96f...`（真实 key）
  - `OPENAI_API_KEY=sk-proj-cwyeMEE...`（真实 key）
- `.env.local` **未被 git 追踪**（`git ls-files .env.local` 返回空）— 安全
- `src/app/settings/page.tsx` 中仅为 UI placeholder 示例文本（`'sk-ant-...'`）— 可接受
- **src/ 目录内无硬编码 API key**

### 3.2 console.log 遗留

| 文件 | 评估 |
|------|------|
| `src/lib/tools/code-execute.ts` | 1 处，服务端代码执行工具，用于调试，可接受 |

src/ 中仅此 1 处，无生产侧泄漏风险。

### 3.3 `: any` 类型使用（8 处）

| 文件 | 行 | 用法 | 评估 |
|------|----|------|------|
| `src/hooks/useCodingAgent.ts` | 172 | `data.item as any` | SSE 流解析，难以精确定型 |
| `src/hooks/useCodingAgent.ts` | 183 | `data.usage as any` | 同上 |
| `src/lib/packed-memory-injector.ts` | 54 | `node.data as any` | ReactFlow 泛型节点数据 |
| `src/components/layout/ai-coding-agent-config.tsx` | 38 | `window as any` | `showDirectoryPicker` API 缺少 TypeScript 定义 |
| `src/lib/ai-coding-executor.ts` | 117 | `data.item as any` | SSE 流解析 |
| `src/lib/packed-memory-writer.ts` | 79 | `agentNode.data as any` | ReactFlow 泛型节点数据 |
| `src/components/canvas/flow-editor.tsx` | 119 | `nodeTypes as any, edgeTypes as any` | ReactFlow 类型不匹配 |
| `src/components/canvas/flow-editor.tsx` | 143 | 同上模式（preview） | 同上 |

### 3.4 TODO/FIXME

- src/ 目录：**0 处**

### 3.5 超过 300 行的文件

| 文件 | 行数 | 评估 |
|------|------|------|
| `src/lib/i18n.ts` | 878 | 翻译字典，内聚性高，可考虑外置为 JSON |
| `src/hooks/useFlowExecution.ts` | 389 | 混合执行调度、SSE 处理和状态管理 |
| `src/lib/github-downloader.ts` | 389 | 混合 URL 解析、HTTP 下载和内容解析 |
| `src/components/playground/ChatPanel.tsx` | 341 | 混合传输逻辑和 UI 渲染 |

## 4. 安全性

### 4.1 `new Function` / `eval`

- `eval()` 使用：**0 处**
- `new Function()` 使用：**1 处** — `src/lib/condition-expression.ts:45`
  ```
  new Function("use strict"; return (${sanitized}))()
  ```
- **缓解措施：**
  - 正则白名单：仅允许数字、字符串、比较符、布尔运算、括号
  - `compare()` 函数做安全比较操作
- **残余风险：** 白名单可能无法覆盖所有边缘（如模板字面量、Unicode 转义序列）
- **风险等级：Medium** — 白名单有效限制了输入面，但未做沙箱隔离

### 4.2 路径遍历

- `workspace-manager.ts`：使用 `SAFE_ID_RE` 正则验证 flowId，`path.resolve` + 根目录包含检查
- API 路由统一使用 `assertSafeId()` 和 `assertSafeName()` 校验
- `src/app/api/tools/claude-code/diff/route.ts`：验证 workDir 相对于项目根目录
- **评估：** 防护措施一致且有效

### 4.3 API 鉴权

- `requireMutationAuth()` 在所有 POST/PUT/DELETE/PATCH 端点上**一致使用** — 良好
- GET 端点**不做认证** — 本地优先应用的设计选择
- **鉴权机制：**
  - 检查请求是否来自 localhost（`LOCAL_HOSTS` 集合）
  - 或验证 `x-flowcraft-token` header
- **安全隐患：** localhost 检查依赖 Host header，经过代理时可被伪造

### 4.4 API Key 泄露防护

- Settings GET 使用 `maskSettings()` 函数对 key 字段返回 `REDACTED`
- `KEY_FIELDS` 包括：anthropicApiKey, openaiApiKey, deepseekApiKey, tavilyApiKey, braveApiKey, apiToken
- **潜在问题：** E2E 测试发现 `deepseekApiKey` 以明文返回 — 可能 settings.json 中的字段名与 `KEY_FIELDS` 不匹配

### 4.5 `NEXT_PUBLIC_` 暴露

- src/ 中 **0 处** 使用 `NEXT_PUBLIC_` 前缀环境变量 — 安全

### 4.6 CORS

- 未找到显式 CORS 配置，依赖 Next.js 默认同源策略

## 5. 功能逻辑

### 5.1 flow-executor.ts（213 行）

- `topologicalSort`：BFS + visited 集合，跳过已访问节点（处理环）
- `findStartNodes`：正确识别无入边节点
- `areUpstreamsCompleteOrSkipped`：检查上游完成状态后再调度
- `markBranchSkipped`：向下游传播跳过状态
- `findLoopEdgeIds`：识别回边以支持循环
- **评估：逻辑正确**

### 5.2 condition-expression.ts

- 双重求值模式：正则表达式求值 + LLM 自然语言求值
- 表达式白名单保守但可能有边缘情况
- `compare()` 处理数值比较时的类型强转

### 5.3 workspace-manager.ts

- `SAFE_ID_RE` 校验所有 ID
- `path.resolve` + 根目录包含检查
- **评估：安全边界良好**

### 5.4 flowStore.ts

- 标准 Zustand 模式
- `flowStore-pack-actions.ts` 在 store actions 内部调用 `fetch()` — 打破了 store 纯度

### 5.5 flow-execution-state.ts

- 通过 `useFlowStore.getState()` 直接访问 flowStore — 紧耦合

## 6. 代码结构建议

### 6.1 拆分建议

| 文件 | 行数 | 建议 |
|------|------|------|
| `useFlowExecution.ts` | 389 | 拆为 scheduler、node-runner、run-state 三个模块 |
| `github-downloader.ts` | 389 | 拆为 github-client、traversal、content-parser |
| `ChatPanel.tsx` | 341 | 分离传输 hook（`useChatTransport`）和 UI 渲染 |
| `i18n.ts` | 878 | 翻译内容移到独立的 JSON/模块文件 |

### 6.2 良好实践

- `flow-executor.ts`（213 行）— 聚焦、单一职责
- `condition-expression.ts` — 表达式求值与自然语言求值分离清晰
- API 路由 — 统一的 auth、validation、business logic 模式

---

## 7. 完整问题清单

| # | 严重程度 | 类别 | 描述 | 文件 | 修复建议 |
|---|----------|------|------|------|----------|
| 1 | Medium | 动态求值 | `new Function` 在表达式求值中使用，白名单可能有边缘绕过 | `src/lib/condition-expression.ts:45` | 替换为 AST 求值器或添加 vm.runInNewContext 沙箱 |
| 2 | Medium | 鉴权设计 | localhost 检查依赖 Host header，代理环境下可被伪造 | `src/lib/api-auth.ts` | 非 dev 环境强制 token；只信任平台验证的头 |
| 3 | Medium | 密钥泄露 | deepseekApiKey 可能未被 maskSettings 正确 REDACT | Settings GET API | 核实 KEY_FIELDS 与 settings.json 字段名一致 |
| 4 | Minor | 类型安全 | 8 处 `as any` 类型断言 | 见 3.3 表格 | SSE 数据定义类型化联合；ReactFlow 使用泛型参数 |
| 5 | Minor | 可维护性 | useFlowExecution 职责混杂（389 行） | `src/hooks/useFlowExecution.ts` | 按调度/执行/状态拆分 |
| 6 | Minor | 可维护性 | github-downloader 职责混杂（389 行） | `src/lib/github-downloader.ts` | 拆为 client/traversal/parser |
| 7 | Minor | 可维护性 | i18n 文件过大（878 行） | `src/lib/i18n.ts` | 翻译数据外置为独立 JSON |
| 8 | Minor | Store 纯度 | flowStore-pack-actions 在 store 内调用 fetch() | `src/store/flowStore-pack-actions.ts` | 将 fetch 逻辑移至 Service 层 |

## 待办清单

### P0 — 安全
- [ ] **#2** 修复 `api-auth.ts` 鉴权：非 dev 环境强制 `FLOWCRAFT_API_TOKEN`，不信任可伪造头
- [ ] **#3** 核实 `maskSettings()` 的 `KEY_FIELDS` 是否覆盖所有 settings.json 中的 key 字段名

### P1 — 中等优先级
- [ ] **#1** 替换 `new Function` 为安全的 AST 求值器或 vm 沙箱
- [ ] **#4** 减少 `as any` 使用，为 SSE 数据和 ReactFlow 节点添加类型定义

### P2 — 改进
- [ ] **#5-7** 拆分超长文件（useFlowExecution、github-downloader、i18n）
- [ ] **#8** 将 store 内 fetch 调用移至独立 Service 层
