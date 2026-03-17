# FlowCraft — Code Review Report

**日期：** 2026-03-16  
**Reviewer：** Codex  
**版本：** `aff0d8a8e1477dd7020fb0a8f5178607f3473be2`

---

## Executive Summary

总体评分（满分10分）：**5.8/10**  
主要发现：**3 个严重问题，5 个中等问题，4 个轻微问题**

本次 review 完成了静态代码审查、安全审查和 API 级验证。`TypeScript` 与 `ESLint` 均通过，但发现多个高风险安全问题（未鉴权代码执行、SSRF、路径遍历写文件）和若干功能一致性问题（API 发布端条件节点只支持 Anthropic，Settings 中 Tavily/Brave key 实际未被使用）。

---

## 待办清单（按严重程度）

- [ ] 高优先级：为 `POST /api/tools/execute` 增加鉴权与权限边界，禁止未授权任意代码执行（`src/app/api/tools/execute/route.ts:4`，`src/lib/tools/server-executor.ts:40`）。
- [ ] 高优先级：修复 `POST /api/skill/fetch` 的 SSRF 风险，限制协议/域名/IP 段，禁止访问内网与本机地址（`src/app/api/skill/fetch/route.ts:6`）。
- [ ] 高优先级：为 `GET/POST /api/flows/[id]/runs` 增加 `id` 白名单校验，阻断路径遍历（`src/app/api/flows/[id]/runs/route.ts:11`）。

- [ ] 中优先级：修复 `POST /api/flows/{id}/run` 中 condition 自然语言模式仅 Anthropic 生效的问题（`src/app/api/flows/[id]/run/route.ts:75-85`）。
- [ ] 中优先级：让 Tavily/Brave key 真正从 `settings.json` 读取，不再依赖 `NEXT_PUBLIC_*`（`src/app/api/agent/run/route.ts:61-64`，`src/app/api/agent/chat/route.ts:60-63`，`src/lib/skills/base.ts:30-33`）。
- [ ] 中优先级：为公开 API 路由补充最小鉴权（至少写操作与执行操作），避免公网暴露风险。
- [ ] 中优先级：运行中止时不要记录为 `success`，增加 `stopped/cancelled` 状态（`src/hooks/useFlowExecution.ts:86`, `src/hooks/useFlowExecution.ts:261-270`）。
- [ ] 中优先级：Undo/Redo 历史应按 flow 维度隔离并在切换 flow 时重置（`src/hooks/useUndoRedo.ts:14-17`）。

- [ ] 低优先级：补齐 i18n，移除硬编码用户可见文本（如 `src/components/canvas/flow-editor.tsx:184`, `src/components/canvas/pack-agent-dialog.tsx:40`, `src/components/canvas/nodes/output-node.tsx:72`）。
- [ ] 低优先级：拆分超长组件/逻辑文件，满足项目规范阈值（组件 <=150 行、逻辑 <=200 行）。
- [ ] 低优先级：减少 `any` / `as any` 使用，补齐节点 data 类型定义。
- [ ] 低优先级：在 CI 中增加自动化 E2E 执行环境校验，避免本地沙箱导致测试不可运行。

---

## 1. 代码质量

### 1.1 TypeScript 编译
- 命令：`npx tsc --noEmit`
- 结果：✅ 通过（无类型错误输出）

### 1.2 ESLint
- 命令：`npm run lint`
- 结果：✅ 通过（无 warning/error）

### 1.3 文件规范合规

组件文件 >150 行（部分）：
- `src/components/playground/ChatPanel.tsx` (322)
- `src/components/layout/agent-config-panel.tsx` (249)
- `src/components/layout/top-toolbar.tsx` (226)
- `src/components/canvas/flow-editor.tsx` (189)
- `src/components/canvas/nodes/input-node.tsx` (188)

逻辑文件 >200 行（部分）：
- `src/lib/github-downloader.ts` (336)
- `src/hooks/useFlowExecution.ts` (249)
- `src/lib/i18n.ts` (246)
- `src/store/flowStore.ts` (231)

结论：⚠️ 不满足文档中“文件长度”规范。

### 1.4 代码模式问题

- 硬编码 API key：未发现真实硬编码密钥；仅占位符（如 `sk-ant-...`）出现于设置页 placeholder。✅
- `console.log(` 遗留：未发现。✅
- `any` 使用：
  - `: any` 命中 2 处
  - `as any` + `: any` 总命中 18 处（如 `src/hooks/useFlowExecution.ts:59`, `src/components/canvas/nodes/generic-node.tsx:7`）
- TODO/FIXME/HACK/XXX：未命中。✅

---

## 2. 安全性

### 2.1 高风险问题

1. **未鉴权远程代码执行（RCE）**  
位置：`src/app/api/tools/execute/route.ts:4`，`src/lib/tools/server-executor.ts:12`, `:40`  
说明：接口可直接接收并执行 JS/Python 代码，未做鉴权/租户隔离。  
复现：
- `POST /api/tools/execute` with `{"toolName":"code_execute","input":{"code":"console.log(2+2)"}}` 返回 `4`
- `POST /api/tools/execute` with Python 代码返回执行结果 `5`

2. **SSRF（服务端请求伪造）**  
位置：`src/app/api/skill/fetch/route.ts:6-12`  
说明：仅校验 `startsWith('http')`，可请求任意 URL（含本机/内网）。  
复现：
- `POST /api/skill/fetch` 传 `http://localhost:3000/api/settings`，成功返回内部接口内容。

3. **路径遍历写文件（flow runs）**  
位置：`src/app/api/flows/[id]/runs/route.ts:11-13`, `:36`  
说明：`id` 未做安全校验，`path.join(FLOWS_DIR, `${flowId}-runs.json`)` 可写出 `flows/` 目录。  
复现：
- `POST /api/flows/..%2F..%2Freviewpoc/runs` 返回 `{"ok":true}`
- 实际落盘到 `D:\Developer\reviewpoc-runs.json`（越界写入成功）

### 2.2 中等风险问题

1. **API 发布端 condition 自然语言分支不完整**  
位置：`src/app/api/flows/[id]/run/route.ts:75-85`  
说明：该实现仅处理 Anthropic，OpenAI/DeepSeek 直接 `return false`，导致分支行为错误。

2. **Tavily/Brave key 管理与设置页不一致**  
位置：`src/app/api/agent/run/route.ts:61-64`, `src/app/api/agent/chat/route.ts:60-63`, `src/lib/skills/base.ts:30-33`, `src/lib/mcp/servers.ts:25-27`  
说明：运行时依赖 `NEXT_PUBLIC_TAVILY_KEY` / `BRAVE_API_KEY`，而不是 `settings.json` 中的 `tavilyApiKey` / `braveApiKey`，导致“设置页可配但不生效”。

3. **公开 API 缺乏鉴权边界**  
位置：`src/app/api/**`（执行、写入类接口）  
说明：在非本机场景下风险较高，建议最少加入 token/session 验证。

4. **表达式求值仍执行用户输入代码**  
位置：`src/app/api/condition/eval/route.ts:48-54`  
说明：当前是 `vm.Script` + timeout，优于 `new Function`，但仍建议改为 DSL/安全解析器。

### 2.3 建议

- 先封住执行面（`/api/tools/execute` + SSRF + path traversal），再补功能一致性问题。  
- 对所有涉及文件系统的 route 统一复用 `assertSafeId/assertSafeName`。
- 对外提供 API 时加入鉴权与速率限制。

---

## 3. 功能完整性

| # | 功能 | 结论 | 说明 |
|---|---|---|---|
| 1 | Flow 持久化 | ✅ 完整 | API 级验证通过：创建/保存/读取/删除流程可用。 |
| 2 | 首页 flow 列表/新建/删除 | ⚠️ 部分完成 | 代码实现完整；因浏览器自动化受限，未做本轮 UI 点击回归。 |
| 3 | Settings API Key 配置 | ⚠️ 部分完成 | 页面与存储存在；但 Tavily/Brave key 未接入运行时。 |
| 4 | Output 节点显示最终输出 | ✅ 完整 | 输出渲染、复制、弹窗查看已实现。 |
| 5 | Pack into Agent | ✅ 完整 | 选中节点可打包并写入本地 agent。 |
| 6 | Condition 分支执行 | 🐛 有 bug | Canvas 路径可用；API 发布端仅 Anthropic，OpenAI/DeepSeek 逻辑错误。 |
| 7 | Workspace 文件系统 | ✅ 完整 | 初始化/列文件/progress/context API 验证通过。 |
| 8 | 运行历史 | ⚠️ 部分完成 | 基本记录可用；但“手动停止”会被记为 success。 |
| 9 | YAML 导出 | ⚠️ 部分完成 | 导出实现存在；本轮未能执行浏览器下载验证。 |
|10| API 发布端点 `/api/flows/{id}/run` | ⚠️ 部分完成 | 可返回 `runId` 并轮询；condition 自然语言逻辑存在 provider 分支缺陷。 |
|11| 中英文切换 | ⚠️ 部分完成 | 基础机制存在；大量用户可见文案仍硬编码，未完全走 `t()`。 |

---

## 4. 自动化测试结果

### 环境结论
- 已检测到 dev server：`http://localhost:3000`（另有 3001/3002）。
- Playwright 在本沙箱环境无法启动浏览器进程：`spawn EPERM`。
- 报错示例：`chrome-headless-shell.exe ... spawn EPERM`。

### 场景结果

| 场景 | 结果 | 备注 |
|---|---|---|
| T1 首页基础功能 | ⚠️ 未执行 | Playwright 浏览器启动被沙箱阻断 |
| T2 画布基础操作 | ⚠️ 未执行 | 同上 |
| T3 Flow 持久化（UI） | ⚠️ 未执行 | 同上 |
| T4 Settings 页面（UI） | ⚠️ 未执行 | 同上 |
| T5 中英文切换（UI） | ⚠️ 未执行 | 同上 |
| T6 YAML 导出（UI） | ⚠️ 未执行 | 同上 |
| T7 API 发布端点 | ✅ 已执行 | `FLOW_ID=flow-1773629834959` 返回 `{"runId":"..."}`；对纯 Input/Output flow 验证到 `STATUS=done` |
| T8 运行历史（UI） | ⚠️ 未执行 | 同上 |
| T9 Playground（UI） | ⚠️ 未执行 | 同上 |

截图目录：`doc/review-screenshots/`（本轮未生成新截图）

---

## 5. Bug 清单

| # | 严重程度 | 描述 | 位置 | 复现步骤 |
|---|---|---|---|---|
| 1 | 高 | 未鉴权任意代码执行（JS/Python） | `src/app/api/tools/execute/route.ts:4`; `src/lib/tools/server-executor.ts:12,40` | 调用 `/api/tools/execute` 提交代码，接口直接执行并返回结果 |
| 2 | 高 | `skill/fetch` 存在 SSRF | `src/app/api/skill/fetch/route.ts:6-12` | 请求体 `{"url":"http://localhost:3000/api/settings"}` 可读内部接口 |
| 3 | 高 | `flows/[id]/runs` 可路径遍历写文件 | `src/app/api/flows/[id]/runs/route.ts:11-13,36` | `POST /api/flows/..%2F..%2Freviewpoc/runs`，越界写入 `D:\Developer\reviewpoc-runs.json` |
| 4 | 中 | API 发布端 condition 自然语言仅 Anthropic 可用 | `src/app/api/flows/[id]/run/route.ts:75-85` | 阅读代码可见非 Anthropic 直接 `return false` |
| 5 | 中 | Tavily/Brave 设置项未接入运行时 | `src/app/api/agent/run/route.ts:61-64`; `src/app/api/agent/chat/route.ts:60-63`; `src/lib/skills/base.ts:30-33` | 在设置页修改 Tavily/Brave key 后，运行逻辑仍读环境变量 |
| 6 | 中 | 手动停止运行仍记录 success | `src/hooks/useFlowExecution.ts:86,91,261-270` | `isRunning=false` 跳出循环后 `runStatus` 仍默认 success |
| 7 | 中 | Undo/Redo 历史跨 flow 共享 | `src/hooks/useUndoRedo.ts:14-17` | 切换 flow 不重置 module-level history/cursor |
| 8 | 低 | i18n 未全量覆盖，存在硬编码文案 | 例如 `src/components/canvas/flow-editor.tsx:184`; `src/components/canvas/pack-agent-dialog.tsx:40`; `src/components/canvas/nodes/output-node.tsx:72` | 切换语言后部分文案不变化 |
| 9 | 低 | `any` 使用较多，削弱类型约束 | 多处（如 `src/hooks/useFlowExecution.ts:59`, `src/components/canvas/nodes/generic-node.tsx:7`） | 静态扫描命中 18 处 |

---

## 6. 改进建议

1. 先修复安全红线：`/api/tools/execute`、`/api/skill/fetch`、`/api/flows/[id]/runs`。  
2. 统一配置读取路径：所有 provider/tool key 都从 `settings.json`（服务端）读取，移除 `NEXT_PUBLIC_*` 在服务端的依赖。  
3. API 发布执行引擎与前端执行引擎对齐（尤其 condition provider 分支）。  
4. 完善运行状态模型（`success/error/stopped`），避免历史误报。  
5. 拆分超长组件与 store，降低认知负担，提升可测性。  
6. 补齐 i18n 与 E2E CI（可用环境中运行 Playwright）。

---

## 7. 附录：测试截图

- 本轮受沙箱限制（`spawn EPERM`）未生成新的 Playwright 截图。  
- 目标目录：`D:/Developer/flowcraft/doc/review-screenshots/`
