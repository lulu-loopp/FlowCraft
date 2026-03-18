# FlowCraft — Codex Review 任务说明（静态分析）

> **职责范围：** 代码质量、安全性、代码模式检查、功能逻辑静态分析
> **不包含：** 浏览器测试、架构评审（由其他 reviewer 负责）
> **最终输出：** `doc/review-static.md`

---

## 项目背景

FlowCraft 是一个 **Next.js 16 App Router** 可视化 AI agent 编排工具。

- 主要页面：`/`（首页）、`/canvas/[flowId]`（画布）、`/playground`（对话测试）、`/settings`（配置）
- 状态管理：Zustand（flowStore、uiStore、agent-store）
- AI 提供商：Anthropic / DeepSeek / OpenAI（key 在 `settings.json` 或 `.env.local`）

---

## Step 1：TypeScript 编译检查

```bash
npx tsc --noEmit 2>&1
```

- 记录所有类型错误，按严重程度分类
- 特别关注 `any` 类型的使用是否合理

---

## Step 2：ESLint 检查

```bash
npm run lint 2>&1
```

- 记录所有 warning 和 error
- 区分"应修复"和"可忽略"

---

## Step 3：代码模式扫描

依次运行以下命令，记录结果：

```bash
# A. 硬编码 API key（严重）
grep -r "sk-ant\|sk-proj\|sk-" src/ --include="*.ts" --include="*.tsx" | grep -v ".env\|settings\|test"

# B. console.log 遗留（轻微）
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx"

# C. any 类型统计
grep -rn ": any" src/ --include="*.ts" --include="*.tsx"
# 对每个 any 判断：是否可以用具体类型替代？是否是第三方库兼容性需要？

# D. TODO/FIXME 遗留
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx"

# E. 超过 300 行的文件（需人工评估是否职责混杂）
find src/components -name "*.tsx" -exec awk 'END{if(NR>300) print FILENAME": "NR" lines"}' {} \;
find src/lib src/hooks -name "*.ts" -exec awk 'END{if(NR>300) print FILENAME": "NR" lines"}' {} \;

# F. 未走 i18n 的硬编码中文/英文字符串（抽查）
grep -rn "\"[A-Z][a-z].*\"" src/components/ --include="*.tsx" | grep -v "import\|className\|console\|key=\|type=\|id=" | head -30
```

---

## Step 4：安全性深度检查

### 4.1 代码注入风险（高优先级）

```bash
# eval / new Function 使用
grep -rn "eval(\|new Function(" src/ --include="*.ts" --include="*.tsx"
```

**重点文件：`src/app/api/condition/eval/route.ts`**
- 使用了 `new Function()` 执行用户输入的表达式，这是已知的设计选择
- 需评估：是否有输入白名单/黑名单？是否限制了可访问的全局对象？超时保护？
- 标注风险等级（高/中/低）并给出具体的加固建议

### 4.2 文件系统安全

```bash
# 所有 fs 操作
grep -rn "fs\.\|readFile\|writeFile\|readdir\|mkdir\|unlink" src/app/api/ --include="*.ts"
```

**重点文件：`src/lib/workspace-manager.ts`**
- 检查路径拼接是否使用了 `path.resolve` / `path.join`
- 是否有防止 `../../` 路径遍历的校验（如限制在特定根目录内）
- 用户输入的文件名是否做了清洗

### 4.3 API 路由鉴权

```bash
# 检查 API routes 中 API key 的处理方式
grep -rn "anthropicApiKey\|deepseekApiKey\|openaiApiKey" src/app/api/ --include="*.ts"
```

逐一检查以下 API 端点，回答"是否有鉴权？未鉴权是否合理？"：

| 端点 | 文件 | 需确认 |
|------|------|--------|
| `POST /api/flows/{id}/run` | `src/app/api/flows/[id]/run/route.ts` | 公开端点是否需要 API key 验证？ |
| `POST /api/agent/run` | `src/app/api/agent/run/route.ts` | 是否正确从 settings.json 读取 key？ |
| `POST /api/condition/eval` | `src/app/api/condition/eval/route.ts` | 除 new Function 外还有什么风险？ |
| `GET/POST /api/workspace/*` | `src/app/api/workspace/` | 文件读写是否有权限边界？ |
| `GET/POST /api/settings` | `src/app/api/settings/route.ts` | API key 是否可能通过响应泄露？ |

### 4.4 前端暴露检查

```bash
# NEXT_PUBLIC_ 变量（会打包到客户端 JS）
grep -rn "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx"

# CORS 配置
grep -rn "Access-Control\|cors" src/ --include="*.ts"
```

---

## Step 5：功能逻辑静态分析

逐一阅读以下核心文件，对每项功能回答三个问题：
1. 逻辑是否完整？有无明显遗漏的分支/边界 case？
2. 错误处理是否充分？（try-catch、用户友好的错误信息）
3. 是否有潜在的竞态条件或状态不一致？

### 5.1 Flow 执行引擎（核心，仔细看）

- `src/lib/flow-executor.ts` — 拓扑排序算法是否正确？环检测？
- `src/hooks/useFlowExecution.ts` — 分支跳过逻辑：当 condition 为 false 时，被跳过分支下游的所有节点是否正确处理？
- 并发执行：同一层级的多个节点是否并行？是否有 race condition？

### 5.2 Flow 持久化

- `src/lib/flow-storage.ts` — 读写 `flows/` 目录，文件格式是否一致？
- `src/hooks/useFlowPersistence.ts` — 自动保存/手动保存的逻辑，是否有防抖？保存失败的处理？

### 5.3 条件节点

- `src/components/canvas/nodes/condition-node.tsx` — UI 是否正确显示 true/false handles？
- `src/app/api/condition/eval/route.ts` — 表达式求值的输入输出格式

### 5.4 Settings / API Key 管理

- `src/lib/settings-storage.ts` — key 存储位置、格式
- `src/app/api/agent/run/route.ts` — 运行时如何读取 key？回退逻辑？

### 5.5 其余功能（快速扫描）

- 首页 flow 列表：`src/app/page.tsx`、`src/components/home/`
- Output 节点：`src/components/canvas/nodes/output-node.tsx`
- Pack into Agent：`src/components/canvas/pack-agent-dialog.tsx`
- Workspace：`src/lib/workspace-manager.ts`
- 运行历史：`src/app/api/flows/[id]/runs/route.ts`
- YAML 导出：在 `canvas/[flowId]/page.tsx` 或 toolbar 中寻找
- i18n：`src/lib/i18n.ts` — 中英翻译是否完整覆盖所有 UI 文字？
- API 发布：`src/app/api/flows/[id]/run/route.ts`

---

## Step 6：代码结构建议（不强制行数）

> **注意：不要求所有文件低于某个行数。** 请以"单一职责"为标准评估。

对以下情况给出具体建议：
- **超过 300 行且职责混杂的文件** — 建议如何拆分，拆成哪些文件
- **过度拆分导致理解困难的情况** — 建议合并
- **重复代码** — 是否有多处相似逻辑可以抽取为共用函数/hook
- **命名不清晰的文件或函数** — 建议更好的命名

---

## 输出格式

输出文件：`doc/review-static.md`

```markdown
# FlowCraft — 静态分析 Review 报告

**日期：** YYYY-MM-DD
**Reviewer：** Codex
**版本：** git commit hash

---

## Executive Summary

总计发现：X 个严重问题，X 个中等问题，X 个轻微问题

---

## 1. TypeScript 编译结果

（列出所有类型错误，标注严重程度）

## 2. ESLint 结果

（列出需修复的 warning/error）

## 3. 代码模式问题

### 3.1 硬编码 API key
### 3.2 console.log 遗留
### 3.3 any 类型使用
### 3.4 TODO/FIXME 遗留
### 3.5 未国际化的硬编码字符串

## 4. 安全性

### 4.1 高风险：代码注入（new Function）
### 4.2 高风险：文件系统路径遍历
### 4.3 中风险：API 端点鉴权缺失
### 4.4 低风险：前端变量暴露

（每项给出：当前状态描述、风险等级、具体修复建议）

## 5. 功能逻辑问题

### 5.1 执行引擎
### 5.2 Flow 持久化
### 5.3 条件节点
### 5.4 Settings
### 5.5 其他功能

（每项标注 ✅ 无问题 / ⚠️ 有隐患 / 🐛 有 bug，附具体描述）

## 6. 代码结构建议

（按优先级列出拆分/合并/重命名建议，每条附理由）

## 7. 完整问题清单

| # | 严重程度 | 类别 | 描述 | 文件位置 | 建议修复方式 |
|---|---------|------|------|---------|------------|

```

---

## 注意事项

1. **不需要启动 dev server** — 本次 review 全部基于静态代码分析
2. **不需要运行 Playwright 测试** — 浏览器测试由 Claude Code 负责
3. **不需要做架构评审** — 架构层面由 Gemini 负责
4. **`settings.json` 中有 DeepSeek key** — review 时注意此文件是否在 `.gitignore` 中
5. **已知情况：** `.env.local` 的 `ANTHROPIC_API_KEY=sk-ant-xxxxxxxx` 是占位符
6. **问题清单是最重要的交付物** — 确保每个问题都有明确的文件位置和修复建议，方便后续批量修复
