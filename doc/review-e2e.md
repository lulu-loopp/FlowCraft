# FlowCraft — E2E 测试报告
**Tester:** Claude Code  |  **Date:** 2026-03-20
**Environment:** Chromium (headless, Playwright), localhost:3000

## Summary
通过：7/9  |  部分通过：2/9  |  Bug：4 个  |  UX 观察：4 个

---

## T1: 首页 ✅

- **状态：** PASS
- **截图：** `T1-homepage.png`, `T1-new-flow-canvas.png`
- **验证点：**
  - [x] 品牌 "FlowCraft" 显示
  - [x] 页面标题 "FlowCraft — AI Agent Orchestration"
  - [x] "New flow" 按钮可见且可点击
  - [x] 导航链接：Playground、Dashboard、Settings
  - [x] Import YAML 按钮可见
  - [x] Flow 列表显示已有 flow（包含用户 flow 和 demo）
  - [x] Try Demos 区域展示 3 个演示模板
  - [x] Recycle Bin 入口可见
  - [x] 点击 "New flow" 跳转到 `/canvas/flow-{timestamp}`

---

## T2: 画布操作 ✅

- **状态：** PASS
- **截图：** `T2-canvas-initial.png`, `T2-after-agent-add.png`, `T2-node-selected.png`, `T2-with-condition.png`
- **验证点：**
  - [x] Agent 节点可拖拽添加到画布
  - [x] 点击节点后右侧面板显示 Config / Files / History 标签
  - [x] Agent 节点显示标题 "agent node"、描述 "Executes autonomous tasks"、工具标签 Web Search / Python Execute
  - [x] Condition 节点可拖拽添加
  - [x] Condition 有 true/false 输出 handle，支持 Natural / Expr 切换
  - [x] 共 5 个 handles
  - [x] 左侧面板完整列出所有节点类型：Agent、AI Coding、Human、Input、Output、Condition、Merge、Dispatcher、Initializer 等

---

## T3: 持久化 ✅

- **状态：** PASS
- **截图：** `T3-before-refresh.png`, `T3-after-refresh.png`
- **验证点：**
  - [x] 新建 flow 后添加节点
  - [x] 修改 System prompt 为 "Test system prompt for persistence check"
  - [x] Ctrl+S 保存成功
  - [x] 刷新后节点数量保持（1 → 1）
  - [x] System prompt 内容刷新后完整保持
  - [x] Auto-save 工作正常（toolbar 显示 "Saved"）

---

## T4: Settings ✅

- **状态：** PASS
- **截图：** `T4-settings.png`, `T4-settings-after-refresh.png`
- **验证点：**
  - [x] Anthropic 输入框 ✅
  - [x] OpenAI 输入框 ✅
  - [x] DeepSeek 输入框 ✅
  - [x] Tavily 输入框 ✅
  - [x] Brave Search 输入框 ✅
  - [x] 额外：Google、MiniMax、Replicate 输入框 ✅
  - [x] Save 按钮可见
  - [x] Default model 配置区（Provider + Model）
  - [x] Condition evaluation model 配置
  - [x] Workspace path 设置
  - [x] Image Generation 配置（多模型选项：Nano Banana、Imagen、DALL-E、Stable Diffusion、Flux）
  - [x] AI Generate Flow provider/model 配置
  - [x] Enabled tools 配置
  - [x] Skills 列表展示已安装 skills

- **备注：** 原始需求要求 5 个 key 输入框，实际有 8+ 个，超出预期——正面。

---

## T5: 中英文切换 ✅

- **状态：** PASS
- **截图：** `T5-homepage-zh.png`, `T5-canvas-zh.png`, `T5-canvas-en.png`, `T5-homepage-en.png`
- **验证点：**
  - [x] 语言切换按钮可见（"中文" / "EN"）
  - [x] 切换到中文后首页文字变为中文（"我的流程"、"新建流程"、"设置"、"实验场"、"看板"）
  - [x] 画布页面中文化（"智能体"、"条件"）
  - [x] 切回英文后恢复
  - [x] 刷新后语言设置保持

- **发现：**
  - ⚠️ 中文模式下 Flow 卡片时间戳混合中英文：显示 "修改于 Mar 20, 2026" 而非中文日期格式

---

## T6: YAML 导出 ⚠️

- **状态：** PARTIAL PASS
- **截图：** `T6-yaml-export.png`
- **验证点：**
  - [x] Export YAML 按钮在工具栏中可见
  - [x] 点击后弹出 Modal
  - [ ] 未触发文件下载（通过 Modal 展示）
  - [ ] 测试未能从 Modal 中 pre/code/textarea 读取 YAML 内容

- **备注：** Export 功能通过 Modal 展示而非直接下载文件。Modal 正常弹出。YAML 内容可能使用了自定义渲染组件。

---

## T7: API 端点 ⚠️

- **状态：** PARTIAL PASS

| 端点 | Method | 状态码 | 响应 | 备注 |
|------|--------|--------|------|------|
| `/api/flows` | GET | 200 | JSON 数组，含 flow 列表 | ✅ 正常 |
| `/api/settings` | GET | 200 | JSON，key 值显示 "REDACTED" | ✅ **安全：不暴露明文 key** |
| `/api/agent/run` | POST | 500 | **空响应体** | ❌ Bug：应返回结构化错误信息 |
| `/api/workspace` | GET | 404 | HTML | 路由可能不支持 GET |
| `/api/usage` | GET | 200 | 正常 | ✅ |
| `/api/skills` | GET | 200 | JSON 技能列表 | ✅ |
| `/api/flows/{id}/export` | GET | 404 | HTML | 路由不存在或仅支持其他方法 |

### 关键发现
- ✅ **安全：** `/api/settings` 正确 REDACT 所有 API key
- ❌ **Bug：** `/api/agent/run` 500 返回空响应体，前端无法获取错误原因
- ⚠️ `/api/flows/{id}/export` GET 返回 404 HTML

---

## T8: 运行历史 ✅

- **状态：** PASS
- **截图：** `T8-before-run.png`, `T8-during-run.png`, `T8-after-run.png`, `T8-history.png`
- **验证点：**
  - [x] 创建 Input → Agent → Output 三节点 flow
  - [x] "Run flow" 按钮存在
  - [x] 点击 Run 弹出 "What's your goal?" 输入 Modal
  - [x] Modal 显示 "Passed as input to the first agent node."
  - [x] 支持 ⌘+Enter 快捷键运行
  - [x] History tab 存在于右侧面板
  - [x] 底部面板有 Execution / Terminal 标签

- **备注：** 未实际输入 goal 并完成运行，因为需要有效 API key 和连线。goal 输入 Modal 设计合理。

---

## T9: Playground ✅

- **状态：** PASS
- **截图：** `T9-playground.png`, `T9-after-send.png`
- **验证点：**
  - [x] `/playground` 页面正常加载
  - [x] 两种模式切换：run / chat
  - [x] System Prompt 文本域（预填 "You are a helpful assistant..."）
  - [x] Provider 选择器：anthropic、openai、deepseek
  - [x] Model 下拉选择（默认 claude-sonnet-4-6）
  - [x] Tools 列表：web_search(已选)、calculator、url_fetch、code_execute、js_execute、python_execute、brave_search
  - [x] GOAL 输入框 + "Run agent" 按钮
  - [x] 空状态提示 "set a goal and run the agent"

---

## Bug 清单

| # | 严重程度 | 场景 | 描述 | 复现步骤 | 截图 |
|---|---------|------|------|---------|------|
| B1 | Medium | T7 | `/api/agent/run` POST 500 返回空响应体 | POST 请求到 /api/agent/run，无有效配置时返回 500 但 body 为空 | — |
| B2 | Low | T5 | 中文模式下 Flow 卡片时间戳未本地化 | 切换到中文 → 查看首页 → 时间显示 "Mar 20, 2026" 而非中文格式 | T5-homepage-zh.png |
| B3 | Low | T7 | `/api/flows/{id}/export` GET 返回 404 | GET /api/flows/flow-xxx/export → 返回 HTML 404 | — |
| B4 | Low | T9 | Playground 默认 provider 是 anthropic，Settings 默认 provider 是 minimax | 分别访问 /playground 和 /settings 对比 | T9-playground.png |

## UX 观察（非 bug 但值得改进）

| # | 场景 | 观察 | 建议 |
|---|------|------|------|
| 1 | T6 | YAML 导出通过 Modal 展示而非直接下载 | 增加 "复制到剪贴板" 和 "下载文件" 按钮 |
| 2 | T8 | Run flow 的 goal 输入 Modal 每次都需要输入 | 可记住上次输入或允许在 Input 节点预设 |
| 3 | T4 | Settings 输入框初始为空，无法直观知道是否已配置 | 已配置的 key 显示掩码值如 "sk-***...abc" |
| 4 | T5 | 执行日志在中文模式下仍为英文 | 执行日志的固定文本（如 THINK、ACT 标签）应 i18n 化 |
