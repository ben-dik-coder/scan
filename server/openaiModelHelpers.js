/**
 * Noen OpenAI-modeller tillater ikke temperature/top_p annet enn standard (1).
 * (f.eks. gpt-5-*, visse reasoning-modeller)
 * @param {string} model
 */
export function modelSupportsCustomTemperature(model) {
  const m = String(model || '').toLowerCase()
  if (m.includes('gpt-5')) return false
  if (/^o[0-9]/.test(m)) return false
  return true
}
