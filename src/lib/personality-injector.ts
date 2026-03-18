import { extractStyleSection, extractRecentExperience } from './memory-parser'

export interface PersonalityConfig {
  name?: string
  role?: string
  thinkingStyle?: 'conservative' | 'balanced' | 'bold'
  communicationStyle?: 'concise' | 'detailed' | 'socratic'
  valueOrientation?: 'efficiency' | 'user' | 'quality'
  backstory?: string
  beliefs?: string
}

const THINKING_INSTRUCTIONS: Record<string, string> = {
  conservative: `You are a conservative, risk-averse thinker.
- Default to proven, battle-tested approaches. Distrust hype and trends.
- Always emphasize risks, costs, and failure cases before discussing benefits.
- When in doubt, recommend doing less, not more. Complexity is the enemy.
- Your instinct is to say "don't do it" unless there's overwhelming evidence otherwise.`,
  balanced: '',
  bold: `You are a bold, aggressive thinker who pushes boundaries.
- Default to ambitious, forward-looking approaches. Embrace new paradigms.
- Always emphasize opportunities, competitive advantages, and upside potential.
- When in doubt, recommend action over inaction. Stagnation is the real risk.
- Your instinct is to say "do it now" and figure out the details later.
- Challenge conventional wisdom. If everyone says X, seriously consider not-X.`,
}

const COMMUNICATION_INSTRUCTIONS: Record<string, string> = {
  concise: `Communication style: concise and direct.
- Lead with your conclusion. No preamble, no hedging.
- Use short sentences. Bullet points over paragraphs.
- If you can say it in 3 words, don't use 10.`,
  detailed: '',
  socratic: `Communication style: Socratic method.
- Guide through questions rather than giving direct answers.
- Ask probing questions that challenge the user's assumptions.
- Let the user arrive at insights themselves through your questioning.
- End your response with 2-3 thought-provoking questions.`,
}

const VALUE_INSTRUCTIONS: Record<string, string> = {
  efficiency: `Core value: efficiency above all else.
- Optimize for speed of delivery and iteration velocity.
- Good enough today beats perfect next month.
- Reduce friction, automate everything, ship fast.`,
  user: `Core value: user experience above all else.
- Every decision should be evaluated from the end user's perspective.
- Technical elegance means nothing if users struggle.
- Advocate fiercely for the user, even against business pressure.`,
  quality: `Core value: quality and correctness above all else.
- Never cut corners. Technical debt is real debt.
- Thorough testing, careful design, robust error handling.
- It's better to ship late than to ship broken.`,
}

export function buildPersonalityPrompt(
  personality: PersonalityConfig,
): string {
  const lines: string[] = []

  lines.push('=== PERSONALITY (this defines who you are — follow it faithfully) ===')

  if (personality.name || personality.role) {
    const identity = [personality.name, personality.role].filter(Boolean).join(' · ')
    lines.push(`You are ${identity}.`)
  }

  const thinking = personality.thinkingStyle && THINKING_INSTRUCTIONS[personality.thinkingStyle]
  if (thinking) lines.push(thinking)

  const comm = personality.communicationStyle && COMMUNICATION_INSTRUCTIONS[personality.communicationStyle]
  if (comm) lines.push(comm)

  const value = personality.valueOrientation && VALUE_INSTRUCTIONS[personality.valueOrientation]
  if (value) lines.push(value)

  if (personality.backstory?.trim()) {
    lines.push(`Your background (this shapes your worldview — let it influence your judgment):\n${personality.backstory.trim()}`)
  }
  if (personality.beliefs?.trim()) {
    lines.push(`Your core beliefs (these are non-negotiable — your answers MUST reflect them):\n${personality.beliefs.trim()}`)
  }

  lines.push('=== END PERSONALITY ===')

  return lines.join('\n\n')
}

/**
 * Build the full system prompt with new injection order:
 * 1. [Personality description]
 * 2. [工作风格 section] ← highest priority, all items
 * 3. [Recent 10 experience items]
 * 4. [User system prompt]
 */
export function buildFullSystemPrompt(
  personality: PersonalityConfig | undefined,
  userSystemPrompt: string,
  privateMemory: string
): string {
  if (!personality || (!personality.name && !personality.role)) {
    return userSystemPrompt
  }

  const sections: string[] = []

  // 1. Personality description
  const personalityPrompt = buildPersonalityPrompt(personality)
  if (personalityPrompt) sections.push(personalityPrompt)

  // 2. Work style (highest priority)
  const styleSection = extractStyleSection(privateMemory)
  if (styleSection) {
    sections.push(`Your work style guidelines (follow these strictly):\n${styleSection}`)
  }

  // 3. Recent experience (last 10)
  const recentExp = extractRecentExperience(privateMemory, 10)
  if (recentExp) {
    sections.push(`Lessons from past experience:\n${recentExp}`)
  }

  // 4. User system prompt
  sections.push(userSystemPrompt)

  return sections.join('\n\n---\n\n')
}
