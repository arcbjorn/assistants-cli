export function toYAML(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj)
  if (keys.length === 0) return ''
  const serialize = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(serialize).join(', ')}]`
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'object') {
      return '\n' + Object.entries(v as Record<string, unknown>)
        .map(([k, vv]) => `  ${k}: ${serialize(vv)}`).join('\n')
    }
    if (typeof v === 'string') {
      const needsQuote = v === '' || /[:\-?{}\[\],&*#\s]|^\d/.test(v)
      return needsQuote ? JSON.stringify(v) : v
    }
    return String(v)
  }
  return keys.map((k) => `${k}: ${serialize((obj as any)[k])}`).join('\n')
}

export function withFrontMatter(fm: Record<string, unknown>, body: string): string {
  const y = toYAML(fm)
  return y ? `---\n${y}\n---\n${body}` : body
}

