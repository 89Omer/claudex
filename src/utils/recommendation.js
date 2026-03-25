import { getModelPatterns, getModelRecommendation } from './store.js'
import { MODELS } from './config.js'
import { ROLES } from '../roles/index.js'

/**
 * Get a recommendation hint for the user based on their history
 * Returns: { modelId, modelLabel, confidence, reason } or null if no strong recommendation
 */
export function getRecommendationHint(roleId, projectPath) {
  const rec = getModelRecommendation(roleId, projectPath)

  if (!rec.recommended || rec.confidence < 0.65) {
    return null // Don't show weak recommendations
  }

  const recModel = MODELS.find(m => m.id === rec.recommended)
  if (!recModel) return null

  return {
    modelId: rec.recommended,
    modelLabel: recModel.label,
    confidence: Math.round(rec.confidence * 100),
    reason: rec.reason
  }
}

/**
 * Format a recommendation hint for display
 */
export function formatRecommendationHint(hint) {
  if (!hint) return ''
  return `💡 Recommended: ${hint.modelLabel} (${hint.confidence}% confidence) — ${hint.reason}`
}
