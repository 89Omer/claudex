import { calcCost, getContextWindow } from './config.js'

export function createSession(role, model) {
  return {
    id: Date.now().toString(36),
    role,
    model,
    startTime: Date.now(),
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    messages: 0,
  }
}

export function updateSessionTokens(session, inputTokens, outputTokens) {
  session.inputTokens += inputTokens
  session.outputTokens += outputTokens
  session.cost = calcCost(session.inputTokens, session.outputTokens, session.model)
  session.messages += 1
  return session
}

export function getTokenUsagePercent(session) {
  const total = session.inputTokens + session.outputTokens
  const max = getContextWindow(session.model)
  return Math.min((total / max) * 100, 100)
}

export function getElapsedTime(session) {
  const ms = Date.now() - session.startTime
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export function formatCost(cost) {
  if (cost < 0.01) return '$0.00'
  return `$${cost.toFixed(3)}`
}

export function formatTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}
