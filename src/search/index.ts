import MiniSearch, { type SearchResult } from 'minisearch'
import type { CurrentState } from '../domain/applyUpdates'
import type { Source } from '../domain/types'
import { expandQuery, processTerm, snippet, tokenize } from './normalize'

export type DocKind = 'question' | 'condition' | 'action' | 'decision' | 'contradiction' | 'evenement' | 'brief' | 'incertitude' | 'source'

export interface SearchDoc {
  id: string
  kind: DocKind
  ref: string // id de l'élément (Q01, D5…) ou de la source
  title: string
  text: string
  /** pour une source : passage exact à surligner dans le tiroir */
  passage?: string
  route: string
}

export const KIND_GROUP: Record<DocKind, string> = {
  question: 'Questions', condition: 'Conditions de go-live', action: 'Actions', decision: 'Décisions', contradiction: 'Contradictions',
  evenement: 'Chronologie', brief: 'Brief', incertitude: 'Incertitudes', source: 'Sources (passages)',
}

/** Découpe une source en passages courts pour pointer le résultat précis. */
export function chunkSource(s: Source): string[] {
  if (s.format === 'xlsx' || s.format === 'image') return s.text.split('\n').filter((l) => l.trim())
  const paras = s.text.split(/\n\s*\n/)
  return paras.flatMap((p) => (p.split('\n').length > 3 ? p.split('\n') : [p])).map((p) => p.trim()).filter((p) => p.length > 1)
}

export function buildDocs(state: CurrentState, sources: readonly Source[]): SearchDoc[] {
  const docs: SearchDoc[] = []
  for (const q of state.questions) docs.push({ id: `q:${q.id}`, kind: 'question', ref: q.id, title: `${q.id} — ${q.question}`, text: [q.court, ...q.detail, q.nuance].join(' '), route: `/questions?focus=${q.id}` })
  for (const c of state.conditions) docs.push({ id: `c:${c.id}`, kind: 'condition', ref: c.id, title: `${c.id} — ${c.titre}`, text: [c.etat, ...c.manque, c.ticket, c.porteur].join(' '), route: `/go-live?focus=${c.id}` })
  for (const a of state.actions) docs.push({ id: `a:${a.id}`, kind: 'action', ref: a.id, title: `${a.id} — ${a.titre}`, text: [a.resp, a.statut, a.echeance, a.echeance_note ?? '', a.cond ?? ''].join(' '), route: `/go-live?focus=${a.id}` })
  for (const d of state.decisions) docs.push({ id: `d:${d.id}`, kind: 'decision', ref: d.id, title: `${d.id} — ${d.titre}`, text: [d.enonce, d.decideur, d.propose_par ?? '', d.pourquoi, d.statut].join(' '), route: `/decisions?focus=${d.id}` })
  for (const c of state.contradictions) docs.push({ id: `x:${c.id}`, kind: 'contradiction', ref: c.id, title: `${c.id} — ${c.sujet}`, text: [...c.oppose.map((o) => o.texte), c.tranche.texte, c.pourquoi].join(' '), route: `/decisions?focus=${c.id}` })
  for (const e of state.timeline) docs.push({ id: `t:${e.id}`, kind: 'evenement', ref: e.id, title: e.titre, text: [e.date, e.qui ?? '', e.detail ?? '', ...e.refs.map((r) => r.q)].join(' '), route: `/chronologie?focus=${e.id}` })
  for (const b of state.brief) docs.push({ id: `b:${b.id}`, kind: 'brief', ref: b.id, title: `${b.theme} — ${b.titre}`, text: b.texte, route: `/?focus=${b.id}` })
  for (const u of state.incertitudes) docs.push({ id: `u:${u.id}`, kind: 'incertitude', ref: u.id, title: u.sujet, text: `${u.texte} ${u.impact}`, route: `/guide?focus=${u.id}` })
  for (const s of sources) {
    docs.push({ id: `s:${s.id}`, kind: 'source', ref: s.id, title: `${s.id} — ${s.title}`, text: `${s.file} ${s.usage}`, route: `/sources?focus=${s.id}` })
    chunkSource(s).forEach((p, i) => docs.push({ id: `s:${s.id}:${i}`, kind: 'source', ref: s.id, title: `${s.id} — ${s.title}`, text: p, passage: p, route: `/sources?focus=${s.id}` }))
  }
  return docs
}

export interface Hit { doc: SearchDoc; score: number; terms: string[]; excerpt: string }

export class SearchIndex {
  private ms: MiniSearch<SearchDoc>
  private byId: Map<string, SearchDoc>

  constructor(docs: SearchDoc[]) {
    this.ms = new MiniSearch<SearchDoc>({
      fields: ['title', 'text'],
      storeFields: ['id'],
      tokenize,
      processTerm,
      searchOptions: { boost: { title: 2 }, prefix: (t) => t.length >= 3, fuzzy: (t) => (t.length >= 6 ? 0.2 : false) },
    })
    this.ms.addAll(docs)
    this.byId = new Map(docs.map((d) => [d.id, d]))
  }

  search(query: string, limit = 60): Hit[] {
    const q = query.trim()
    if (!q) return []
    const run = (combineWith: 'AND' | 'OR', text: string) => this.ms.search(text, { combineWith })
    // D'abord tous les mots de la requête ; si rien, requête élargie (synonymes, OU).
    let res: SearchResult[] = run('AND', q)
    if (res.length < 3) {
      const seen = new Set(res.map((r) => r.id))
      res = [...res, ...run('OR', expandQuery(q)).filter((r) => !seen.has(r.id)).map((r) => ({ ...r, score: r.score * 0.5 }))]
    }
    return res.slice(0, limit).map((r) => {
      const doc = this.byId.get(r.id as string)!
      const terms = [...new Set([...r.terms, ...tokenize(q)])]
      return { doc, score: r.score, terms, excerpt: snippet(doc.text, terms) }
    })
  }
}

export function groupHits(hits: Hit[]): [DocKind, Hit[]][] {
  const m = new Map<DocKind, Hit[]>()
  for (const h of hits) m.set(h.doc.kind, [...(m.get(h.doc.kind) ?? []), h])
  const order: DocKind[] = ['question', 'condition', 'action', 'decision', 'contradiction', 'brief', 'evenement', 'incertitude', 'source']
  return order.filter((k) => m.has(k)).map((k) => [k, m.get(k)!])
}
