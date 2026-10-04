import type { CurrentState } from '../domain/applyUpdates'
import type { Authority, Evidence, Impact, Source, Update, UpdateInput } from '../domain/types'
import type { Hit, SearchIndex } from '../search/index'

export interface AIContext {
  state: CurrentState
  index: SearchIndex
  sources: ReadonlyMap<string, Source>
}

export interface AnswerParagraph { text: string; refs: Evidence[]; unverified?: number }

export interface AskAnswer {
  provider: 'local' | 'anthropic'
  titre: string
  paragraphs: AnswerParagraph[]
  nonDocumente: boolean
  passages: Hit[]
  note?: string
}

export interface DraftInput {
  texte: string
  titre: string
  date: string
  auteur: string
  autorite: Authority
}

export interface DraftResult { draft: UpdateInput; notes: string[] }

export interface Suggestion { kind: Impact['kind']; id: string; titre: string; raison: string }

/**
 * Deux implémentations : `local` (défaut, sans réseau, déterministe) et `anthropic` (clé de l'utilisateur).
 * Rien n'est jamais appliqué automatiquement : l'IA propose, l'humain accepte.
 */
export interface AIProvider {
  id: 'local' | 'anthropic'
  ask(question: string, ctx: AIContext): Promise<AskAnswer>
  draftUpdate(input: DraftInput, ctx: AIContext, nextId: string): Promise<DraftResult>
}

export const NON_DOCUMENTE = 'Non documenté dans le corpus.'

/** Tickets et identifiants cités dans un texte (SEC-210, ACC-303, INV-003, CR-04, G1, A5, Q07…). */
export function idsIn(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(/\b([A-Z]{2,5}-\d{2,4}|G[123]|A\d{1,2}|Q\d{2}|D\d|C\d{1,2})\b/g), (m) => m[1]))]
}

/** Contrôle de cohérence (local) : éléments qui citent les mêmes identifiants mais que la MAJ ne touche pas. */
export function checkConsistency(u: Update | UpdateInput, state: CurrentState): Suggestion[] {
  const text = [u.titre, u.statut_probleme, u.nouvelle_proposition ?? '', u.decision_anterieure ?? '', u.source.texte].join(' ')
  const ids = idsIn(text)
  if (!ids.length) return []
  const touched = new Set((u.impacts ?? []).map((i) => `${i.kind}:${i.id}`))
  const out: Suggestion[] = []
  const consider = (kind: Impact['kind'], id: string, titre: string, blob: string) => {
    if (touched.has(`${kind}:${id}`)) return
    const hit = ids.filter((x) => x === id || blob.includes(x))
    if (hit.length) out.push({ kind, id, titre, raison: `mentionne ${hit.join(', ')}` })
  }
  for (const c of state.conditions) consider('condition', c.id, c.titre, `${c.titre} ${c.ticket} ${c.etat}`)
  for (const a of state.actions) consider('action', a.id, a.titre, `${a.titre} ${a.cond ?? ''} ${a.refs.map((r) => r.s + ' ' + r.q).join(' ')}`)
  for (const q of state.questions) consider('question', q.id, q.question, `${q.court} ${q.refs.map((r) => r.s).join(' ')}`)
  for (const d of state.decisions) consider('decision', d.id, d.titre, `${d.enonce} ${d.refs.map((r) => r.s).join(' ')}`)
  for (const b of state.brief) consider('brief', b.id, b.theme, `${b.titre} ${b.texte}`)
  return out
}
