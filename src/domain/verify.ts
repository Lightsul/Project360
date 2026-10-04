import type { Baseline, Evidence, Source } from './types'
import { cellRefs, findQuote } from './quote'

export interface CitationError { where: string; ref: Evidence; reason: string }

/** Parcourt récursivement un objet et retourne tous les repères {s,l,q} avec leur chemin. */
export function collectEvidence(node: unknown, path = ''): { where: string; ref: Evidence }[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => collectEvidence(n, `${path}[${i}]`))
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    if (typeof o.s === 'string' && typeof o.l === 'string' && typeof o.q === 'string') return [{ where: path, ref: o as unknown as Evidence }]
    const id = typeof o.id === 'string' ? o.id : ''
    return Object.entries(o).flatMap(([k, v]) => collectEvidence(v, `${path}${id && !path.endsWith(id) ? `/${id}` : ''}.${k}`))
  }
  return []
}

/** Vrai si la citation existe mot pour mot dans la source (ou dans la cellule visée pour un tableur). */
export function citationExists(src: Source, ref: Evidence): boolean {
  if (src.format === 'xlsx' && src.sheets) {
    const refs = cellRefs(ref.l.split('!').pop() ?? '')
    const cells = src.sheets.flatMap((s) => s.rows.flat())
    const pool = refs.length ? cells.filter((c) => refs.includes(c.ref)) : cells
    return pool.some((c) => findQuote(c.v, ref.q) !== null)
  }
  return findQuote(src.text, ref.q) !== null
}

export function verifyCitations(data: Baseline | unknown, sources: ReadonlyMap<string, Source>): { total: number; errors: CitationError[] } {
  const all = collectEvidence(data)
  const errors: CitationError[] = []
  for (const { where, ref } of all) {
    const src = sources.get(ref.s)
    if (!src) errors.push({ where, ref, reason: `source inconnue « ${ref.s} »` })
    else if (!citationExists(src, ref)) errors.push({ where, ref, reason: 'citation introuvable mot pour mot' })
  }
  return { total: all.length, errors }
}

/** Nombre de sources indépendantes : une copie (même Message-ID) compte comme son original. */
export function independentSourceCount(refs: Evidence[], sources: ReadonlyMap<string, Source>): number {
  return new Set(refs.map((r) => sources.get(r.s)?.email?.duplicateOf ?? r.s)).size
}
