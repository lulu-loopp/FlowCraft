export type AnimationType =
  | 'agent' | 'tool' | 'skill' | 'human'
  | 'condition' | 'merge' | 'input' | 'output'
  | 'initializer' | 'coding-agent' | 'packed';

export interface HelpContent {
  title: { zh: string; en: string };
  iconName: string;
  description: { zh: string; en: string };
  useCases: { zh: string[]; en: string[] };
  recommendedPairs: string[];
  demoFlowId: string | null;
  animationType: AnimationType;
}

/** Maps node type (from nodeTypes registry) to help content */
export const NODE_HELP: Record<string, HelpContent> = {
  agent: {
    title: { zh: '智能体', en: 'Agent' },
    iconName: 'Bot',
    description: {
      zh: 'AI 智能体节点，拥有 Think→Act→Observe 循环能力。可以配置系统提示词、工具、技能和模型。',
      en: 'AI agent node with Think→Act→Observe loop. Configurable with system prompt, tools, skills, and model.',
    },
    useCases: {
      zh: ['深度研究和信息搜集', '内容创作和文档撰写', '代码生成和分析', '数据处理和总结'],
      en: ['Deep research and information gathering', 'Content creation and writing', 'Code generation and analysis', 'Data processing and summarization'],
    },
    recommendedPairs: ['io', 'tool', 'output'],
    demoFlowId: 'demo-flowcraft-analysis',
    animationType: 'agent',
  },
  tool: {
    title: { zh: '工具', en: 'Tool' },
    iconName: 'Wrench',
    description: {
      zh: '确定性工具节点，执行快速、无歧义的操作。比如 API 调用、数据转换、文件操作。',
      en: 'Deterministic tool node for fast, unambiguous operations. API calls, data transforms, file ops.',
    },
    useCases: {
      zh: ['调用外部 API', '数据格式转换', '文件读写操作', '精确计算'],
      en: ['External API calls', 'Data format conversion', 'File read/write', 'Precise calculations'],
    },
    recommendedPairs: ['agent', 'condition'],
    demoFlowId: null,
    animationType: 'tool',
  },
  skill: {
    title: { zh: '技能', en: 'Skill' },
    iconName: 'Lightbulb',
    description: {
      zh: '知识注入节点，将预定义的指令或知识片段注入下游 Agent 的上下文中。',
      en: 'Knowledge injection node. Injects predefined instructions or knowledge into downstream Agent context.',
    },
    useCases: {
      zh: ['注入领域知识', '标准化 Agent 行为', '共享提示词模板', '动态调整 Agent 策略'],
      en: ['Inject domain knowledge', 'Standardize Agent behavior', 'Share prompt templates', 'Dynamically adjust Agent strategy'],
    },
    recommendedPairs: ['agent'],
    demoFlowId: null,
    animationType: 'skill',
  },
  human: {
    title: { zh: '人工', en: 'Human' },
    iconName: 'User',
    description: {
      zh: '人工介入节点，暂停流程等待用户确认或输入。适合需要人工判断的关键决策点。',
      en: 'Human-in-the-loop node. Pauses flow for user confirmation or input. For critical decision points.',
    },
    useCases: {
      zh: ['关键决策审批', '内容审核确认', '异常情况人工处理', '质量把关检查点'],
      en: ['Critical decision approval', 'Content review confirmation', 'Exception handling', 'Quality checkpoint'],
    },
    recommendedPairs: ['agent', 'condition'],
    demoFlowId: null,
    animationType: 'human',
  },
  io: {
    title: { zh: '输入', en: 'Input' },
    iconName: 'ArrowRightLeft',
    description: {
      zh: '流程入口节点，定义初始输入文本和文件。每个流程通常有一个输入节点。',
      en: 'Flow entry point. Defines initial input text and files. Typically one per flow.',
    },
    useCases: {
      zh: ['定义流程初始输入', '上传参考文件和图片', '设置任务目标描述'],
      en: ['Define initial flow input', 'Upload reference files and images', 'Set task goal description'],
    },
    recommendedPairs: ['agent'],
    demoFlowId: null,
    animationType: 'input',
  },
  output: {
    title: { zh: '输出', en: 'Output' },
    iconName: 'Inbox',
    description: {
      zh: '流程出口节点，收集并展示最终结果。支持复制和查看完整输出。',
      en: 'Flow exit point. Collects and displays final results. Supports copy and full view.',
    },
    useCases: {
      zh: ['汇总最终输出结果', '展示格式化的报告', '提供可复制的结果'],
      en: ['Collect final output', 'Display formatted reports', 'Provide copyable results'],
    },
    recommendedPairs: ['agent'],
    demoFlowId: null,
    animationType: 'output',
  },
  condition: {
    title: { zh: '条件', en: 'Condition' },
    iconName: 'GitBranch',
    description: {
      zh: '条件分支节点，根据上游输出决定走哪条路径。支持自然语言和表达式两种判断模式。false 出线连回上游可形成循环（自动重试），达到上限后强制走 true 路径。',
      en: 'Conditional branch node. Routes flow based on upstream output. Supports natural language and expression modes. Connect the false output back to an upstream node to create a loop (auto-retry). Forced exit via true path when loop limit is reached.',
    },
    useCases: {
      zh: ['根据结果质量决定是否重试', '按内容类型分流处理', '实现 if/else 逻辑分支', '循环迭代直到满足条件'],
      en: ['Retry based on result quality', 'Route by content type', 'Implement if/else logic branches', 'Loop until a condition is met'],
    },
    recommendedPairs: ['agent', 'human'],
    demoFlowId: null,
    animationType: 'condition',
  },
  initializer: {
    title: { zh: '触发器', en: 'Initializer' },
    iconName: 'PlayCircle',
    description: {
      zh: '初始化节点，在流程开始前执行环境准备。创建文件、设置变量、检查前置条件。',
      en: 'Initializer node. Prepares environment before flow starts. Create files, set variables, check preconditions.',
    },
    useCases: {
      zh: ['创建工作目录和文件', '初始化环境变量', '检查 API 连通性', '准备数据集'],
      en: ['Create working directories and files', 'Initialize environment variables', 'Check API connectivity', 'Prepare datasets'],
    },
    recommendedPairs: ['agent', 'io'],
    demoFlowId: null,
    animationType: 'initializer',
  },
  packed: {
    title: { zh: '封装节点', en: 'Packed Agent' },
    iconName: 'Package',
    description: {
      zh: '将多个节点封装成一个可复用的 Agent 组合。悬停可预览内部结构，双击进入查看和编辑内部流程。',
      en: 'Pack multiple nodes into a reusable Agent combination. Hover to preview internals, double-click to enter and edit.',
    },
    useCases: {
      zh: ['复用多步骤流程', '团队协作分工', '构建模块化工作流', '嵌套复杂子流程'],
      en: ['Reuse multi-step workflows', 'Team collaboration', 'Build modular pipelines', 'Nest complex sub-flows'],
    },
    recommendedPairs: ['agent', 'io'],
    demoFlowId: null,
    animationType: 'packed',
  },
};
