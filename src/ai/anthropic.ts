import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { citationExists } from '../domain/verify'
import { IMPACT_KINDS, PROPOSITION_STATUTS, Update, type Evidence, type UpdateInput } from '../domain/types'
import { chunkSource } from '../search/index'
import { localProvider } from './local'
import { NON_DOCUMENTE, type AIContext, type AIProvider, type AnswerParagraph, type DraftInput } from './provider'

export const MODEL = 'claude-opus-5-5'

/** Prompt système imposé par le cahier des charges (§5.2). */
export const SYSTEM_PROMPT = `Tu assistes la reprise du projet NOVA. N'utilise que les extraits fournis. Cite chaque affirmation avec [source_id · localisation]. Distingue proposition, décision, livraison, validation. Ne déclare jamais une condition fermée ni une approbation sans document d'autorité cité. Si l'information manque, réponds « à confirmer ». Montants en CAD hors taxes : autorisé / facturé / payé séparés. Réponds en JSON conforme au schéma fourni.

Date de référence : 30 septembre 2026, 09 h 00 (Montréal). Réponds en français (Québec). Chaque repère {s, l, q} doit reprendre une citation copiée mot pour mot de l'extrait indiqué (q), sans reformulation : les repères sont revérifiés automatiquement et ceux qui ne correspondent pas sont rejetés.`

const KEY = 'nova-anthropic-key'
export const getKey = () => { try { return sessionStorage.getItem(KEY) ?? '' } catch { return '' } }
export const setKey = (k: string) => { try { if (k) sessionStorage.setItem(KEY, k); else sessionStorage.removeItem(KEY) } catch { /* stockage indisponible : clé non conservée */ } }

const client = () => new Anthropic({ apiKey: getKey(), dangerouslyAllowBrowser: true })

const Ref = z.object({ s: z.string(), l: z.string(), q: z.string() })
const AskSchema = z.object({
  non_documente: z.boolean(),
  paragraphes: z.array(z.object({ texte: z.string(), refs: z.array(Ref) })),
})

const DraftSchema = z.object({
  titre: z.string(),
  statut_probleme: z.string(),
  decision_anterieure: z.string(),
  nouvelle_proposition: z.string(),
  statut_proposition: z.enum(PROPOSITION_STATUTS),
  inchange: z.array(z.string()),
  impacts: z.array(z.object({ kind: z.enum(IMPACT_KINDS), id: z.string(), champ: z.string(), avant: z.string(), apres: z.string(), note: z.string() })),
  actions: z.array(z.object({
    id: z.string(), cond: z.enum(['G1', 'G2', 'G3', 'aucune']), titre: z.string(), resp: z.string(), resp_t: z.enum(['confirmé', 'proposé']),
    nature: z.enum(['engagement', 'recommandation']), echeance: z.string(), statut: z.string(),
  })),
  refs: z.array(Ref),
  notes: z.array(z.string()),
})

async function call<T extends z.ZodType>(schema: T, user: string): Promise<z.infer<T>> {
  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
    messages: [{ role: 'user', content: user }],
  })
  if (res.stop_reason === 'refusal') throw new Error('Le modèle a décliné la demande. Utilisez le mode local.')
  if (res.stop_reason === 'max_tokens') throw new Error('Réponse tronquée (limite de longueur).')
  if (!res.parsed_output) throw new Error('Réponse non conforme au schéma.')
  return res.parsed_output as z.infer<T>
}

function keepVerified(refs: Evidence[], ctx: AIContext): { ok: Evidence[]; dropped: number } {
  const ok = refs.filter((r) => { const s = ctx.sources.get(r.s); return !!s && citationExists(s, r) })
  return { ok, dropped: refs.length - ok.length }
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',

  /** RAG local : seuls les passages récupérés par la recherche sont envoyés au modèle. */
  async ask(question, ctx) {
    const hits = ctx.index.search(question, 40)
    const passages = hits.filter((h) => h.doc.kind === 'source').slice(0, 14)
    const memo = hits.filter((h) => h.doc.kind !== 'source').slice(0, 6)
    if (!passages.length && !memo.length) return { provider: 'anthropic', titre: NON_DOCUMENTE, paragraphs: [], nonDocumente: true, passages: [] }
    const extraits = passages.map((h) => {
      const src = ctx.sources.get(h.doc.ref)!
      return `<extrait source_id="${src.id}" localisation="${h.doc.passage?.slice(0, 40).replace(/"/g, "'") ?? 'texte'}" autorite="${src.authority}" date="${src.date}" validite="${src.statut}">\n${h.doc.passage ?? chunkSource(src)[0]}\n</extrait>`
    })
    const memoire = memo.map((h) => `<memoire_verifiee id="${h.doc.ref}">${h.doc.title}\n${h.doc.text}</memoire_verifiee>`)
    const out = await call(AskSchema, `${memoire.join('\n')}\n${extraits.join('\n')}\n\nQuestion : ${question}\n\nRéponds uniquement à partir de ces extraits. Si rien ne répond, non_documente = true.`)
    const paragraphs: AnswerParagraph[] = out.paragraphes.map((p) => { const v = keepVerified(p.refs, ctx); return { text: p.texte, refs: v.ok, unverified: v.dropped } })
    return { provider: 'anthropic', titre: out.non_documente ? NON_DOCUMENTE : question, paragraphs, nonDocumente: out.non_documente, passages: passages.slice(0, 6), note: `Généré par ${MODEL} à partir de ${passages.length} passages ; repères revérifiés mot pour mot.` }
  },

  /** Brouillon de mise à jour : JSON contraint par schéma, puis revalidé par zod. Rien n'est appliqué. */
  async draftUpdate(input: DraftInput, ctx, nextId) {
    const s = ctx.state
    const etat = [
      ...s.conditions.map((c) => `condition ${c.id} [statut=${c.statut}] ${c.titre} — etat: ${c.etat}`),
      ...s.actions.map((a) => `action ${a.id} [cond=${a.cond ?? '-'}] ${a.titre} — resp: ${a.resp} (${a.resp_t}) — echeance: ${a.echeance} — statut: ${a.statut}`),
      ...s.questions.map((q) => `question ${q.id} — ${q.question} — court: ${q.court}`),
      ...s.decisions.map((d) => `decision ${d.id} — ${d.titre} — statut: ${d.statut}`),
      ...s.brief.map((b) => `brief ${b.id} — ${b.theme}: ${b.titre}`),
    ].join('\n')
    const user = `<etat_actuel>\n${etat}\n</etat_actuel>
<nouvelle_information source_id="${nextId}-SRC" autorite_declaree="${input.autorite}" date="${input.date}" auteur="${input.auteur}">\n${input.texte}\n</nouvelle_information>

Propose un brouillon de mise à jour ${nextId}. Champs modifiables : question(court|nuance|detail), condition(statut|etat), action(statut|echeance|echeance_note|resp|resp_t|titre), decision(statut|enonce), brief(titre|texte).
Règles : statut_proposition = « proposition » par défaut ; « décision » ou « validation » seulement si l'autorité déclarée est decision/validation. Ne passe aucune condition à « remplie » sans validation explicite par l'autorité concernée. Liste dans « inchange » ce qui reste vrai. Les refs citent la nouvelle information (source_id ${nextId}-SRC) ou l'état actuel. Nouvelles actions : ids A${s.actions.length + 1}+, échéance « à confirmer » si absente.`
    const out = await call(DraftSchema, user)
    const notes = [...out.notes]
    let statut = out.statut_proposition
    if ((statut === 'décision' || statut === 'validation') && input.autorite !== 'decision' && input.autorite !== 'validation') {
      notes.push(`Statut « ${statut} » ramené à « proposition » : l'autorité déclarée (${input.autorite}) ne le permet pas.`)
      statut = 'proposition'
    }
    const draft: UpdateInput = {
      id: nextId,
      date: input.date,
      titre: out.titre || input.titre,
      source: { id: `${nextId}-SRC`, titre: input.titre || out.titre, date: input.date, auteur: input.auteur, autorite: input.autorite, texte: input.texte },
      statut_probleme: out.statut_probleme,
      decision_anterieure: out.decision_anterieure,
      nouvelle_proposition: out.nouvelle_proposition,
      statut_proposition: statut,
      inchange: out.inchange,
      impacts: out.impacts,
      actions: out.actions.map((a) => ({ ...a, cond: a.cond === 'aucune' ? null : a.cond, refs: [] })),
      refs: out.refs,
    }
    const check = Update.safeParse(draft)
    if (!check.success) notes.push(`Brouillon partiellement invalide (à corriger avant d'accepter) : ${check.error.issues.map((i) => i.path.join('.')).join(', ')}`)
    return { draft, notes }
  },
}

export function providerFor(mode: 'local' | 'anthropic'): AIProvider {
  return mode === 'anthropic' && getKey() ? anthropicProvider : localProvider
}
