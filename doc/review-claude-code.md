# FlowCraft — Claude Code Review 任务说明（E2E 功能测试）

> **职责范围：** Playwright 浏览器自动化测试、API 端点测试、UI bug 发现与即时验证
> **不包含：** 静态代码分析（Codex 负责）、架构评审（Gemini 负责）
> **最终输出：** `doc/review-e2e.md` + `doc/review-screenshots/` 截图
> **工作方式：** 启动 dev server → 逐个场景编写并执行测试 → 记录结果

---

## 项目背景

FlowCraft 是一个 Next.js 16 可视化 AI agent 编排工具。

- 开发服务器：`http://localhost:3000`
- 主要页面：`/`（首页）、`/canvas/[flowId]`（画布）、`/playground`（对话）、`/settings`（配置）
- 状态管理：Zustand
- AI 提供商：Anthropic / DeepSeek / OpenAI

---

## 环境准备

```bash
cd <项目根目录>

# 1. 确认 dev server 运行
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
# 如果不是 200：
npm run dev &
# 等待启动完成
sleep 5

# 2. 确认 Playwright 可用
npx playwright install chromium

# 3. 创建截图目录
mkdir -p doc/review-screenshots
```

---

## 测试执行原则

1. **逐个场景执行** — 写一个测试，跑一个测试，记录结果，再写下一个。不要批量生成。
2. **前一个测试的发现要反馈到后续测试** — 比如 T1 发现 "New Flow" 按钮的实际文字是 "Create Flow"，后续测试就用正确的 selector。
3. **每个场景至少一张截图** — 保存到 `doc/review-screenshots/T{N}-{描述}.png`
4. **测试失败时** — 记录失败原因、截图当时的页面状态。尝试手动排查是测试脚本问题还是真实 bug。
5. **发现 bug 时** — 记录详细复现步骤。如果是简单的 UI bug，可以尝试定位根因文件，但 **不要修改代码**（修复在 review 完成后统一进行）。

---

## 测试场景

### T1: 首页基础功能

**步骤：**
1. 访问 `http://localhost:3000`
2. 截图：首页整体

**验证点：**
- FlowCraft 品牌/logo 是否可见
- "New flow"（或类似）按钮是否存在
- Flow 列表区域是否显示（或空状态提示）
- 点击新建按钮 → 是否跳转到 `/canvas/[某个id]`
- 跳转后截图：画布页面是否正常加载

---

### T2: 画布基础操作

**前置：** 进入一个 canvas 页面

**步骤：**
1. 在左侧节点库找到 Agent 节点
2. 拖入画布（或点击添加）
3. 点击该 Agent 节点
4. 截图：右侧配置面板

**验证点：**
- Agent 节点是否成功出现在画布上
- 点击后右侧配置面板是否打开
- System Prompt 输入框是否存在
- 在输入框输入文字 → 文字是否正常显示（不丢失焦点、不被清空）
- 再拖入一个 Condition 节点 → 是否显示 true/false 两个输出 handle
- 截图：画布上有多个节点的状态

---

### T3: Flow 持久化

**步骤：**
1. 创建一个新 flow（从首页点击新建）
2. 在画布上添加一个 Agent 节点
3. 修改节点配置（如 system prompt）
4. 点击 Save 按钮（或触发自动保存）
5. 截图：保存后的状态
6. 刷新页面（hard refresh）
7. 截图：刷新后的状态

**验证点：**
- 刷新后节点是否仍然存在
- 节点位置是否保持
- 节点配置（system prompt）是否保持
- 如果有自动保存，是否有视觉反馈

---

### T4: Settings 页面

**步骤：**
1. 访问 `/settings`
2. 截图：Settings 页面整体

**验证点：**
- 页面是否正常加载
- 是否有以下 API key 输入框：Anthropic、OpenAI、DeepSeek、Tavily、Brave
- 尝试在某个输入框输入文字并保存
- 截图：保存后的状态
- 刷新页面 → 之前输入的值是否保持

---

### T5: 中英文切换

**步骤：**
1. 在首页找到语言切换入口（可能在顶部 toolbar、settings、或其他位置）
2. 切换到中文
3. 截图：中文状态的首页
4. 导航到画布页
5. 截图：中文状态的画布页
6. 切换回英文
7. 截图：英文状态

**验证点：**
- 语言切换入口是否容易找到
- 切换后所有 UI 文字是否变化（按钮、标题、提示文字）
- 是否有遗漏的未翻译文字
- 画布中的节点类型名称是否也切换
- 刷新后语言选择是否保持

---

### T6: YAML 导出

**前置：** 在画布上已有若干节点和连线

**步骤：**
1. 在画布 toolbar 或菜单中找到 "Export YAML" 按钮
2. 点击
3. 截图：导出结果（弹窗/下载/预览）

**验证点：**
- Export 按钮是否存在且可点击
- 导出内容是否为有效 YAML
- YAML 中是否包含 nodes 和 edges 信息
- 节点类型、配置是否正确反映

---

### T7: API 端点测试

**用命令行直接测试，不需要 Playwright：**

```bash
# 7.1 获取 flow 列表
curl -s http://localhost:3000/api/flows | head -c 500

# 7.2 获取第一个 flow 的 ID（如果列表非空）
FLOW_ID=$(curl -s http://localhost:3000/api/flows | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['id'] if data else 'NONE')")
echo "Flow ID: $FLOW_ID"

# 7.3 测试 API 发布端点
if [ "$FLOW_ID" != "NONE" ]; then
  curl -s -X POST "http://localhost:3000/api/flows/$FLOW_ID/run" \
    -H "Content-Type: application/json" \
    -d '{"input":"hello test"}' | head -c 500
fi

# 7.4 测试 Settings API
curl -s http://localhost:3000/api/settings | head -c 500

# 7.5 测试 Workspace API（如果有 flow）
if [ "$FLOW_ID" != "NONE" ]; then
  curl -s "http://localhost:3000/api/workspace/$FLOW_ID" | head -c 500
fi

# 7.6 测试运行历史 API
if [ "$FLOW_ID" != "NONE" ]; then
  curl -s "http://localhost:3000/api/flows/$FLOW_ID/runs" | head -c 500
fi
```

**验证点：**
- 每个端点是否返回有效 JSON（不是 500 错误）
- `/api/flows` 列表格式是否正确
- `/api/flows/{id}/run` 是否能触发执行（可能因缺少 API key 返回错误，但应是业务错误而非 500）
- `/api/settings` 是否能读取配置（注意：**不应返回明文 API key**）
- 错误响应是否有明确的错误信息

---

### T8: 运行历史

**步骤：**
1. 在画布上创建一个最简 flow：Input → Output（不经过 Agent，避免需要 API key）
2. 连接 Input 和 Output 节点
3. 点击 Run（执行按钮）
4. 截图：执行过程/结果
5. 查看右侧面板的 History tab
6. 截图：运行历史

**验证点：**
- 最简 flow 是否能执行成功
- 执行过程中节点是否有视觉状态变化（呼吸灯/高亮）
- History tab 是否显示本次运行记录
- 运行记录是否包含时间、状态、输入输出

**备选：** 如果 Input → Output 直连不支持执行，尝试 Input → Agent → Output（使用 settings.json 中的 DeepSeek key）

---

### T9: Playground 页面

**步骤：**
1. 访问 `/playground`
2. 截图：Playground 页面
3. 在输入框输入一条消息
4. 点击发送
5. 截图：发送后的 UI 状态

**验证点：**
- 页面是否正常加载
- 输入框和发送按钮是否存在
- 输入消息后是否有 UI 反馈（loading 状态、消息气泡）
- 如果因缺少 API key 失败，错误提示是否用户友好（不应是白屏或未处理的异常）
- Agent 选择器（如果有）是否能切换不同 agent

---

## 补充测试（如果时间允许）

### T10: 节点连线交互
- 从一个节点的输出 handle 拖线到另一个节点的输入 handle
- 验证连线是否创建成功
- 删除连线，验证能否成功

### T11: 节点删除
- 选中一个节点，按 Delete 键或右键删除
- 验证节点和相关连线是否一起删除

### T12: 浏览器兼容性快检
- 检查页面在不同窗口尺寸下的表现（resize 到 1280x720、1920x1080）

---

## 输出格式

输出文件：`doc/review-e2e.md`

```markdown
# FlowCraft — E2E 测试报告

**日期：** YYYY-MM-DD
**Tester：** Claude Code
**环境：** Chromium via Playwright, localhost:3000
**版本：** git commit hash

---

## Executive Summary

通过：X / 总计 Y 个场景
发现 bug：X 个

---

## 测试结果

### T1: 首页基础功能
- **状态：** ✅ 通过 / ❌ 失败 / ⚠️ 部分通过
- **截图：** `doc/review-screenshots/T1-homepage.png`
- **详细结果：**（每个验证点的 pass/fail）
- **发现的问题：**（如有）

### T2: 画布基础操作
...

（每个场景同样格式）

---

## API 端点测试结果

| 端点 | Method | 状态码 | 响应格式 | 备注 |
|------|--------|--------|---------|------|
| `/api/flows` | GET | | | |
| `/api/flows/{id}/run` | POST | | | |
| `/api/settings` | GET | | | |
| `/api/workspace/{flowId}` | GET | | | |
| `/api/flows/{id}/runs` | GET | | | |

---

## Bug 清单

| # | 严重程度 | 场景 | 描述 | 复现步骤 | 截图 |
|---|---------|------|------|---------|------|

---

## UI/UX 观察（非 bug，但值得改进）

（记录在测试过程中发现的交互体验问题，如按钮不好找、反馈不明确等）
```

---

## 注意事项

1. **dev server 必须运行** — 所有测试依赖 `http://localhost:3000`
2. **不要修改项目代码** — 发现 bug 只记录，修复在 review 完成后统一进行
3. **`settings.json` 中有 DeepSeek key** — T8 如需 Agent 执行可使用
4. **`.env.local` 的 Anthropic key 是占位符** — Anthropic 相关调用会失败，这是已知情况，不算 bug
5. **截图命名规范：** `T{场景号}-{描述}.png`，如 `T1-homepage.png`、`T3-after-refresh.png`
6. **如果某个测试因为找不到元素而失败** — 先截图当前页面状态，尝试用 DevTools 查看实际的 DOM 结构，调整 selector 后重试。记录实际的 selector 以便后续测试使用。
