import type { Node, Edge } from '@xyflow/react';

export interface DemoFlow {
  id: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  iconName: string;
  iconColor: string;
  nodeCount: number;
  nodes: Node[];
  edges: Edge[];
}

export const DEMO_FLOWS: DemoFlow[] = [
  createFlowcraftAnalysis(),
  createIdeaValidator(),
  createJapanTravel(),
];

export function getDemoFlowById(id: string): DemoFlow | undefined {
  return DEMO_FLOWS.find(f => f.id === id);
}

function createFlowcraftAnalysis(): DemoFlow {
  return {
    id: 'demo-flowcraft-analysis',
    name: { zh: 'FlowCraft 全套分析', en: 'FlowCraft Full Analysis' },
    description: {
      zh: '用 AI 团队分析 FlowCraft 的架构和竞品格局',
      en: 'Analyze FlowCraft architecture and competitive landscape with AI team',
    },
    iconName: 'Layers',
    iconColor: '#6366f1',
    nodeCount: 7,
    nodes: [
      ioNode('input-1', { x: 80, y: 300 }, '分析目标', {
        zh: '对 FlowCraft 这个项目进行全套分析：\n1. 分析其技术架构和核心设计决策\n2. 分析竞品（Dify / Langflow / n8n）的定位和差异\n3. 综合输出项目介绍 + 竞品对比 + 新人入职指南',
        en: 'Perform a comprehensive analysis of FlowCraft:\n1. Analyze technical architecture and core design decisions\n2. Analyze competitors (Dify / Langflow / n8n) positioning\n3. Output project intro + competitor comparison + onboarding guide',
      }),
      agentNode('researcher-code', { x: 320, y: 160 }, '代码研究员', {
        zh: '你是一个专业的代码架构分析师。\n分析 FlowCraft 这个 AI agent 编排工具的技术架构。\n使用 web_search 搜索其 GitHub 仓库、技术栈、核心模块设计。\n重点关注：项目结构、核心数据流、关键设计决策。\n输出结构化的技术分析报告。',
        en: 'You are a professional code architecture analyst.\nAnalyze the technical architecture of FlowCraft, an AI agent orchestration tool.\nUse web_search to research its GitHub repo, tech stack, core module design.\nFocus: project structure, core data flow, key design decisions.\nOutput a structured technical analysis report.',
      }, ['web_search'], 8),
      agentNode('researcher-competitor', { x: 320, y: 440 }, '竞品研究员', {
        zh: '你是一个专业的产品竞品分析师。\n深入分析 AI agent 编排工具市场的主要竞品。\n使用 web_search 分别搜索 Dify、Langflow、n8n 的：\n核心功能、目标用户、定价模式、优劣势、近期动态。\n输出结构化的竞品对比分析。',
        en: 'You are a professional competitive analyst.\nAnalyze major competitors in the AI agent orchestration market.\nUse web_search to research Dify, Langflow, n8n:\ncore features, target users, pricing, pros/cons, recent updates.\nOutput a structured competitive analysis.',
      }, ['web_search'], 8),
      agentNode('architect', { x: 600, y: 160 }, '架构师', {
        zh: '你是一个资深软件架构师。\n基于代码研究员提供的技术分析，\n提炼 FlowCraft 的核心架构亮点和技术决策背后的原因。\n输出：架构亮点 + 新人必读清单。',
        en: 'You are a senior software architect.\nBased on the code researcher analysis,\nextract FlowCraft core architecture highlights and reasoning.\nOutput: architecture highlights + onboarding must-reads.',
      }),
      agentNode('analyst', { x: 600, y: 440 }, '定位分析师', {
        zh: '你是一个市场定位专家。\n基于竞品研究员的分析，找出 FlowCraft 相比竞品的差异化定位。\n输出：差异化定位分析 + SWOT。',
        en: 'You are a market positioning expert.\nBased on competitor research, identify FlowCraft differentiation.\nOutput: differentiation analysis + SWOT.',
      }),
      agentNode('writer', { x: 880, y: 300 }, '文档写手', {
        zh: '你是一个技术文档专家。\n整合所有上游分析，输出三份文档：\n1. FlowCraft 一页纸项目介绍\n2. 竞品对比表格（Markdown 表格格式）\n3. 新人入职指南',
        en: 'You are a technical documentation expert.\nIntegrate all upstream analysis into three documents:\n1. FlowCraft one-page project intro\n2. Competitor comparison table (Markdown)\n3. New hire onboarding guide',
      }),
      outputNode('output-1', { x: 1120, y: 300 }, '分析报告'),
    ],
    edges: [
      edge('e1', 'input-1', 'researcher-code'),
      edge('e2', 'input-1', 'researcher-competitor'),
      edge('e3', 'researcher-code', 'architect'),
      edge('e4', 'researcher-competitor', 'analyst'),
      edge('e5', 'architect', 'writer'),
      edge('e6', 'analyst', 'writer'),
      edge('e7', 'writer', 'output-1'),
    ],
  };
}

function createIdeaValidator(): DemoFlow {
  return {
    id: 'demo-idea-validator',
    name: { zh: '产品 Idea 验证器', en: 'Product Idea Validator' },
    description: {
      zh: '像最挑剔的投资人一样验证一个产品 idea',
      en: 'Validate a product idea like the most demanding investor',
    },
    iconName: 'Lightbulb',
    iconColor: '#f59e0b',
    nodeCount: 7,
    nodes: [
      ioNode('input-1', { x: 80, y: 260 }, '产品 Idea', {
        zh: '验证这个产品 idea：\nFlowCraft —— 让普通人能用可视化拖拽方式搭建 AI agent 工作流的工具。\n目标用户是非开发者，核心价值是让 AI 使用有确定性、透明、像 Scratch 一样简单。',
        en: 'Validate this product idea:\nFlowCraft — a tool that lets non-developers build AI agent workflows via visual drag-and-drop.\nTarget: non-developers. Core value: deterministic, transparent AI usage, simple as Scratch.',
      }),
      agentNode('market-researcher', { x: 320, y: 120 }, '市场研究员', {
        zh: '你是一个市场研究专家。\n使用 web_search 研究这个产品 idea 的市场背景：\n1. 现有类似产品的市场规模和增长趋势\n2. 目标用户的真实痛点\n3. 市场上的空白和机会\n输出：市场机会分析报告。',
        en: 'You are a market research expert.\nUse web_search to research the market background:\n1. Market size and growth trends\n2. Target user pain points\n3. Market gaps and opportunities\nOutput: market opportunity analysis.',
      }, ['web_search'], 8),
      agentNode('competitor-researcher', { x: 320, y: 400 }, '竞争研究员', {
        zh: '你是一个竞争格局分析专家。\n使用 web_search 研究竞争环境：\n直接竞品和间接竞品、各竞品的优劣势、市场份额和用户口碑。\n输出：竞争格局报告。',
        en: 'You are a competitive landscape expert.\nUse web_search to research the competitive environment:\ndirect and indirect competitors, pros/cons, market share, user reviews.\nOutput: competitive landscape report.',
      }, ['web_search'], 8),
      agentNode('analyst', { x: 600, y: 260 }, '商业分析师', {
        zh: '你是一个商业模式分析专家。\n基于市场和竞争研究，评估商业可行性：\nTAM/SAM/SOM、商业模式、关键成功因素。\n输出：商业可行性评估。',
        en: 'You are a business model analyst.\nBased on market and competition research, evaluate viability:\nTAM/SAM/SOM, business models, key success factors.\nOutput: business viability assessment.',
      }),
      agentNode('critic', { x: 860, y: 260 }, '挑剔的投资人', {
        zh: '你是一个极其挑剔的早期投资人。\n找出所有潜在问题和风险：\n最致命的 3 个风险、用户付费意愿、团队可能失败的地方。\n如果你不投资，原因是什么？\n输出：投资人的严厉质疑清单。',
        en: 'You are an extremely critical early-stage investor.\nFind all potential issues and risks:\ntop 3 fatal risks, willingness to pay, likely failure points.\nIf you pass, why?\nOutput: investor\'s tough challenge list.',
      }),
      agentNode('writer', { x: 1100, y: 260 }, 'Pitch 撰写师', {
        zh: '你是一个顶级创业 pitch 撰写专家。\n整合所有分析，输出一份诚实的一页纸投资备忘录：\n一句话描述、市场机会、差异化、商业模式、风险和应对、投资建议。\n风格：像 YC 的评估报告。',
        en: 'You are a top startup pitch writer.\nIntegrate all analysis into an honest one-page investment memo:\none-liner, market opportunity, differentiation, business model, risks, recommendation.\nStyle: like a YC evaluation report.',
      }),
      outputNode('output-1', { x: 1340, y: 260 }, '投资备忘录'),
    ],
    edges: [
      edge('e1', 'input-1', 'market-researcher'),
      edge('e2', 'input-1', 'competitor-researcher'),
      edge('e3', 'market-researcher', 'analyst'),
      edge('e4', 'competitor-researcher', 'analyst'),
      edge('e5', 'analyst', 'critic'),
      edge('e6', 'critic', 'writer'),
      edge('e7', 'writer', 'output-1'),
    ],
  };
}

function createJapanTravel(): DemoFlow {
  return {
    id: 'demo-japan-travel',
    name: { zh: '5天京都大阪深度游', en: '5-Day Kyoto-Osaka Trip' },
    description: {
      zh: '让 AI 团队规划一次真实可用的日本之旅',
      en: 'Let an AI team plan a real, usable Japan trip',
    },
    iconName: 'MapPin',
    iconColor: '#10b981',
    nodeCount: 6,
    nodes: [
      ioNode('input-1', { x: 80, y: 260 }, '旅行需求', {
        zh: '规划一次 5 天的日本京都大阪之旅。\n出发时间：樱花季（3月底到4月初）\n旅行风格：深度文化体验，不赶景点\n预算：中等\n特别希望：体验当地人的生活方式，避开过于商业化的景点',
        en: 'Plan a 5-day Kyoto-Osaka trip.\nTiming: Cherry blossom season (late March to early April)\nStyle: deep cultural experience, not rushing\nBudget: moderate\nSpecial: experience local lifestyle, avoid overly commercial spots',
      }),
      agentNode('attraction-researcher', { x: 320, y: 120 }, '景点研究员', {
        zh: '你是一个深度了解京都大阪文化的旅行专家。\n使用 web_search 研究樱花季的小众景点、地道美食、交通建议和最新旅行注意事项。\n输出：景点和美食推荐清单。',
        en: 'You are a Japan travel expert.\nUse web_search to research hidden gems, local food, transport tips, and latest travel advisories for cherry blossom season.\nOutput: attraction and food recommendation list.',
      }, ['web_search'], 8),
      agentNode('accommodation-researcher', { x: 320, y: 400 }, '住宿研究员', {
        zh: '你是一个日本住宿专家。\n使用 web_search 研究京都町家民宿、大阪最佳住宿区域、中等预算下的高性价比住宿。\n输出：住宿区域建议 + 推荐 + 预订 tips。',
        en: 'You are a Japan accommodation expert.\nUse web_search to research Kyoto machiya stays, best Osaka areas, mid-budget high-value options.\nOutput: area suggestions + recommendations + booking tips.',
      }, ['web_search'], 6),
      agentNode('planner', { x: 620, y: 260 }, '行程规划师', {
        zh: '你是一个专业的旅行行程规划师。\n基于景点和住宿研究，制定 5 天行程：\n按地理位置聚合，每天不超过 3 个主要目的地，考虑人流高峰。\n输出每日行程表。',
        en: 'You are a professional trip planner.\nBased on attraction and accommodation research, create a 5-day itinerary:\ncluster by location, max 3 destinations/day, consider peak hours.\nOutput daily schedule.',
      }),
      agentNode('writer', { x: 900, y: 260 }, '旅行手册写手', {
        zh: '你是一个擅长写旅行攻略的作家。\n整合所有研究，输出一份好用的旅行手册：\n旅行概览、每日行程、美食清单、实用信息、预算估算。\n写作风格：像朋友的亲身推荐。',
        en: 'You are a travel guide writer.\nIntegrate all research into a practical travel handbook:\noverview, daily itinerary, food list, practical info, budget estimate.\nStyle: like a friend\'s personal recommendation.',
      }),
      outputNode('output-1', { x: 1140, y: 260 }, '旅行手册'),
    ],
    edges: [
      edge('e1', 'input-1', 'attraction-researcher'),
      edge('e2', 'input-1', 'accommodation-researcher'),
      edge('e3', 'attraction-researcher', 'planner'),
      edge('e4', 'accommodation-researcher', 'planner'),
      edge('e5', 'planner', 'writer'),
      edge('e6', 'writer', 'output-1'),
    ],
  };
}

// ── Helper factories ──

function ioNode(
  id: string, position: { x: number; y: number },
  label: string, inputText: { zh: string; en: string },
): Node {
  return { id, type: 'io', position, data: { label, inputText } };
}

function agentNode(
  id: string, position: { x: number; y: number },
  label: string, systemPrompt: { zh: string; en: string },
  enabledTools: string[] = [], maxIterations = 5,
): Node {
  return {
    id, type: 'agent', position,
    data: { label, systemPrompt, enabledTools, maxIterations, provider: 'deepseek', model: 'deepseek-chat' },
  };
}

function outputNode(id: string, position: { x: number; y: number }, label: string): Node {
  return { id, type: 'output', position, data: { label } };
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'custom' };
}
