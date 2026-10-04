import { Baseline } from '../domain/types'
import { deepFreeze } from '../domain/freeze'
import brief from './baseline/brief.json'
import questions from './baseline/questions.json'
import conditions from './baseline/conditions.json'
import actions from './baseline/actions.json'
import timeline from './baseline/timeline.json'
import decisions from './baseline/decisions.json'
import contradictions from './baseline/contradictions.json'
import incertitudes from './baseline/incertitudes.json'
import personnes from './baseline/personnes.json'
import finance from './baseline/finance.json'

/**
 * Baseline au 30 septembre 2026, 09:00 (Montréal, UTC−04:00).
 * Validé par zod au chargement puis gelé : toute mise à jour passe par applyUpdates(),
 * qui produit une copie et ne touche jamais cet objet.
 */
export const BASELINE: Readonly<Baseline> = deepFreeze(
  Baseline.parse({
    meta: { date: '2026-09-30T09:00:00-04:00', libelle: '30 septembre 2026, 09 h 00 (Montréal)', projet: 'NOVA — Loto-Québec, Défi 2 (Projet 360)' },
    brief,
    questions,
    conditions,
    actions,
    timeline,
    decisions,
    contradictions,
    incertitudes,
    personnes,
    finance,
  }),
)
