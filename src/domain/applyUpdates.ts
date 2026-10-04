import type { Action, Baseline, Evidence, EventType, Impact, Modif, Source, TimelineEvent, Update } from './types'
import { CONDITION_STATUTS } from './types'
import { citationExists } from './verify'

export interface JournalEntry {
  maj: string
  ok: boolean
  message: string
  impact?: Impact
  /** valeur réelle avant application (baseline ou MAJ précédente) */
  avant?: string
}

export interface CurrentState extends Baseline {
  updates: Update[]
  extraSources: Source[]
  journal: JournalEntry[]
}

/** Champs modifiables par une mise à jour, par type d'élément. */
export const EDITABLE: Record<Impact['kind'], string[]> = {
  question: ['court', 'nuance', 'detail'],
  condition: ['statut', 'etat'],
  action: ['statut', 'echeance', 'echeance_note', 'resp', 'resp_t', 'titre'],
  decision: ['statut', 'enonce'],
  brief: ['titre', 'texte'],
}

/** Autorités qui peuvent prononcer une fermeture, une validation ou une approbation. */
const CLOSING_AUTHORITIES = new Set(['validation', 'decision'])
/** Vrai si un nouveau statut équivaut à fermer / valider / approuver (« en validation » n'en est pas un). */
export function isClosing(apres: string): boolean {
  const s = apres.toLowerCase()
  if (/(\bnon\b|\bpas\b|en validation|à valider|à approuver|en attente|refus)/.test(s)) return false
  return /(^|\s)(validé|validée|accepté|acceptée|approuvé|approuvée|fermé|fermée|clos|close|remplie?|résolu|résolue|go donné)/.test(s)
}

const EVENT_OF: Record<Update['statut_proposition'], EventType> = {
  proposition: 'proposition',
  'décision': 'decision',
  validation: 'validation',
  annonce: 'annonce',
  constat: 'constat',
  livraison: 'livraison',
  aucune: 'constat',
}

export function updateToSource(u: Update): Source {
  return {
    id: u.source.id,
    file: `(nouvelle information — ${u.id})`,
    title: u.source.titre,
    date: u.source.date,
    kind: 'nouvelle-info',
    authority: u.source.autorite,
    statut: 'courant',
    usage: `Nouvelle information intégrée par ${u.id}. Autorité déclarée : ${u.source.autorite}.`,
    topics: [],
    author: u.source.auteur || undefined,
    format: 'text',
    text: u.source.texte,
    size: u.source.texte.length,
    sha256: '',
  }
}

function findTarget(state: CurrentState, kind: Impact['kind'], id: string): Record<string, unknown> | undefined {
  const list: { id: string }[] =
    kind === 'question' ? state.questions
    : kind === 'condition' ? state.conditions
    : kind === 'action' ? state.actions
    : kind === 'decision' ? state.decisions
    : state.brief
  return list.find((x) => x.id === id) as Record<string, unknown> | undefined
}

/**
 * Vérifie qu'un impact ne ferme / valide / approuve rien sans preuve d'autorité.
 * Retourne un message de refus, ou null si l'impact est acceptable.
 */
export function guardImpact(u: Update, im: Impact): string | null {
  if (!EDITABLE[im.kind].includes(im.champ)) return `Champ « ${im.champ} » non modifiable pour ${im.kind} (autorisés : ${EDITABLE[im.kind].join(', ')}).`
  if (im.kind === 'condition' && im.champ === 'statut' && !(CONDITION_STATUTS as readonly string[]).includes(im.apres))
    return `Statut de condition invalide « ${im.apres} » (attendu : ${CONDITION_STATUTS.join(' / ')}).`
  const closes = im.champ === 'statut' && isClosing(im.apres)
  if (closes) {
    const okStatus = u.statut_proposition === 'validation' || u.statut_proposition === 'décision'
    if (!okStatus || !CLOSING_AUTHORITIES.has(u.source.autorite))
      return `Refusé : « ${im.apres} » exige une preuve de validation ou de décision. La nouvelle information est « ${u.statut_proposition} » (autorité : ${u.source.autorite}). Aucune approbation n'est inventée.`
  }
  return null
}

/**
 * État actuel = baseline + mises à jour, appliquées dans l'ordre.
 * Fonction PURE : le baseline n'est jamais modifié (il est gelé) ; on travaille sur une copie.
 */
export function applyUpdates(baseline: Readonly<Baseline>, updates: readonly Update[], sources: ReadonlyMap<string, Source> = new Map()): CurrentState {
  const state: CurrentState = { ...structuredClone(baseline as Baseline), updates: [], extraSources: [], journal: [] }
  const known = new Map(sources)

  for (const u of updates) {
    state.updates.push(structuredClone(u))
    const src = updateToSource(u)
    state.extraSources.push(src)
    known.set(src.id, src)
    const log = (ok: boolean, message: string, impact?: Impact) => state.journal.push({ maj: u.id, ok, message, impact })

    // Les preuves citées par la mise à jour doivent exister mot pour mot.
    const checkRefs = (refs: Evidence[]) =>
      refs.filter((r) => {
        const s = known.get(r.s)
        const ok = !!s && citationExists(s, r)
        if (!ok) log(false, `Preuve introuvable : [${r.s} · ${r.l}] « ${r.q} »`)
        return ok
      })
    const refs = checkRefs(u.refs)

    for (const im of u.impacts) {
      const target = findTarget(state, im.kind, im.id)
      if (!target) { log(false, `Élément ${im.kind} ${im.id} introuvable`, im); continue }
      const refus = guardImpact(u, im)
      if (refus) { log(false, refus, im); continue }
      const current = target[im.champ]
      const avant = Array.isArray(current) ? current.join(' · ') : String(current ?? '')
      if (im.champ === 'detail') (target.detail as string[]).push(`[${u.id}] ${im.apres}`)
      else target[im.champ] = im.apres
      const modif: Modif = { maj: u.id, champ: im.champ, avant, apres: im.apres, note: im.note || undefined }
      target.modifs = [...((target.modifs as Modif[] | undefined) ?? []), modif]
      state.journal.push({ maj: u.id, ok: true, message: `${im.kind} ${im.id}.${im.champ} : « ${avant} » → « ${im.apres} »`, impact: im, avant })
    }

    for (const a of u.actions) {
      if (state.actions.some((x) => x.id === a.id)) { log(false, `Action ${a.id} existe déjà ; utilisez un impact pour la modifier.`); continue }
      const action: Action = { ...structuredClone(a), refs: checkRefs(a.refs), origine: u.id }
      state.actions.push(action)
      log(true, `Nouvelle action ${a.id} : ${a.titre}`)
    }

    const evRefs: Evidence[] = refs.length ? refs : [{ s: src.id, l: 'texte intégral', q: firstWords(src.text) }]
    const ev: TimelineEvent = {
      id: `T-${u.id}`,
      date: u.source.date.slice(0, 10) || u.date.slice(0, 10),
      type: EVENT_OF[u.statut_proposition],
      titre: `${u.id} — ${u.titre}`,
      detail: u.statut_probleme,
      qui: u.source.auteur || undefined,
      topics: [],
      refs: evRefs,
      origine: u.id,
    }
    state.timeline.push(ev)
  }
  state.timeline.sort((a, b) => (a.date + (a.heure ?? '')).localeCompare(b.date + (b.heure ?? '')))
  return state
}

function firstWords(text: string, n = 12): string {
  return text.trim().split(/\s+/).slice(0, n).join(' ')
}

/** Éléments modifiés (pour l'encadré « modifié par MAJ-n »). */
export function modifsOf(x: { modifs?: Modif[] } | undefined): Modif[] {
  return x?.modifs ?? []
}
