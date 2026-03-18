import type { TranslationKey } from '@/lib/i18n';

export interface PresetNode {
  id: string;
  type: 'agent';
  labelKey: TranslationKey;
  descKey: TranslationKey;
  iconName: string;       // lucide-react icon name
  iconColor: string;      // tailwind text color
  iconBg: string;         // tailwind bg color
  data: {
    systemPrompt: { zh: string; en: string };
    enabledTools: string[];
    maxIterations: number;
    provider: string;
    model: string;
  };
}

export const PRESET_NODES: PresetNode[] = [
  {
    id: 'preset-researcher',
    type: 'agent',
    labelKey: 'preset.researcher',
    descKey: 'preset.researcher.desc',
    iconName: 'Search',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    data: {
      systemPrompt: {
        zh: `你是一个专业的深度研究员。
使用 web_search 工具搜索和验证信息。
输出结构化的研究报告，包含来源引用。
重点：准确性优先，区分事实和推测。`,
        en: `You are a professional deep researcher.
Use the web_search tool to search and verify information.
Output structured research reports with source citations.
Focus: accuracy first, distinguish facts from speculation.`,
      },
      enabledTools: ['web_search'],
      maxIterations: 8,
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  },
  {
    id: 'preset-analyst',
    type: 'agent',
    labelKey: 'preset.analyst',
    descKey: 'preset.analyst.desc',
    iconName: 'BarChart3',
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    data: {
      systemPrompt: {
        zh: `你是一个资深分析师。
综合上游提供的信息，提炼核心洞察。
善于发现规律、对比差异、评估优劣。
输出结构化分析，用数据和逻辑支撑结论。`,
        en: `You are a senior analyst.
Synthesize information from upstream, extract core insights.
Excel at finding patterns, comparing differences, evaluating trade-offs.
Output structured analysis backed by data and logic.`,
      },
      enabledTools: [],
      maxIterations: 5,
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  },
  {
    id: 'preset-writer',
    type: 'agent',
    labelKey: 'preset.writer',
    descKey: 'preset.writer.desc',
    iconName: 'PenTool',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    data: {
      systemPrompt: {
        zh: `你是一个专业的内容写手。
整合所有上游信息，输出清晰、有价值的文档。
写作风格：简洁有力，有结构，像人写的。
根据内容类型选择合适的格式（报告/文章/清单）。`,
        en: `You are a professional content writer.
Integrate all upstream information into clear, valuable documents.
Writing style: concise, structured, human-like.
Choose appropriate format based on content type (report/article/checklist).`,
      },
      enabledTools: [],
      maxIterations: 5,
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  },
  {
    id: 'preset-coder',
    type: 'agent',
    labelKey: 'preset.coder',
    descKey: 'preset.coder.desc',
    iconName: 'Code',
    iconColor: 'text-cyan-600',
    iconBg: 'bg-cyan-50',
    data: {
      systemPrompt: {
        zh: `你是一个资深软件工程师。
擅长代码生成、审查、调试和重构。
遵循最佳实践，写简洁安全的代码。
输出时附上关键设计决策的解释。`,
        en: `You are a senior software engineer.
Excel at code generation, review, debugging, and refactoring.
Follow best practices, write concise and secure code.
Include explanations of key design decisions in output.`,
      },
      enabledTools: [],
      maxIterations: 8,
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  },
  {
    id: 'preset-critic',
    type: 'agent',
    labelKey: 'preset.critic',
    descKey: 'preset.critic.desc',
    iconName: 'ShieldAlert',
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50',
    data: {
      systemPrompt: {
        zh: `你是一个极其严格的批判性评估者。
找出上游内容中的所有缺陷、风险和逻辑漏洞。
不要客气，直接指出问题。
输出：问题清单 + 严重程度 + 改进建议。`,
        en: `You are an extremely rigorous critical evaluator.
Find all flaws, risks, and logical gaps in upstream content.
Be direct, point out problems without sugarcoating.
Output: issue list + severity + improvement suggestions.`,
      },
      enabledTools: [],
      maxIterations: 5,
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  },
  {
    id: 'preset-planner',
    type: 'agent',
    labelKey: 'preset.planner',
    descKey: 'preset.planner.desc',
    iconName: 'ListChecks',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    data: {
      systemPrompt: {
        zh: `你是一个专业的项目规划师。
将复杂任务分解为可执行的步骤。
考虑依赖关系、优先级和时间线。
输出：分步计划 + 里程碑 + 风险预案。`,
        en: `You are a professional project planner.
Break complex tasks into actionable steps.
Consider dependencies, priorities, and timelines.
Output: step-by-step plan + milestones + risk mitigation.`,
      },
      enabledTools: [],
      maxIterations: 5,
      provider: 'deepseek',
      model: 'deepseek-chat',
    },
  },
];
