export interface SlashCommand {
  command: string
  description: { en: string; zh: string }
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', description: { en: 'Show available commands', zh: '显示可用命令' } },
  { command: '/clear', description: { en: 'Clear conversation', zh: '清除对话' } },
  { command: '/compact', description: { en: 'Compact conversation context', zh: '压缩对话上下文' } },
  { command: '/config', description: { en: 'View/modify configuration', zh: '查看/修改配置' } },
  { command: '/cost', description: { en: 'Show token usage and costs', zh: '显示 token 用量和费用' } },
  { command: '/doctor', description: { en: 'Check Claude Code health', zh: '检查 Claude Code 健康状态' } },
  { command: '/init', description: { en: 'Initialize project with CLAUDE.md', zh: '初始化项目 CLAUDE.md' } },
  { command: '/login', description: { en: 'Switch authentication', zh: '切换认证方式' } },
  { command: '/logout', description: { en: 'Sign out', zh: '退出登录' } },
  { command: '/memory', description: { en: 'Edit CLAUDE.md memory', zh: '编辑 CLAUDE.md 记忆' } },
  { command: '/mcp', description: { en: 'Manage MCP servers', zh: '管理 MCP 服务器' } },
  { command: '/permissions', description: { en: 'View permission settings', zh: '查看权限设置' } },
  { command: '/review', description: { en: 'Review code changes', zh: '审查代码变更' } },
  { command: '/status', description: { en: 'Show session status', zh: '显示会话状态' } },
  { command: '/vim', description: { en: 'Toggle vim keybindings', zh: '切换 vim 按键绑定' } },
]
