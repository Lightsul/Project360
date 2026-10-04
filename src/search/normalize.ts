/** Normalisation insensible aux accents et à la casse (NFD puis retrait des diacritiques). */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Jetons : mots et identifiants à tirets (CR-04, SEC-210, go-live). */
export function tokenize(s: string): string[] {
  return Array.from(s.normalize('NFC').matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu), (m) => m[0])
}

/** « CR-04 » → ["cr-04", "cr04"] pour retrouver aussi « cr04 ». */
export function processTerm(term: string): string[] | null {
  const f = fold(term)
  if (f.length < 2 && !/\d/.test(f)) return null
  if (STOP.has(f)) return null
  return f.includes('-') ? [f, f.replace(/-/g, '')] : [f]
}

const STOP = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'ou', 'au', 'aux', 'en', 'a', 'est', 'il', 'elle', 'on', 'ce', 'ca', 'que', 'qui', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'pour', 'par', 'sur', 'dans', 'pas', 'ne', 'se', 'sa', 'son', 'ses', 'the', 'l', 'd', 'qu', 'y', 'avec', 'sont', 'été', 'ete'])

/** Synonymes utiles pour un repreneur qui ne connaît pas le vocabulaire du corpus. */
export const SYNONYMS: [RegExp, string][] = [
  [/\brollback\b/i, 'retour arrière'],
  [/retour arri[eè]re/i, 'rollback'],
  [/\bgo[- ]?live\b/i, 'mise en production'],
  [/mise en production/i, 'go-live'],
  [/\bresponsable\b|\bchef de projet\b/i, 'chargé de projet'],
  [/h[ée]bergement|r[ée]gion/i, 'Canada Central'],
  [/\bcontraste\b/i, 'ACC-302'],
  [/\bfocus\b|clavier/i, 'ACC-303'],
  [/journal|audit/i, 'SEC-210'],
  [/connecteur/i, 'INT-101'],
  [/doublon/i, 'DATA-401'],
  [/lenteur|performance/i, 'PERF-501'],
  [/\bmobile\b/i, 'CR-04'],
  [/budget|montant/i, 'autorisé'],
]

export function expandQuery(q: string): string {
  const extra = SYNONYMS.filter(([re]) => re.test(q)).map(([, s]) => s)
  return extra.length ? `${q} ${extra.join(' ')}` : q
}

/** Découpe un texte en segments surlignés selon les termes (comparaison sans accents). */
export function highlightTerms(text: string, terms: string[]): { t: string; hit: boolean }[] {
  const wanted = terms.map(fold).filter((t) => t.length >= 2)
  if (!wanted.length) return [{ t: text, hit: false }]
  // Chaque caractère d'origine → sa forme repliée (1 pour 1 dans l'immense majorité des cas).
  const chars = Array.from(text)
  const folded = chars.map((c) => fold(c) || c)
  const flat = folded.join('')
  const offsets: number[] = []
  let acc = 0
  for (const f of folded) { offsets.push(acc); acc += f.length }
  const hits = new Array(chars.length).fill(false)
  for (const w of wanted) {
    let i = flat.indexOf(w)
    while (i !== -1) {
      for (let k = 0; k < chars.length; k++) if (offsets[k] >= i && offsets[k] < i + w.length) hits[k] = true
      i = flat.indexOf(w, i + w.length)
    }
  }
  const out: { t: string; hit: boolean }[] = []
  chars.forEach((c, k) => {
    const last = out[out.length - 1]
    if (last && last.hit === hits[k]) last.t += c
    else out.push({ t: c, hit: hits[k] })
  })
  return out
}

/** Extrait d'environ `size` caractères centré sur le premier terme trouvé. */
export function snippet(text: string, terms: string[], size = 200): string {
  const flat = fold(text)
  let pos = -1
  for (const t of terms.map(fold)) {
    const i = flat.indexOf(t)
    if (i !== -1 && (pos === -1 || i < pos)) pos = i
  }
  if (text.length <= size) return text
  const start = Math.max(0, pos - Math.floor(size / 3))
  return (start > 0 ? '… ' : '') + text.slice(start, start + size).trim() + (start + size < text.length ? ' …' : '')
}
