import type { Authority, EventType, SourceKind, SourceStatut, Topic } from './types'

export const AUTHORITY_INFO: Record<Authority, { label: string; aide: string; rang: number }> = {
  decision: { label: 'Décision', aide: 'Instance ou personne habilitée à décider (comité, chargé de projet, ADR, contrat, CR approuvé).', rang: 1 },
  validation: { label: 'Validation', aide: 'Vérification par l’équipe responsable (QA, sécurité, architecture) : fait foi sur l’état d’un livrable.', rang: 2 },
  suivi: { label: 'Suivi', aide: 'Ticket, compte rendu, registre, plan, capture : informe, mais peut être périmé.', rang: 3 },
  fournisseur: { label: 'Fournisseur', aide: 'Déclaration de Boréal : une livraison ou une annonce, jamais une validation.', rang: 4 },
  brouillon: { label: 'Brouillon', aide: 'Document non approuvé ou non officiel : aucune valeur de décision.', rang: 5 },
  copie: { label: 'Copie', aide: 'Duplicata d’une autre source : ne compte pas comme confirmation indépendante.', rang: 6 },
  'hors-projet': { label: 'Hors projet', aide: 'Sans lien avec NOVA (bruit ou autre projet).', rang: 7 },
  consigne: { label: 'Consigne', aide: 'Consignes du défi, pas un fait NOVA.', rang: 8 },
}

export const EVENT_INFO: Record<EventType, { label: string; aide: string }> = {
  proposition: { label: 'Proposition', aide: 'Quelqu’un suggère ; rien n’est décidé.' },
  decision: { label: 'Décision', aide: 'Tranché par une autorité habilitée.' },
  livraison: { label: 'Livraison', aide: 'Le fournisseur a livré ou déployé ; pas encore validé.' },
  validation: { label: 'Validation', aide: 'Vérifié et accepté par l’équipe responsable.' },
  annonce: { label: 'Annonce non validée', aide: 'Affirmation (statut « vert », « réglé ») sans preuve de validation.' },
  constat: { label: 'Constat', aide: 'Observation d’un fait ou d’un défaut.' },
  document: { label: 'Document', aide: 'Publication d’un document de référence (plan, facture, rapport…).' },
}

export const STATUT_INFO: Record<SourceStatut, { label: string; aide: string }> = {
  courant: { label: 'Courante', aide: 'Fait foi au 30 sept 09:00.' },
  historique: { label: 'Historique', aide: 'Exacte à sa date, dépassée depuis.' },
  perime: { label: 'Périmée', aide: 'Remplacée par une source plus récente ou plus autorisée.' },
  contredit: { label: 'Contredite', aide: 'Affirme quelque chose que des sources plus fiables contredisent.' },
  copie: { label: 'Copie', aide: 'Duplicata.' },
  'hors-projet': { label: 'Hors projet', aide: 'Ne concerne pas NOVA.' },
}

export const KIND_LABEL: Record<SourceKind, string> = {
  courriel: 'Courriel', reunion: 'Réunion', ticket: 'Ticket', capture: 'Capture', document: 'Document', tableur: 'Tableur',
  finance: 'Contrat / finance', architecture: 'Architecture', teams: 'Teams', archive: 'Archive', consigne: 'Consigne', 'nouvelle-info': 'Nouvelle info',
}

export const TOPIC_LABEL: Record<Topic, string> = {
  date: 'Date', golive: 'Go-live', connecteur: 'Connecteur', securite: 'Sécurité', accessibilite: 'Accessibilité', runbook: 'Runbook',
  budget: 'Budget', factures: 'Factures', mobile: 'Mobile', portee: 'Portée', hebergement: 'Hébergement', responsable: 'Responsable',
  migration: 'Migration', performance: 'Performance',
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « 2026-09-10 » → « 10 sept. 2026 » ; « 2026-06 » → « juin 2026 (jour inconnu) ». */
export function frDate(iso: string, heure?: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T(\d{2}:\d{2}))?/.exec(iso)
  if (!m) return iso
  const [, y, mo, d, t] = m
  const base = d ? `${Number(d)} ${MOIS[Number(mo) - 1]} ${y}` : `${MOIS[Number(mo) - 1]} ${y} (jour inconnu)`
  const h = heure ?? t
  return h ? `${base}, ${h.replace(':', ' h ')}` : base
}

export const money = (n: number) => `${n.toLocaleString('fr-CA')}\u00a0$`
