# FlowCraft — Code Review Report

**日期：** 2026-03-18
**Reviewers：** Codex (静态) + Gemini (架构) + Claude Code (E2E)
**版本：** 2b1e880 (feature/stage2-addons)

## Executive Summary

**总体评分：7.5/10**
发现：0 严重 / 5 中等 / 6 轻微

FlowCraft 整体代码质量良好——TypeScript 编译 0 错误、ESLint 仅 0 warning（src/）、无 console.log 遗留（仅 1 处服务端调试）、无 TODO/FIXME。核心功能（画布编辑、节点拖拽、持久化、YAML 导出、语言切换、Settings、Playground）全部正常工作。

主要风险集中在：
1. **执行引擎失败处理**——packed-executor 中失败节点被错误标记为完成，导致下游级联执行
2. **鉴权设计**——localhost 检查依赖可伪造的 Host 头
3. **状态管理纯度**——store actions 中直接调用 fetch()

架构成熟度 3.5/5，Phase 3 就绪度 3/5。

---

## 1. 代码质量（来源：review-static.md）

| 指标 | 结果 |
|------|------|
| TypeScript 编译 | ✅ 0 错误 |
| ESLint (src/) | ✅ 0 错误 0 warning |
| 硬编码 API key (src/) | ✅ 0 处 |
| console.log (src/) | ⚠️ 1 处（code-execute.ts，可接受） |
| `as any` 使用 | ⚠️ 8 处（SSE 流解析 + ReactFlow 类型） |
| TODO/FIXME (src/) | ✅ 0 处 |
| 超 300 行文件 | ⚠️ 4 个（i18n 878, useFlowExecution 389, github-downloader 389, ChatPanel 341） |

## 2. 安全性（来源：review-static.md + review-e2e.md）

| 检查项 | 状态 | 详情 |
|--------|------|------|
| `eval()` 使用 | ✅ 安全 | 0 处 |
| `new Function()` | ⚠️ Medium | 1 处（condition-expression.ts），有白名单但可能有边缘绕过 |
| 路径遍历 | ✅ 安全 | SAFE_ID_RE + path.resolve 包含检查 |
| API 鉴权 | ⚠️ Medium | requireMutationAuth 一致应用；但 localhost 检查依赖可伪造 Host 头 |
| API Key 泄露 | ✅ 安全 | maskSettings() 正确 REDACT 所有 key（E2E 验证：deepseekApiKey="REDACTED"） |
| NEXT_PUBLIC_ 暴露 | ✅ 安全 | 0 处敏感变量 |
| CORS | ✅ | 默认同源策略 |
| .env.local git 追踪 | ✅ 安全 | 未被 git 追踪 |
| 条件注入 | ✅ 安全 | E2E 验证：process.exit、require('fs')、constructor 注入均被阻止 |

## 3. 架构评审（来源：review-architecture.md）

**架构成熟度：3.5/5  |  Phase 3 就绪度：3/5**

### 优势
- 执行引擎正确处理拓扑排序、环检测、条件分支跳过
- 子流程调用（packed nodes）已优雅实现
- 组件按领域良好分区（canvas/agent/home/playground）
- API 路由 RESTful 规范、统一鉴权模式

### 问题
- **[High] 失败处理缺陷**：packed-executor.ts 中失败节点被标记为 completed，下游节点在无效输入下继续执行
- **[High] 状态纯度违规**：flowStore-pack-actions.ts 在 store actions 中直接调用 fetch()
- **[Medium] God Component**：flow-editor.tsx 混合拖放、键盘监听、pack 逻辑、API 同步
- **[Medium] 代码重复**：并行执行调度逻辑在 packed-executor.ts 和 flowStore.ts 中重复
- **[Medium] i18n 缺口**：多处硬编码 UI 文本绕过翻译系统

### Phase 3 就绪度
| 能力 | 就绪度 | 说明 |
|------|--------|------|
| 共享内存 | ✅ 良好 | packed-memory-injector 已提供可扩展基础 |
| 子流程调用 | ✅ 优秀 | 嵌套实例已实现 |
| 人工介入 | ❌ 未就绪 | 执行引擎无法暂停等待外部输入 |
| 实时协作 | ❌ 未就绪 | 需要 CRDT（如 Yjs）替换数组式状态 |

## 4. 功能完整性

| # | 功能 | 静态检查 | E2E 测试 | 综合状态 |
|---|------|----------|----------|----------|
| 1 | 首页 & 导航 | ✅ | ✅ T1 | ✅ |
| 2 | 画布节点拖拽 | ✅ | ✅ T2 | ✅ |
| 3 | 节点配置（System Prompt 等） | ✅ | ✅ T2/T3 | ✅ |
| 4 | Flow 持久化 | ✅ | ✅ T3 | ✅ |
| 5 | Settings & API Key 管理 | ✅ | ✅ T4 | ✅ |
| 6 | 中英文切换 | ⚠️ 硬编码文本 | ✅ T5（"Run" 未翻译） | ⚠️ |
| 7 | YAML 导出 | ✅ | ✅ T6 | ✅ |
| 8 | API 端点 | ✅ | ✅ T7 | ✅ |
| 9 | Flow 执行 | ⚠️ 失败处理缺陷 | ✅ T8 | ⚠️ |
| 10 | 运行历史 | ✅ | ✅ T8 | ✅ |
| 11 | Playground | ✅ | ✅ T9 | ✅ |

## 5. E2E 测试结果摘要（来源：review-e2e.md）

| 测试 | 状态 | 关键发现 |
|------|------|----------|
| T1 首页 | ✅ | 品牌、导航、新建 flow 均正常 |
| T2 画布操作 | ✅ | 拖拽、节点类型、handles 均正常 |
| T3 持久化 | ✅ | 节点位置、配置刷新后保持 |
| T4 Settings | ✅ | 5 key + API Token + workspace，保存刷新正常 |
| T5 i18n | ✅ | 切换正常，"Run" 未翻译 |
| T6 YAML | ✅ | 文件下载触发成功 |
| T7 API | ✅ | 所有端点正常，key 正确 REDACT |
| T8 运行 | ✅ | Input→Output 创建、Run、History 正常 |
| T9 Playground | ✅ | 页面加载、输入、发送正常 |

## 6. 完整 Bug 清单（三报告合并去重）

| # | 严重程度 | 来源 | 描述 | 文件/场景 | 修复建议 |
|---|----------|------|------|-----------|----------|
| 1 | Medium | 架构 | packed-executor 失败节点被标记为 completed，下游级联执行 | `src/lib/packed-executor.ts` | 新增 `failedIds` 集合，失败时停止下游 trySchedule |
| 2 | Medium | 静态 | `new Function` 条件求值器白名单可能有边缘绕过 | `src/lib/condition-expression.ts:45` | 替换为 AST 求值器或 vm.runInNewContext 沙箱 |
| 3 | Medium | 静态 | localhost 鉴权检查依赖可伪造 Host 头 | `src/lib/api-auth.ts` | 非 dev 环境强制 token；只信任平台验证的头 |
| 4 | Medium | 架构 | Zustand store actions 直接调用 fetch()，破坏状态纯度 | `src/store/flowStore-pack-actions.ts` | 重构网络调用到 Service 层 |
| 5 | Medium | 架构 | 并行执行调度逻辑在两处重复 | `packed-executor.ts`, `flowStore.ts` | 集中到统一 Scheduler 类 |
| 6 | Minor | E2E | 中文模式下 "Run" 按钮文本未翻译 | 工具栏 / `i18n.ts` | 添加 `toolbar.run` 翻译 key |
| 7 | Minor | 架构 | 多处组件硬编码 UI 文本绕过 i18n | `SkillInstaller.tsx`, `packed-demo.tsx` | 提取到 `i18n.ts` |
| 8 | Minor | 静态 | 8 处 `as any` 类型断言 | 见静态报告 3.3 | 定义 SSE 数据类型；ReactFlow 使用泛型 |
| 9 | Minor | 架构 | flow-editor.tsx 作为 God Component | `src/components/canvas/flow-editor.tsx` | 提取 handlePack 到 useFlowPack hook |
| 10 | Minor | 静态 | useFlowExecution 职责混杂（389 行） | `src/hooks/useFlowExecution.ts` | 按调度/执行/状态拆分 |
| 11 | Minor | 静态 | i18n 文件过大（878 行） | `src/lib/i18n.ts` | 翻译数据外置为 JSON |

## 7. Phase 3 就绪度（来源：review-architecture.md）

| 维度 | 评分 | 当前状态 | 需要的改动 |
|------|------|----------|------------|
| 三层共享内存 | 4/5 | packed-memory-injector 提供良好基础 | 添加 public/global 层级 API |
| 人工介入节点 | 1/5 | 执行引擎无暂停能力 | 实现状态机持久化 + 外部恢复机制 |
| Orchestrator/子流程 | 5/5 | packed nodes 已优雅实现 | 无 |
| 实时协作 | 1/5 | 数组式状态无法并发编辑 | 迁移到 CRDT（Yjs） |

## 8. 改进建议（按优先级）

### P0 — 立即修复（安全 + 关键 bug）
- [ ] **#1** 修复 packed-executor.ts 失败处理：失败节点不应标记为 completed
- [ ] **#3** 加固 api-auth.ts：非开发环境强制 FLOWCRAFT_API_TOKEN，不依赖可伪造头

### P1 — Phase 2 收尾前
- [ ] **#2** 替换 `new Function` 为安全 AST 求值器
- [ ] **#4** 将 flowStore-pack-actions.ts 中的 fetch 调用移到 Service 层
- [ ] **#5** 合并重复的并行执行调度逻辑
- [ ] **#6** **#7** 补全 i18n 翻译缺口（"Run" + 硬编码文本）

### P2 — Phase 3 开始前
- [ ] **#9** 拆分 flow-editor.tsx God Component
- [ ] **#10** 拆分 useFlowExecution.ts（调度/执行/状态）
- [ ] **#8** 减少 `as any` 使用
- [ ] **#11** i18n 翻译数据外置
- [ ] 设计人工介入节点的状态机暂停/恢复架构

### P3 — 长期演进
- [ ] 核心状态迁移到 CRDT（Yjs）支持实时协作
- [ ] 执行引擎持久化状态机，支持 Human 节点异步等待
- [ ] 文件系统同步从全对象替换改为细粒度 patch
