export type RecentSceneMessage = {
  role?: string | null
  content?: string | null
}

const MAX_SCENE_CONTEXT_CHARS = 1350
const MAX_SCENE_TURNS = 10
const MAX_TURN_CHARS = 260

export function cleanSceneMessage(content: string): string {
  return (content || '')
    .replace(/\[image:[^\]]+\]/gi, '[image previously shared]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TURN_CHARS)
}

export function buildSceneAwareImageRequest({
  currentRequest,
  recentMessagesNewestFirst,
  companionName,
}: {
  currentRequest: string
  recentMessagesNewestFirst: RecentSceneMessage[]
  companionName: string
}): string {
  const request = cleanSceneMessage(currentRequest)
  let skippedCurrentRequest = false

  const recentTurns = recentMessagesNewestFirst
    .map((message) => ({
      role: message.role === 'companion' ? 'companion' : 'user',
      content: cleanSceneMessage(message.content || ''),
    }))
    .filter((message) => {
      if (!message.content) return false
      if (
        !skippedCurrentRequest &&
        message.role === 'user' &&
        message.content.toLocaleLowerCase() === request.toLocaleLowerCase()
      ) {
        skippedCurrentRequest = true
        return false
      }
      return true
    })
    .slice(0, MAX_SCENE_TURNS)

  const prefix = [
    `CURRENT IMAGE REQUEST: ${request}`,
    '',
    'RECENT ROLEPLAY SCENE (primary continuity source; newest facts override older facts):',
  ].join('\n')
  const suffix = [
    '',
    'CONTINUITY RULE: Illustrate the exact active moment. Preserve the latest established location, time, weather, clothing, physical positions, actions, visible objects, and emotional tone. Do not reset to a generic portrait or unrelated setting unless the current request explicitly asks for that.',
  ].join('\n')

  const available = Math.max(0, MAX_SCENE_CONTEXT_CHARS - prefix.length - suffix.length - 2)
  const selectedNewestFirst: string[] = []
  let used = 0

  for (const turn of recentTurns) {
    const label = turn.role === 'companion' ? companionName : 'Mark'
    const line = `${label}: ${turn.content}`
    const cost = line.length + 1
    if (used + cost > available) break
    selectedNewestFirst.push(line)
    used += cost
  }

  const transcript = selectedNewestFirst.reverse().join('\n') || '(No earlier scene turns available.)'
  return `${prefix}\n${transcript}${suffix}`.slice(0, MAX_SCENE_CONTEXT_CHARS)
}
