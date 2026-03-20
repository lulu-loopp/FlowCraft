/**
 * Strip <think>...</think> tags from model output.
 * Thinking content is preserved for logging but removed from final output.
 */
export function stripThinkTags(text: string): { cleaned: string; thinking: string } {
  if (!text) return { cleaned: '', thinking: '' }

  const thinkBlocks: string[] = []

  // Match complete <think>...</think> blocks (greedy within each block, handles multiline)
  const cleaned = text.replace(/<think>([\s\S]*?)<\/think>/g, (_match, content: string) => {
    thinkBlocks.push(content.trim())
    return ''
  })

  // Also handle unclosed <think> tag at the end of the string
  const unclosedMatch = cleaned.match(/<think>([\s\S]*)$/)
  let finalCleaned = cleaned
  if (unclosedMatch) {
    thinkBlocks.push(unclosedMatch[1].trim())
    finalCleaned = cleaned.replace(/<think>[\s\S]*$/, '')
  }

  return {
    cleaned: finalCleaned.trim(),
    thinking: thinkBlocks.join('\n\n'),
  }
}
