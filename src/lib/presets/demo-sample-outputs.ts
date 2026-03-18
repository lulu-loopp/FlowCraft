/** Static sample outputs shown when API key is not configured */
export const DEMO_SAMPLE_OUTPUTS: Record<string, { zh: string; en: string }> = {
  'demo-flowcraft-analysis': {
    zh: `# FlowCraft 全套分析报告

## 一、项目介绍
FlowCraft 是一个可视化 AI Agent 编排工具，让用户通过拖拽方式搭建多智能体工作流。
核心技术栈：Next.js + React Flow + Zustand + Tailwind CSS。

## 二、竞品对比
| 维度 | FlowCraft | Dify | Langflow | n8n |
|------|-----------|------|----------|-----|
| 目标用户 | 开发者+非开发者 | 企业用户 | 开发者 | 自动化用户 |
| 部署方式 | 本地优先 | 云+私有部署 | 本地/云 | 自托管 |
| AI 原生 | 是 | 是 | 是 | 否(插件) |
| 可视化编排 | React Flow | 自研 | React Flow | 自研 |

## 三、新人入职指南
1. 运行 \`npm run dev\` 启动项目
2. 打开 /canvas 页面熟悉画布操作
3. 阅读 src/store/flowStore.ts 理解状态管理
4. 尝试创建一个简单的 Input → Agent → Output 流程`,
    en: `# FlowCraft Full Analysis Report

## 1. Project Overview
FlowCraft is a visual AI Agent orchestration tool that lets users build multi-agent workflows via drag-and-drop.
Core stack: Next.js + React Flow + Zustand + Tailwind CSS.

## 2. Competitor Comparison
| Dimension | FlowCraft | Dify | Langflow | n8n |
|-----------|-----------|------|----------|-----|
| Target Users | Devs + Non-devs | Enterprise | Developers | Automation Users |
| Deployment | Local-first | Cloud+Private | Local/Cloud | Self-hosted |
| AI Native | Yes | Yes | Yes | No (plugins) |
| Visual Editor | React Flow | Custom | React Flow | Custom |

## 3. Onboarding Guide
1. Run \`npm run dev\` to start the project
2. Open /canvas to familiarize with the canvas
3. Read src/store/flowStore.ts to understand state management
4. Try creating a simple Input → Agent → Output flow`,
  },
  'demo-idea-validator': {
    zh: `# 投资备忘录：FlowCraft

## 一句话描述
让普通人用可视化拖拽搭建 AI Agent 工作流的工具。

## 市场机会
- AI 应用开发工具市场预计 2025 年达 $50B+
- 80% 的潜在 AI 用户是非开发者
- 现有工具门槛过高，存在巨大的易用性空白

## 差异化优势
- 确定性执行（vs 纯对话式 AI 的不可控）
- 透明流程（每一步可见可调）
- 低门槛（Scratch 式拖拽体验）

## 主要风险
1. 用户教育成本——"工作流"概念对非开发者仍有门槛
2. 免费竞品压力——Dify 开源版功能逐渐丰富
3. 技术护城河不够深——核心是 UI 编排层

## 投资建议
**观望** — 产品方向正确，但需要验证非开发者的真实付费意愿。`,
    en: `# Investment Memo: FlowCraft

## One-liner
A tool that lets non-developers build AI Agent workflows via visual drag-and-drop.

## Market Opportunity
- AI app dev tools market projected $50B+ by 2025
- 80% of potential AI users are non-developers
- Existing tools have high barriers, huge usability gap

## Differentiators
- Deterministic execution (vs uncontrollable pure-chat AI)
- Transparent process (every step visible and adjustable)
- Low barrier (Scratch-like drag-and-drop)

## Key Risks
1. User education cost — "workflow" concept still has a learning curve
2. Free competitor pressure — Dify OSS growing features
3. Shallow technical moat — core is UI orchestration layer

## Investment Recommendation
**Watch** — Direction is right, but need to validate non-dev willingness to pay.`,
  },
  'demo-japan-travel': {
    zh: `# 5天京都大阪深度游手册

## 旅行概览
樱花季（3月底-4月初）| 深度文化体验 | 中等预算

## 每日行程

### Day 1：京都东山
- 上午：伏见稻荷大社（早起避人流，6:30 出发）
- 下午：清水寺 → 二年坂三年坂散步
- 晚上：祇园白川夜樱
- 住宿：东山区町家民宿

### Day 2：京都岚山
- 上午：竹林小径 → 天龙寺
- 下午：嵯峨野观光小火车赏樱
- 晚上：锦市场觅食

### Day 3：京都小众
- 上午：哲学之道樱花隧道
- 下午：南禅寺 + 蹴上铁道樱花
- 晚上：先斗町晚餐

### Day 4：移动日 + 大阪
- 上午：JR 京都→大阪（30分钟）
- 下午：大阪城公园赏樱
- 晚上：道顿堀 + 法善寺横丁

### Day 5：大阪深度
- 上午：黑门市场早餐
- 下午：中崎町文艺街区探索
- 晚上：新世界通天阁 + 串炸

## 预算估算
每日约 ¥15,000-20,000（住宿+餐饮+交通+门票）`,
    en: `# 5-Day Kyoto-Osaka Deep Travel Guide

## Overview
Cherry blossom season (late March-early April) | Deep cultural experience | Mid-range budget

## Daily Itinerary

### Day 1: Kyoto Higashiyama
- Morning: Fushimi Inari Shrine (start early 6:30 to avoid crowds)
- Afternoon: Kiyomizu-dera → Ninenzaka & Sannenzaka stroll
- Evening: Gion Shirakawa night cherry blossoms
- Stay: Higashiyama machiya guesthouse

### Day 2: Kyoto Arashiyama
- Morning: Bamboo Grove → Tenryu-ji Temple
- Afternoon: Sagano Scenic Railway for cherry blossoms
- Evening: Nishiki Market food exploration

### Day 3: Kyoto Hidden Gems
- Morning: Philosopher's Path cherry blossom tunnel
- Afternoon: Nanzen-ji + Keage Incline cherry blossoms
- Evening: Pontocho dinner

### Day 4: Transit + Osaka
- Morning: JR Kyoto → Osaka (30 min)
- Afternoon: Osaka Castle Park cherry blossoms
- Evening: Dotonbori + Hozenji Yokocho

### Day 5: Deep Osaka
- Morning: Kuromon Market breakfast
- Afternoon: Nakazakicho artsy neighborhood
- Evening: Shinsekai Tsutenkaku + kushikatsu

## Budget Estimate
~¥15,000-20,000/day (accommodation + meals + transport + admission)`,
  },
};
