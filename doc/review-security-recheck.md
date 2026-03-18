# FlowCraft 安全复检报告（Security Recheck）

## 汇总

| 检查项 | 结论 | 严重级别 |
|---|---|---|
| 1. 鉴权覆盖率（`src/app/api/tools/**/route.ts`） | 所有 `POST/PUT/DELETE` 处理器均调用 `requireMutationAuth` | ✅ PASS |
| 2. `new Function` / `eval` 使用 | 命中 1 处 `new Function`、0 处 `eval(`；当前输入约束下未见可直接注入，但保留动态执行残余风险 | ⚠️ WARN |
| 3. 路径遍历（`workspace-manager.ts`） | `readWorkspaceFile` 与 `buildSessionContext` 均有路径/ID 校验 | ✅ PASS |
| 4. ESLint | `npm run lint` 成功，错误数 0 | ✅ PASS |

---

## 1. 鉴权覆盖率（`src/app/api/tools/**/route.ts`）

检查范围内共 9 个 `route.ts` 文件，逐一核查其 `POST/PUT/DELETE` 处理器。

| 文件 | 变更型 Handler | 鉴权检查 | 结论 |
|---|---|---|---|
| `src/app/api/tools/codex/mcps/route.ts` | `POST`(42), `DELETE`(75) | 分别在 43/76 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/skills/route.ts` | `POST`(42), `DELETE`(73) | 分别在 43/74 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/run/route.ts` | `POST`(27), `DELETE`(152) | 分别在 28/153 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/resolve-path/route.ts` | `POST`(6) | 在 7 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/mcps/route.ts` | `POST`(51), `PUT`(69), `DELETE`(98) | 分别在 52/70/99 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/interactive/route.ts` | `POST`(33) | 在 34 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/input/route.ts` | `POST`(5) | 在 6 行调用 `requireMutationAuth(req)` | ✅ PASS |
| `src/app/api/tools/claude-code/diff/route.ts` | 无（仅 `GET`） | 无需 mutation 鉴权 | ✅ PASS |
| `src/app/api/tools/claude-code/check/route.ts` | 无（仅 `GET`） | 无需 mutation 鉴权 | ✅ PASS |

结果：未发现缺失 `requireMutationAuth` 的 `POST/PUT/DELETE` 处理器。

---

## 2. `new Function` / `eval` 使用检查（`src/**/*.ts`）

检索命令：
- `rg -n "new Function" src --glob "*.ts"`
- `rg -n "eval\(" src --glob "*.ts"`

### 命中明细

1. 文件：`src/lib/condition-expression.ts:45`  
代码片段：
```ts
const result = new Function(`"use strict"; return (${sanitized})`)() as unknown;
```
风险评估：
- 上下文显示 `sanitized` 先经过严格白名单校验，仅允许 `[0-9+\-*/.()]`，并限制长度、校验括号配对。
- 在当前实现下，未见可拼接出任意 JS 语句的路径，未发现可直接利用的代码注入。
- 但该点仍属于动态代码执行原语，若后续放宽字符集或更改校验逻辑，可能重新引入注入面。

结论：⚠️ WARN（当前未见可利用注入，存在残余维护风险）

### `eval(` 结果

- 未检索到任何 `eval(` 命中（0 处）。

---

## 3. 路径遍历检查（`src/lib/workspace-manager.ts`）

### `readWorkspaceFile`（文件名路径校验）

关键校验代码（54-58 行）：
```ts
export async function readWorkspaceFile(flowId: string, filename: string): Promise<string> {
  const dir = await getWorkspaceDir(flowId);
  const fullPath = path.resolve(dir, filename);
  if (!fullPath.startsWith(path.resolve(dir) + path.sep) && fullPath !== path.resolve(dir)) {
    throw new Error('Invalid file path');
  }
```

判定：
- `path.resolve(dir, filename)` 后，要求目标路径必须位于工作目录下（或等于目录本身）。
- 可阻断 `../` 等目录逃逸场景。

### `buildSessionContext`（`nodeId` 参数校验）

关键校验代码（99-107 行）：
```ts
export async function buildSessionContext(flowId: string, nodeId: string): Promise<string> {
  if (!SAFE_ID_RE.test(nodeId)) {
    throw new Error(`Invalid nodeId: ${nodeId}`);
  }
  const [progress, featuresRaw, nodeMemory, sharedMemory] = await Promise.all([
    readWorkspaceFile(flowId, 'progress.md'),
    readWorkspaceFile(flowId, 'features.json'),
    readWorkspaceFile(flowId, `memory/${nodeId}.md`),
```
其中 `SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/`（18 行）。

判定：
- `nodeId` 不允许 `/`、`\`、`.` 等字符，`../` 无法通过。
- 之后的 `readWorkspaceFile` 仍会再次做路径约束，形成双重保护。

结论：✅ PASS（已具备防路径遍历校验）

---

## 4. ESLint 结果

执行命令：`npm run lint`  
输出摘要：
- `> flowcraft@0.1.0 lint`
- `> eslint`
- 进程退出码：`0`

结论：✅ PASS（错误数 0）
