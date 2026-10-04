/**
 * Recherche d'une citation verbatim dans un texte source.
 * Tolérances volontairement minimales : espaces/retours à la ligne équivalents,
 * apostrophes droite/typographique équivalentes, emphase Markdown (**) ignorée.
 * Tout le reste (casse, accents, ponctuation) doit être identique.
 */

const escapeChar = (c: string) => {
  if (c === "'" || c === '’') return "['’]"
  return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function quoteRegex(q: string): RegExp {
  const tokens = q.normalize('NFC').replace(/\*/g, '').trim().split(/\s+/).filter(Boolean)
  const body = tokens.map((t) => Array.from(t).map(escapeChar).join('\\**')).join('[\\s*]+')
  return new RegExp(body, 'u')
}

export interface Span { start: number; end: number }

export function findQuote(text: string, q: string): Span | null {
  if (!q.trim()) return null
  const m = quoteRegex(q).exec(text.normalize('NFC'))
  return m ? { start: m.index, end: m.index + m[0].length } : null
}

/** Références de cellules (A1, F7…) présentes dans un repère « Plan projet!F7 » ou « cellules F7, G7 ». */
export function cellRefs(locator: string): string[] {
  return Array.from(locator.matchAll(/\b([A-Z]{1,2}\d{1,4})\b/g), (m) => m[1])
}
