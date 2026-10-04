import { z } from 'zod'

// ───────────────────────── Vocabulaires contrôlés

export const AUTHORITIES = ['decision', 'validation', 'fournisseur', 'suivi', 'brouillon', 'copie', 'hors-projet', 'consigne'] as const
export const Authority = z.enum(AUTHORITIES)
export type Authority = z.infer<typeof Authority>

export const EVENT_TYPES = ['proposition', 'decision', 'livraison', 'validation', 'annonce', 'constat', 'document'] as const
export const EventType = z.enum(EVENT_TYPES)
export type EventType = z.infer<typeof EventType>

export const SOURCE_KINDS = ['courriel', 'reunion', 'ticket', 'capture', 'document', 'tableur', 'finance', 'architecture', 'teams', 'archive', 'consigne', 'nouvelle-info'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export const SOURCE_STATUTS = ['courant', 'historique', 'perime', 'contredit', 'copie', 'hors-projet'] as const
export type SourceStatut = (typeof SOURCE_STATUTS)[number]

export const TOPICS = ['date', 'golive', 'connecteur', 'securite', 'accessibilite', 'runbook', 'budget', 'factures', 'mobile', 'portee', 'hebergement', 'responsable', 'migration', 'performance'] as const
export type Topic = (typeof TOPICS)[number]

// ───────────────────────── Preuves

/** Un repère de preuve : source, localisation précise, citation verbatim. */
export const Evidence = z.object({
  s: z.string().min(1), // id de source
  l: z.string().min(1), // localisation : heure, §, cellule F7, étape 4, p. 1…
  q: z.string().min(1), // citation verbatim (vérifiée par verify-citations)
})
export type Evidence = z.infer<typeof Evidence>

/** Trace d'une modification apportée par une mise à jour (jamais sur le baseline). */
export const Modif = z.object({
  maj: z.string(),
  champ: z.string(),
  avant: z.string(),
  apres: z.string(),
  note: z.string().optional(),
})
export type Modif = z.infer<typeof Modif>

const withModifs = { modifs: z.array(Modif).optional() }

// ───────────────────────── Baseline

export const BriefItem = z.object({
  id: z.string(),
  theme: z.string(),
  titre: z.string(),
  texte: z.string(),
  refs: z.array(Evidence).min(1),
  ...withModifs,
})
export type BriefItem = z.infer<typeof BriefItem>

export const Question = z.object({
  id: z.string().regex(/^Q\d{2}$/),
  question: z.string(),
  court: z.string(),
  detail: z.array(z.string()),
  nuance: z.string(),
  refs: z.array(Evidence).min(1),
  ...withModifs,
})
export type Question = z.infer<typeof Question>

export const CONDITION_STATUTS = ['ouverte', 'en validation', 'remplie'] as const
export const Condition = z.object({
  id: z.enum(['G1', 'G2', 'G3']),
  titre: z.string(),
  ticket: z.string(),
  porteur: z.string(),
  statut: z.enum(CONDITION_STATUTS),
  etat: z.string(),
  manque: z.array(z.string()),
  refs: z.array(Evidence).min(1),
  ...withModifs,
})
export type Condition = z.infer<typeof Condition>

export const Action = z.object({
  id: z.string(),
  cond: z.enum(['G1', 'G2', 'G3']).nullable(),
  titre: z.string(),
  resp: z.string(),
  resp_t: z.enum(['confirmé', 'proposé']),
  nature: z.enum(['engagement', 'recommandation']),
  echeance: z.string(), // date ISO ou « à confirmer »
  echeance_note: z.string().optional(),
  statut: z.string(),
  refs: z.array(Evidence),
  origine: z.string().optional(), // id de MAJ si l'action vient d'une mise à jour
  ...withModifs,
})
export type Action = z.infer<typeof Action>

export const TimelineEvent = z.object({
  id: z.string(),
  date: z.string(), // AAAA-MM-JJ ou AAAA-MM
  heure: z.string().optional(),
  type: EventType,
  titre: z.string(),
  detail: z.string().optional(),
  qui: z.string().optional(),
  topics: z.array(z.string()),
  refs: z.array(Evidence).min(1),
  origine: z.string().optional(),
})
export type TimelineEvent = z.infer<typeof TimelineEvent>

export const Decision = z.object({
  id: z.string(),
  date: z.string(),
  titre: z.string(),
  enonce: z.string(),
  decideur: z.string(),
  propose_par: z.string().optional(),
  pourquoi: z.string(),
  statut: z.string(),
  refs: z.array(Evidence).min(1),
  ...withModifs,
})
export type Decision = z.infer<typeof Decision>

export const Contradiction = z.object({
  id: z.string(),
  sujet: z.string(),
  oppose: z.array(z.object({ texte: z.string(), refs: z.array(Evidence).min(1) })).min(1),
  tranche: z.object({ texte: z.string(), refs: z.array(Evidence).min(1) }),
  critere: z.enum(['autorité', 'date', 'autorité et date']),
  pourquoi: z.string(),
  ...withModifs,
})
export type Contradiction = z.infer<typeof Contradiction>

export const Uncertainty = z.object({
  id: z.string(),
  sujet: z.string(),
  texte: z.string(),
  impact: z.string(),
  refs: z.array(Evidence),
})
export type Uncertainty = z.infer<typeof Uncertainty>

export const Person = z.object({
  nom: z.string(),
  role: z.string(),
  note: z.string().optional(),
  refs: z.array(Evidence).min(1),
})
export type Person = z.infer<typeof Person>

export const InvoiceLine = z.object({ desc: z.string(), montant: z.number(), approuve: z.boolean(), note: z.string().optional() })
export const Invoice = z.object({
  id: z.string(),
  date: z.string(),
  statut: z.string(),
  lignes: z.array(InvoiceLine),
  traitement: z.string(),
  refs: z.array(Evidence).min(1),
})
export type Invoice = z.infer<typeof Invoice>

export const Finance = z.object({
  autorise: z.array(z.object({ label: z.string(), montant: z.number(), refs: z.array(Evidence).min(1) })),
  nonAutorise: z.array(z.object({ label: z.string(), montant: z.number(), refs: z.array(Evidence).min(1) })),
  factures: z.array(Invoice),
  horsProjet: z.array(z.object({ id: z.string(), projet: z.string(), montant: z.number(), refs: z.array(Evidence).min(1) })),
})
export type Finance = z.infer<typeof Finance>

export const Baseline = z.object({
  meta: z.object({ date: z.string(), libelle: z.string(), projet: z.string() }),
  brief: z.array(BriefItem),
  questions: z.array(Question).length(10),
  conditions: z.array(Condition).length(3),
  actions: z.array(Action),
  timeline: z.array(TimelineEvent),
  decisions: z.array(Decision),
  contradictions: z.array(Contradiction),
  incertitudes: z.array(Uncertainty),
  personnes: z.array(Person),
  finance: Finance,
})
export type Baseline = z.infer<typeof Baseline>

// ───────────────────────── Mises à jour

export const IMPACT_KINDS = ['question', 'condition', 'action', 'decision', 'brief'] as const
export const Impact = z.object({
  kind: z.enum(IMPACT_KINDS),
  id: z.string().min(1),
  champ: z.string().min(1), // champ modifié (statut, court, echeance, texte…)
  avant: z.string().default(''),
  apres: z.string().min(1),
  note: z.string().default(''),
})
export type Impact = z.infer<typeof Impact>

export const PROPOSITION_STATUTS = ['proposition', 'décision', 'validation', 'annonce', 'constat', 'livraison', 'aucune'] as const

export const UpdateSource = z.object({
  id: z.string().min(1),
  titre: z.string().min(1),
  date: z.string().min(1),
  auteur: z.string().default(''),
  autorite: Authority,
  texte: z.string().min(1),
})
export type UpdateSource = z.infer<typeof UpdateSource>

export const Update = z.object({
  id: z.string().regex(/^MAJ-\d+$/),
  date: z.string().min(1),
  titre: z.string().min(1),
  source: UpdateSource,
  statut_probleme: z.string().min(1),
  decision_anterieure: z.string().default(''),
  nouvelle_proposition: z.string().default(''),
  statut_proposition: z.enum(PROPOSITION_STATUTS),
  inchange: z.array(z.string()).default([]),
  impacts: z.array(Impact).default([]),
  actions: z.array(Action).default([]),
  refs: z.array(Evidence).default([]),
  creeLe: z.string().optional(),
})
export type Update = z.infer<typeof Update>
export type UpdateInput = z.input<typeof Update>

// ───────────────────────── Sources (générées par scripts/extract-corpus.ts)

export interface Attachment {
  filename: string
  size: number
  sha256: string
  duplicateOf?: string // id de la source séparée identique
}

export interface Caption {
  entete: string
  lignes: { t: string; box?: [number, number, number, number] }[]
  prouve: string
  ne_prouve_pas: string
  statut_preuve: 'historique' | 'courante' | 'à confirmer'
  statut_note: string
}

export interface SheetCell { ref: string; v: string }
export interface Sheet { name: string; ref: string; rows: SheetCell[][] }

export interface Source {
  id: string
  file: string
  title: string
  date: string
  kind: SourceKind
  authority: Authority
  statut: SourceStatut
  usage: string
  topics: Topic[]
  author?: string
  format: 'text' | 'email' | 'pdf' | 'xlsx' | 'image'
  text: string // texte intégral indexé (pour une image : la transcription)
  size: number
  sha256: string
  email?: { from: string; to: string; cc?: string; date: string; subject: string; messageId: string; attachments: Attachment[]; duplicateOf?: string }
  pages?: string[]
  sheets?: Sheet[]
  image?: { dataUri: string; w: number; h: number; caption: Caption }
  original?: { mime: string; b64: string }
}
