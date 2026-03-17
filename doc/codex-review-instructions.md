# FlowCraft — Codex Review 任务说明

> 本文档供 Codex 执行完整项目 review 使用。如果对话过长请重读本文档以恢复上下文。

---

## 任务目标

对 FlowCraft 项目进行全面的代码 review，包含：
1. **代码质量** — 结构、规范、可维护性
2. **功能完整性** — 对照需求文档验证每项功能
3. **安全性** — API key 泄露、注入风险、权限控制
4. **自动化功能测试** — 使用 playwright-skill 运行浏览器测试
5. **Bug 清单** — 发现并记录所有问题

最终输出：`doc/review-report.md`

---

## 项目背景

FlowCraft 是一个 **Next.js 16 App Router** 可视化 AI agent 编排工具。

- 开发服务器：`http://localhost:3000`（运行 `npm run dev` 启动）
- 主要页面：
  - `/` — 首页（flow 列表）
  - `/canvas/[flowId]` — 画布编辑器
  - `/playground` — Agent 对话测试
  - `/settings` — API Key 配置
- 状态管理：Zustand（flowStore、uiStore、agent-store）
- AI 提供商：Anthropic / DeepSeek / OpenAI（key 在 `settings.json` 或 `.env.local`）

---

## 已实现功能清单（Stage 2）

以下功能已完成，review 时需逐一验证：

| # | 功能 | 核心文件 |
|---|------|---------|
| 1 | Flow 持久化（保存/加载到 `flows/` 目录） | `src/lib/flow-storage.ts`, `src/hooks/useFlowPersistence.ts` |
| 2 | 首页 — flow 列表、新建、删除 | `src/app/page.tsx`, `src/components/home/` |
| 3 | Settings 页面 — API Key 配置 | `src/app/settings/page.tsx`, `src/lib/settings-storage.ts` |
| 4 | Output 节点 — 显示最终输出 | `src/components/canvas/nodes/output-node.tsx` |
| 5 | 节点封装成 Agent（Pack into Agent） | `src/components/canvas/pack-agent-dialog.tsx`, `src/app/api/agents/local/route.ts` |
| 6 | 条件节点执行（true/false 分支路由） | `src/components/canvas/nodes/condition-node.tsx`, `src/app/api/condition/eval/route.ts` |
| 7 | Workspace 文件系统（agent 间共享上下文） | `src/lib/workspace-manager.ts`, `src/app/api/workspace/` |
| 8 | 运行历史 | `src/app/api/flows/[id]/runs/route.ts`, `src/store/flowStore.ts` |
| 9 | YAML 导出 | `src/app/canvas/[flowId]/page.tsx` 或 toolbar |
| 10 | API 发布（`POST /api/flows/{id}/run`） | `src/app/api/flows/[id]/run/route.ts` |
| 11 | 中英文切换 | `src/lib/i18n.ts`, `src/store/uiStore.ts` |

---

## Review 执行步骤

### Step 1：确认环境

```bash
cd D:/Developer/flowcraft
# 检查 dev server 是否运行
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
# 如果不是 200，启动它：
# npm run dev &
```

### Step 2：代码质量 Review

阅读并评估以下维度，记录问题：

**A. 文件结构与规范**
- 组件文件是否 ≤ 150 行？逻辑文件 ≤ 200 行？
- 每个组件是否只做一件事？
- 通用组件是否在 `src/components/ui/`？
- 颜色/间距是否从 `src/styles/tokens.ts` 取？
- 所有用户可见文字是否走 `t()` 函数（`src/lib/i18n.ts`）？

**B. TypeScript 质量**
```bash
cd D:/Developer/flowcraft
npx tsc --noEmit 2>&1
```
记录所有类型错误。

**C. ESLint**
```bash
npm run lint 2>&1
```
记录所有 lint 警告/错误。

**D. 关键代码模式检查**
```bash
# 检查是否有硬编码 API key
grep -r "sk-ant\|sk-proj\|sk-" src/ --include="*.ts" --include="*.tsx" | grep -v ".env\|settings\|test"

# 检查是否有 console.log 遗留
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx"

# 检查是否有 any 类型滥用
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | wc -l

# 检查 TODO/FIXME
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx"
```

### Step 3：安全性检查

```bash
# 1. 检查 API routes 是否暴露敏感信息
grep -rn "anthropicApiKey\|deepseekApiKey\|openaiApiKey" src/app/api/ --include="*.ts"

# 2. 检查 eval/Function 使用（XSS/代码注入风险）
grep -rn "eval(\|new Function(" src/ --include="*.ts" --include="*.tsx"

# 3. 检查 CORS 配置
grep -rn "Access-Control\|cors" src/ --include="*.ts"

# 4. 检查文件系统操作是否有路径遍历风险
grep -rn "fs\." src/app/api/ --include="*.ts" | head -20

# 5. 检查 NEXT_PUBLIC_ 前缀变量（会暴露到前端）
grep -rn "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx"
```

重点关注：
- `src/app/api/condition/eval/route.ts` — 使用了 `new Function()` 执行用户输入，**高风险**
- `src/lib/workspace-manager.ts` — 文件系统操作，检查路径拼接

### Step 4：功能实现验证（静态代码分析）

逐一阅读每项功能的核心文件，回答：
- 是否完整实现了需求规格中描述的行为？
- 是否有明显的逻辑错误？
- 错误处理是否充分？

重点检查：
1. **Condition 节点** — `src/app/api/condition/eval/route.ts` 的表达式模式使用 `new Function` 是否有沙箱？
2. **Flow 执行引擎** — `src/hooks/useFlowExecution.ts` 的拓扑排序和分支跳过逻辑
3. **API key 读取** — `src/app/api/agent/run/route.ts` 是否正确从 `settings.json` 读取

### Step 5：自动化功能测试（playwright-skill）

**Playwright skill 路径：`C:/Users/29280/.codex/skills/playwright-skill`**

执行以下测试场景，每个场景截图保存到 `D:/Developer/flowcraft/doc/review-screenshots/`：

```bash
mkdir -p D:/Developer/flowcraft/doc/review-screenshots
```

**测试脚本写到 `D:/Developer/flowcraft/doc/test-*.js`，用以下方式执行：**
```bash
cd C:/Users/29280/.codex/skills/playwright-skill
node run.js D:/Developer/flowcraft/doc/test-<name>.js
```

需要覆盖的测试场景：

#### T1: 首页基础功能
- 访问 `http://localhost:3000`
- 验证：FlowCraft 品牌、"New flow" 按钮、flow 列表（或空状态）
- 点击 "New flow" → 验证跳转到 `/canvas/[id]`

#### T2: 画布基础操作
- 在画布上拖入 Agent 节点
- 点击 Agent 节点，验证右侧配置面板打开
- 在 System Prompt 输入框输入文字，验证能正常输入（不丢失焦点）
- 拖入 Condition 节点，验证 true/false handle 显示

#### T3: Flow 持久化
- 创建一个新 flow，拖入 Agent 节点
- 点击 Save 按钮
- 刷新页面
- 验证节点仍然存在（Flow 正确持久化）

#### T4: Settings 页面
- 访问 `/settings`
- 验证所有 API key 输入框存在（Anthropic, OpenAI, DeepSeek, Tavily, Brave）
- 尝试输入并保存 API key

#### T5: 中英文切换
- 在首页点击语言切换按钮（EN/中文）
- 验证页面文字切换
- 在画布页同样验证

#### T6: YAML 导出
- 在有节点的画布上，找到 "Export YAML" 按钮
- 点击，验证下载/显示 YAML 内容
- 验证 YAML 格式正确

#### T7: API 发布端点（API 测试）
```bash
# 测试 /api/flows/{id}/run 端点
# 先获取一个 flow id
FLOW_ID=$(curl -s http://localhost:3000/api/flows | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d)[0]?.id || 'none')")
echo "Testing flow: $FLOW_ID"

curl -s -X POST "http://localhost:3000/api/flows/$FLOW_ID/run" \
  -H "Content-Type: application/json" \
  -d '{"input":"test"}' | head -c 200
```

#### T8: 运行历史
- 在画布上运行一个简单 flow（只有 Input + Output 节点，无 Agent）
- 检查右侧面板 History tab
- 验证运行记录出现

#### T9: Playground 页面
- 访问 `/playground`
- 验证页面加载
- 输入一条消息，验证 UI 响应（无需 API key 成功，只验证 UI 行为）

### Step 6：生成 Review 报告

输出文件：`D:/Developer/flowcraft/doc/review-report.md`

报告格式：

```markdown
# FlowCraft — Code Review Report

**日期：** YYYY-MM-DD
**Reviewer：** Codex
**版本：** git commit hash

---

## Executive Summary

总体评分（满分10分）：X/10
主要发现：X 个严重问题，X 个中等问题，X 个轻微问题

---

## 1. 代码质量

### 1.1 TypeScript 编译
### 1.2 ESLint
### 1.3 文件规范合规
### 1.4 代码模式问题

---

## 2. 安全性

### 2.1 高风险问题
### 2.2 中等风险问题
### 2.3 建议

---

## 3. 功能完整性

每项功能的 ✅ 完整 / ⚠️ 部分完成 / ❌ 未完成 / 🐛 有 bug

---

## 4. 自动化测试结果

每个测试场景的结果，附截图路径

---

## 5. Bug 清单

| # | 严重程度 | 描述 | 位置 | 复现步骤 |
|---|---------|------|------|---------|

---

## 6. 改进建议

按优先级排序

---

## 7. 附录：测试截图

```

---

## 注意事项

1. **dev server 必须运行** — `http://localhost:3000` 需要可访问
2. **playwright-skill 路径** — `C:/Users/29280/.codex/skills/playwright-skill`，用 `node run.js <script>` 执行
3. **截图路径** — 保存到 `D:/Developer/flowcraft/doc/review-screenshots/`
4. **测试脚本** — 写到 `D:/Developer/flowcraft/doc/test-*.js`，不要写到 skill 目录
5. **API key** — `settings.json` 里有 DeepSeek key，可用于测试 AI 功能
6. **已知情况** — `.env.local` 的 `ANTHROPIC_API_KEY=sk-ant-xxxxxxxx` 是占位符，Anthropic 相关调用会失败
7. **条件节点安全风险** — `new Function()` 执行用户输入的表达式，这是已知的设计选择，但 review 时需标注风险等级

---

## 项目核心文件索引

```
src/
├── app/
│   ├── page.tsx                          # 首页
│   ├── canvas/[flowId]/page.tsx          # 画布页
│   ├── playground/page.tsx               # Playground
│   ├── settings/page.tsx                 # Settings
│   └── api/
│       ├── agent/run/route.ts            # Agent 执行（SSE）
│       ├── agent/chat/route.ts           # Playground chat
│       ├── condition/eval/route.ts       # 条件节点求值 ⚠️ new Function
│       ├── flows/route.ts                # Flow CRUD
│       ├── flows/[id]/route.ts           # 单个 Flow
│       ├── flows/[id]/run/route.ts       # API 发布端点
│       ├── flows/[id]/runs/route.ts      # 运行历史
│       ├── flows/runs/[runId]/route.ts   # 运行状态查询
│       ├── workspace/[flowId]/route.ts   # Workspace 上下文
│       └── settings/route.ts            # Settings CRUD
├── components/
│   ├── canvas/
│   │   ├── flow-editor.tsx               # 画布核心
│   │   ├── nodes/condition-node.tsx      # 条件节点
│   │   └── pack-agent-dialog.tsx         # 节点封装对话框
│   └── layout/
│       ├── top-toolbar.tsx
│       ├── left-panel.tsx
│       ├── right-panel.tsx
│       └── agent-config-panel.tsx
├── hooks/
│   ├── useFlowExecution.ts               # 执行引擎
│   └── useFlowPersistence.ts             # 持久化
├── lib/
│   ├── flow-storage.ts                   # 文件系统 CRUD
│   ├── flow-executor.ts                  # 拓扑排序 + 分支逻辑
│   ├── workspace-manager.ts              # Workspace 文件系统
│   ├── settings-storage.ts              # Settings 读写
│   ├── agent-runner.ts                  # Agent 执行核心
│   └── i18n.ts                          # 国际化翻译
└── store/
    ├── flowStore.ts                      # Canvas 状态
    ├── uiStore.ts                        # UI 状态（语言）
    └── agent-store.ts                   # Playground 状态
```
