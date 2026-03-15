// 解析后的 SKILL.md 内容
export interface SkillManifest {
  name: string           // frontmatter 里的 name
  description: string    // frontmatter 里的 description
  content: string        // 完整的 markdown 内容（包含 frontmatter）
  instructions: string   // 去掉 frontmatter 后的纯指令内容
}

