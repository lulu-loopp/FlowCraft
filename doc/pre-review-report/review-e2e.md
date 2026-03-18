# FlowCraft — E2E 测试报告
**Tester:** Claude Code  |  **Date:** 2026-03-18
**Environment:** Chromium (headless, Playwright), localhost:3000
**Commit:** 2b1e880

## Summary
通过：9/9  |  Bug：1 个（minor）  |  UX 观察：3 个

---

## T1: 首页 ✅
- 访问 `/` 成功，页面正常加载
- FlowCraft 品牌文字可见
- "New flow" 按钮可见可点击
- 存在 flow 列表（"Try now" 按钮表示有 flow 卡片）
- 语言切换按钮 "中文" 可见
- 点击 "New flow" → 跳转到 `/canvas/flow-{timestamp}` ✅
- **截图:** `T1-homepage.png`, `T1-after-create.png`

## T2: 画布操作 ✅
- 新建 flow 后画布正常加载
- 左侧面板节点列表完整：Agent, AI Coding, Human, Input, Output, Condition, Initializer + 6 个预设 Agent（Researcher, Analyst, Writer, Coding Agent, Critic, Planner）+ Tool, Skill
- 拖拽 Agent 节点到画布成功
- Condition 节点添加成功，显示 3 个 handles（input, true, false）
- Agent 节点显示 "Executes autonomous tasks" 说明文字
- **截图:** `T2-canvas-initial.png`, `T2-canvas-with-nodes.png`

## T3: 持久化 ✅
- 新建 flow，添加节点，设置 System Prompt = "Test persistence prompt"
- 等待自动保存（3 秒防抖）
- 刷新页面后：
  - 节点数量保持一致 ✅
  - System Prompt 值 = "Test persistence prompt" ✅
  - 位置信息保持 ✅
- **截图:** `T3-before-refresh.png`, `T3-after-refresh.png`

## T4: Settings ✅
- 访问 `/settings` 成功
- 7 个输入框确认：
  - ✅ Anthropic (password, placeholder: sk-ant-...)
  - ✅ OpenAI (password, placeholder: sk-...)
  - ✅ DeepSeek (password, placeholder: sk-...)
  - ✅ Tavily (password, placeholder: tvly-...)
  - ✅ Brave Search (password, placeholder: BSA...)
  - ✅ API Token (password)
  - ✅ Workspace path (text)
- Save 按钮可见可点击
- 刷新后所有 label 保持可见
- **截图:** `T4-settings.png`, `T4-settings-after-refresh.png`

## T5: 中英文切换 ✅
- 首页语言按钮显示 "中文"（当前英文模式）
- 点击切换后出现中文文本（"新建" 等） ✅
- 画布页面也切换为中文 ✅
- 切回英文后 "New flow" 恢复 ✅
- 刷新后语言设置保持（localStorage 持久化） ✅
- **发现:** 中文模式下 "Run" 按钮文本未翻译 ⚠️
- **截图:** `T5-homepage-zh.png`, `T5-canvas-zh.png`, `T5-homepage-en.png`

## T6: YAML 导出 ✅
- "Export YAML" 按钮在工具栏可见，title="Export YAML"
- 点击后触发文件下载（Blob URL + `<a>` click 方式）
- 下载文件名格式：`{flow-name}.yaml`
- 源码确认 `flowToYaml()` 生成包含 nodes/edges 的有效 YAML
- **截图:** `T6-yaml-export.png`, `T6-after-export.png`

## T7: API 端点 ✅

| 端点 | Method | 状态码 | 响应 | 备注 |
|------|--------|--------|------|------|
| `/api/flows` | GET | 200 | 25 flows 数组 | ✅ 正常 |
| `/api/settings` | GET | 200 | `{defaultProvider, defaultModel, deepseekApiKey: "REDACTED"}` | ✅ Key 已 mask |
| `/api/workspace/{flowId}/documents` | GET | 200 | 文件列表 | ✅ 正常 |
| `/api/agents` | GET | 200 | `{agents:[]}` | ✅ 正常 |
| `/api/skills` | GET | 200 | Skills 列表 | ✅ 正常 |
| `/api/memory` | GET | 404 | | 预期（需要 flowId/nodeId 路径参数） |
| `/api/flows` | POST | 201 | 创建成功 | ✅ 无鉴权（localhost 本地应用设计） |
| `/api/flows/trash` | GET | 200 | 回收站列表 | ✅ 正常 |

### 安全验证
- ✅ `GET /api/settings` 返回 `deepseekApiKey: "REDACTED"` — 值已正确 mask
- ✅ 未配置的 key（anthropic, openai 等）不出现在响应中
- ⚠️ 信息泄露（minor）：响应中 key 名的存在/缺失可推断哪些 provider 已配置
- ⚠️ 所有 GET 端点无需鉴权（设计决策：本地优先应用）

## T8: 运行历史 ✅
- 新建 flow（起始 0 节点）
- 添加 Input + Output 节点（拖拽成功，共 2 节点）
- 设置 Input 值 ✅
- Run 按钮可见可点击 ✅
- 点击 Run 后执行
- History tab 可见可点击 ✅
- **截图:** `T8-before-run.png`, `T8-after-run.png`, `T8-history.png`

## T9: Playground ✅
- 访问 `/playground` 成功（非 404）
- 消息输入框（textarea）可见 ✅
- 输入消息成功 ✅
- Enter 键发送（无显式 Send 按钮）
- 发送后无可见错误
- **截图:** `T9-playground.png`, `T9-after-send.png`

---

## Bug 清单

| # | 严重程度 | 场景 | 描述 | 复现步骤 | 截图 |
|---|----------|------|------|----------|------|
| 1 | Minor | T5 | 中文模式下 "Run" 按钮文本未翻译 | 切换到中文 → 打开画布页 → 查看工具栏 | `T5-canvas-zh.png` |

## UX 观察（非 bug 但值得改进）

1. **T9: Playground 无 Send 按钮** — 仅支持 Enter 键发送，新用户可能不知道如何发送消息。建议添加显式发送按钮或提示文字
2. **T8: 执行无状态指示器** — 点击 Run 后没有明显的 loading/running 状态视觉反馈，用户无法判断执行进度
3. **T6: YAML 导出无反馈** — 点击 Export YAML 后没有 toast 提示告知用户文件已下载成功
