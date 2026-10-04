import type { Authority, EventType, SourceStatut } from '../domain/types'
import { AUTHORITY_INFO, EVENT_INFO, STATUT_INFO } from '../domain/authority'

const AUTH_CLASS: Record<Authority, string> = {
  decision: 'b-info', validation: 'b-ok', fournisseur: 'b-warn', suivi: 'b-neutral', brouillon: 'b-purple', copie: 'b-outline', 'hors-projet': 'b-outline b-strike', consigne: 'b-outline',
}
const EVENT_CLASS: Record<EventType, string> = {
  proposition: 'b-warn', decision: 'b-info', livraison: 'b-teal', validation: 'b-ok', annonce: 'b-bad', constat: 'b-neutral', document: 'b-outline',
}
const STATUT_CLASS: Record<SourceStatut, string> = {
  courant: 'b-ok', historique: 'b-neutral', perime: 'b-warn', contredit: 'b-bad', copie: 'b-outline', 'hors-projet': 'b-outline',
}

export function AuthorityBadge({ a }: { a: Authority }) {
  return <span className={`badge ${AUTH_CLASS[a]}`} title={AUTHORITY_INFO[a].aide}>{AUTHORITY_INFO[a].label}</span>
}
export function EventBadge({ t }: { t: EventType }) {
  return <span className={`badge ${EVENT_CLASS[t]}`} title={EVENT_INFO[t].aide}>{EVENT_INFO[t].label}</span>
}
export function StatutBadge({ s }: { s: SourceStatut }) {
  return <span className={`badge ${STATUT_CLASS[s]}`} title={STATUT_INFO[s].aide}>{STATUT_INFO[s].label}</span>
}
export function CondBadge({ statut }: { statut: string }) {
  const cls = statut === 'remplie' ? 'b-ok' : statut === 'en validation' ? 'b-warn' : 'b-bad'
  const label = statut === 'remplie' ? 'Remplie' : statut === 'en validation' ? 'En validation — non remplie' : 'Ouverte — non remplie'
  return <span className={`badge ${cls}`}>{label}</span>
}
export function RespBadge({ t }: { t: 'confirmé' | 'proposé' }) {
  return t === 'confirmé'
    ? <span className="badge b-ok" title="Responsable nommé dans le corpus">Responsable confirmé</span>
    : <span className="badge b-warn" title="Responsable proposé par l'équipe de reprise">Responsable proposé</span>
}
export function NatureBadge({ n }: { n: 'engagement' | 'recommandation' }) {
  return n === 'engagement'
    ? <span className="badge b-info" title="Engagement déjà documenté dans le corpus">Engagement documenté</span>
    : <span className="badge b-purple" title="Recommandation de l'équipe de reprise, non documentée comme engagement">Recommandation de l'équipe</span>
}
export function EcheanceBadge({ e }: { e: string }) {
  return e === 'à confirmer' ? <span className="badge b-warn">Échéance à confirmer</span> : <span className="badge b-neutral">Échéance {e}</span>
}
