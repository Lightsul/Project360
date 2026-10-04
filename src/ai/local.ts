import type { CurrentState } from '../domain/applyUpdates'
import { frDate } from '../domain/authority'
import type { Impact, UpdateInput } from '../domain/types'
import { fold } from '../search/normalize'
import { NON_DOCUMENTE, idsIn, type AIContext, type AIProvider, type AnswerParagraph, type AskAnswer, type DraftInput, type DraftResult } from './provider'

const BASELINE_DAY = '2026-09-30'

type Builder = (s: CurrentState, q: string, ctx: AIContext) => { titre: string; paragraphs: AnswerParagraph[] } | null

const fromQuestion = (id: string): Builder => (s) => {
  const q = s.questions.find((x) => x.id === id)!
  return { titre: `${q.id} — ${q.question}`, paragraphs: [{ text: q.court, refs: q.refs }, { text: `Nuance : ${q.nuance}`, refs: [] }] }
}

/** Intentions reconnues (questions types des consignes + les dix questions). L'ordre compte : du plus précis au plus général. */
const INTENTS: [RegExp, Builder][] = [
  [/chang\w* depuis|semaine derni|quoi de neuf|r[ée]cemment|derniers? jours/, (s) => {
    const since = '2026-09-23'
    const evs = s.timeline.filter((e) => e.date >= since)
    return {
      titre: `Ce qui a changé depuis le ${frDate(since)} (${evs.length} événements)`,
      paragraphs: evs.map((e) => ({ text: `${frDate(e.date, e.heure)} — [${e.type}] ${e.titre}`, refs: e.refs.slice(0, 1) })),
    }
  }],
  [/reprendre|demain matin|devrais[- ]je savoir|brief|r[ée]sum[ée]|vue d.ensemble|situation/, (s) => ({
    titre: 'Si vous reprenez le projet demain matin',
    paragraphs: s.brief.map((b) => ({ text: `${b.theme} : ${b.titre}. ${b.texte}`, refs: b.refs.slice(0, 2) })),
  })],
  [/risque/, (s) => {
    const g = (id: string) => s.conditions.find((c) => c.id === id)!
    return {
      titre: 'Trois principaux risques au 30 septembre (analyse de l’équipe, appuyée sur le registre et les tickets)',
      paragraphs: [
        { text: `1. Exploitation — ${g('G3').titre} : ${g('G3').etat} (registre R-03 ouvert, impact élevé).`, refs: g('G3').refs.slice(1, 4) },
        { text: `2. Sécurité — ${g('G1').titre} : ${g('G1').etat} (registre R-02, probabilité élevée).`, refs: g('G1').refs.slice(1) },
        { text: `3. Accessibilité — ${g('G2').titre} : ${g('G2').etat} (registre R-04).`, refs: g('G2').refs.slice(1) },
        { text: 'Hors go-live : la facture INV-003 contient 18 000 $ (CR-04) non autorisés, un risque financier et contractuel.', refs: s.questions.find((q) => q.id === 'Q06')!.refs.slice(0, 2) },
      ],
    }
  }],
  [/contradict|incoh[ée]ren|conflit|se contredi/, (s) => ({
    titre: `${s.contradictions.length} contradictions identifiées et tranchées`,
    paragraphs: s.contradictions.map((c) => ({ text: `${c.id} — ${c.sujet} → ${c.tranche.texte} (tranché par ${c.critere})`, refs: c.tranche.refs.slice(0, 1) })),
  })],
  [/engagement|pas (encore )?(compl[ée]t|termin|fait)|reste [àa] faire|actions? (restante|ouverte|[àa] faire)|prochaines? (actions|[ée]tapes)/, (s) => {
    const acts = s.actions.filter((a) => a.nature === 'engagement')
    return {
      titre: `${acts.length} engagements documentés non complétés (+ ${s.actions.length - acts.length} recommandations de l’équipe)`,
      paragraphs: acts.map((a) => ({ text: `${a.id} — ${a.titre}. Responsable : ${a.resp} (${a.resp_t}). Échéance : ${a.echeance}. Statut : ${a.statut}.`, refs: a.refs.slice(0, 1) })),
    }
  }],
  [/fournisseur|bor[ée]al|julien/, (s) => {
    const ids = ['D5', 'D6', 'D8', 'D4', 'D2']
    return {
      titre: 'Décisions concernant le fournisseur (Boréal Numérique)',
      paragraphs: ids.map((id) => s.decisions.find((d) => d.id === id)!).map((d) => ({ text: `${frDate(d.date)} — ${d.titre}. ${d.propose_par ? `Proposé par : ${d.propose_par}. ` : ''}Décideur : ${d.decideur}.`, refs: d.refs.slice(0, 2) })),
    }
  }],
  [/pourquoi.*(d[ée]cision|d[ée]cid)/, (s, q, ctx) => {
    const hit = ctx.index.search(q).find((h) => h.doc.kind === 'decision')
    const d = hit ? s.decisions.find((x) => x.id === hit.doc.ref) : s.decisions.find((x) => x.id === 'D5')
    if (!d) return null
    return { titre: `${d.id} — ${d.titre}`, paragraphs: [{ text: `Pourquoi : ${d.pourquoi}`, refs: d.refs }, { text: `Décideur : ${d.decideur}${d.propose_par ? ` ; proposé par : ${d.propose_par}` : ''}.`, refs: [] }] }
  }],
  [/approuv|propos[ée]|qui a d[ée]cid/, fromQuestion('Q03')],
  [/pourquoi.*(date|report|chang|retard)|connecteur|int-101|cause/, fromQuestion('Q02')],
  [/budget|montant|autoris|contrat|plafond|combien/, fromQuestion('Q05')],
  [/inv-003|factur|cr-04|paiement/, fromQuestion('Q06')],
  [/h[ée]berg|canada|r[ée]gion|east us|donn[ée]es/, fromQuestion('Q07')],
  [/s[ée]curit|sec-210|audit|journal/, fromQuestion('Q08')],
  [/accessib|acc-30|clavier|focus|contraste/, fromQuestion('Q09')],
  [/condition|runbook|rollback|retour arri|ops-601/, fromQuestion('Q10')],
  [/responsable|charg[ée] de projet|qui (g[èe]re|pilote|dirige)|perron|[ée]lodie/, fromQuestion('Q04')],
  [/date|quand|livraison|mise en production|go.?live|lancement/, fromQuestion('Q01')],
]

function ask(question: string, ctx: AIContext): AskAnswer {
  const q = fold(question)
  const passages = ctx.index.search(question, 30).filter((h) => h.doc.kind === 'source').slice(0, 6)
  for (const [re, build] of INTENTS) {
    if (!re.test(q)) continue
    const r = build(ctx.state, question, ctx)
    if (r) return { provider: 'local', ...r, nonDocumente: false, passages, note: 'Réponse assemblée à partir de la mémoire vérifiée (mode local, sans IA générative).' }
  }
  // Repli : l'élément de mémoire le mieux classé, sinon les passages des sources.
  const best = ctx.index.search(question, 10).find((h) => h.doc.kind !== 'source' && h.doc.kind !== 'evenement')
  if (best) {
    return {
      provider: 'local',
      titre: best.doc.title,
      paragraphs: [{ text: best.doc.text, refs: [] }],
      nonDocumente: false,
      passages,
      note: 'Correspondance par mots-clés : vérifiez les passages ci-dessous.',
    }
  }
  return { provider: 'local', titre: NON_DOCUMENTE, paragraphs: [], nonDocumente: passages.length === 0, passages, note: passages.length ? 'Aucune réponse rédigée ; voici les passages les plus proches.' : undefined }
}

const GUESS: [RegExp, UpdateInput['statut_proposition']][] = [
  [/approuv|d[ée]cid|ent[ée]rin|accord[ée]/, 'décision'],
  [/re-?test ok|valid[ée]|accept[ée]|ferm[ée]/, 'validation'],
  [/propos|recommand|sugg[èe]r|pourrait|envisag/, 'proposition'],
  [/d[ée]ploy|livr[ée]|pouss[ée]|correctif disponible/, 'livraison'],
  [/devrait|r[ée]gl[ée] pour nous|au vert|tout est ok/, 'annonce'],
]

/** Brouillon déterministe : repère les identifiants cités et pré-remplit les impacts à préciser. */
function draftUpdate(input: DraftInput, ctx: AIContext, nextId: string): DraftResult {
  const t = fold(input.texte)
  const notes: string[] = []
  let statut = GUESS.find(([re]) => re.test(t))?.[1] ?? 'constat'
  if ((statut === 'décision' || statut === 'validation') && input.autorite !== 'decision' && input.autorite !== 'validation') {
    notes.push(`Le texte évoque une ${statut}, mais l'autorité déclarée est « ${input.autorite} » : statut ramené à « proposition ». Aucune approbation n'est inventée.`)
    statut = 'proposition'
  }
  const ids = idsIn(input.texte)
  const impacts: Impact[] = []
  for (const c of ctx.state.conditions) {
    if (ids.includes(c.ticket) || ids.includes(c.id)) impacts.push({ kind: 'condition', id: c.id, champ: 'etat', avant: c.etat, apres: `${c.etat} — à préciser selon ${nextId}`, note: `Ticket ${c.ticket} mentionné` })
  }
  for (const a of ctx.state.actions) {
    const linked = a.cond && impacts.some((i) => i.kind === 'condition' && i.id === a.cond)
    if (ids.includes(a.id) || linked) impacts.push({ kind: 'action', id: a.id, champ: 'statut', avant: a.statut, apres: `${a.statut} — à préciser`, note: '' })
  }
  if (/\b\d{1,2} (janv|f[ée]v|mars|avr|mai|juin|juil|ao[uû]t|sept|oct|nov|d[ée]c)|\d{4}-\d{2}-\d{2}/i.test(input.texte)) notes.push('Une date est mentionnée : reportez-la dans l’échéance des actions concernées.')
  notes.push(ids.length ? `Identifiants détectés : ${ids.join(', ')}.` : 'Aucun identifiant de ticket détecté : choisissez les éléments touchés manuellement.')
  return {
    notes,
    draft: {
      id: nextId,
      date: input.date || BASELINE_DAY,
      titre: input.titre || input.texte.split(/[.\n]/)[0].slice(0, 90),
      source: { id: `${nextId}-SRC`, titre: input.titre || 'Nouvelle information', date: input.date || BASELINE_DAY, auteur: input.auteur, autorite: input.autorite, texte: input.texte },
      statut_probleme: '',
      decision_anterieure: '',
      nouvelle_proposition: '',
      statut_proposition: statut,
      inchange: ctx.state.conditions.filter((c) => !impacts.some((i) => i.kind === 'condition' && i.id === c.id)).map((c) => `${c.id} ${c.titre} : ${c.statut}`),
      impacts,
      actions: [],
      refs: [],
    },
  }
}

export const localProvider: AIProvider = {
  id: 'local',
  ask: async (q, ctx) => ask(q, ctx),
  draftUpdate: async (i, ctx, id) => draftUpdate(i, ctx, id),
}
