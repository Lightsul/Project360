import { describe, expect, it } from 'vitest'
import { BASELINE } from '../src/data/baseline'
import { SOURCE_BY_ID } from '../src/data/sources'
import { applyUpdates, isClosing } from '../src/domain/applyUpdates'
import { Update, type UpdateInput } from '../src/domain/types'

const mk = (u: Partial<UpdateInput> & Pick<UpdateInput, 'id'>) =>
  Update.parse({
    date: '2026-10-01',
    titre: 'Test',
    source: { id: `NEW-${u.id}`, titre: 'Note', date: '2026-10-01', auteur: 'Sophie Lambert', autorite: 'suivi', texte: 'Le re-test SEC-210 est planifié le 2026-10-06.' },
    statut_probleme: 'SEC-210 toujours en validation',
    statut_proposition: 'constat',
    ...u,
  })

const RETEST = mk({
  id: 'MAJ-1',
  impacts: [
    { kind: 'action', id: 'A1', champ: 'echeance', avant: 'à confirmer', apres: '2026-10-06', note: 'date communiquée' },
    { kind: 'condition', id: 'G1', champ: 'etat', avant: '', apres: 'Re-test planifié le 6 oct ; toujours en validation.' },
  ],
  refs: [{ s: 'NEW-MAJ-1', l: 'texte', q: 'Le re-test SEC-210 est planifié le 2026-10-06.' }],
})

describe('applyUpdates', () => {
  it('ne modifie jamais le baseline (strictement identique avant/après)', () => {
    const before = JSON.stringify(BASELINE)
    const s = applyUpdates(BASELINE, [RETEST], SOURCE_BY_ID)
    expect(JSON.stringify(BASELINE)).toBe(before)
    expect(s.actions.find((a) => a.id === 'A1')!.echeance).toBe('2026-10-06')
    expect(BASELINE.actions.find((a) => a.id === 'A1')!.echeance).toBe('à confirmer')
    expect(Object.isFrozen(BASELINE)).toBe(true)
  })

  it('est pure : mêmes entrées → même résultat, nouvel objet', () => {
    const a = applyUpdates(BASELINE, [RETEST], SOURCE_BY_ID)
    const b = applyUpdates(BASELINE, [RETEST], SOURCE_BY_ID)
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(applyUpdates(BASELINE, [], SOURCE_BY_ID).questions).toEqual(BASELINE.questions)
  })

  it('« re-test SEC-210 planifié le X » ne ferme aucune condition', () => {
    const s = applyUpdates(BASELINE, [RETEST], SOURCE_BY_ID)
    expect(s.conditions.map((c) => c.statut)).toEqual(BASELINE.conditions.map((c) => c.statut))
    expect(s.conditions.find((c) => c.id === 'G2')).toEqual(BASELINE.conditions.find((c) => c.id === 'G2'))
    expect(s.conditions.find((c) => c.id === 'G3')).toEqual(BASELINE.conditions.find((c) => c.id === 'G3'))
    expect(s.conditions.find((c) => c.id === 'G1')!.modifs).toHaveLength(1)
  })

  it('refuse une fermeture sans preuve d’autorité (annonce fournisseur)', () => {
    const u = mk({
      id: 'MAJ-2',
      source: { id: 'NEW-2', titre: 'Courriel Boréal', date: '2026-10-02', auteur: 'Julien Moreau', autorite: 'fournisseur', texte: 'ACC-303 corrigé, c’est réglé pour nous.' },
      statut_proposition: 'annonce',
      impacts: [
        { kind: 'condition', id: 'G2', champ: 'statut', apres: 'remplie' },
        { kind: 'action', id: 'A4', champ: 'statut', apres: 'Fermé' },
        { kind: 'action', id: 'A3', champ: 'statut', apres: 'Livré (annoncé)' },
      ],
    })
    const s = applyUpdates(BASELINE, [u], SOURCE_BY_ID)
    expect(s.conditions.find((c) => c.id === 'G2')!.statut).toBe('ouverte')
    expect(s.actions.find((a) => a.id === 'A4')!.statut).toBe(BASELINE.actions.find((a) => a.id === 'A4')!.statut)
    expect(s.actions.find((a) => a.id === 'A3')!.statut).toBe('Livré (annoncé)')
    expect(s.journal.filter((j) => !j.ok)).toHaveLength(2)
  })

  it('accepte une fermeture appuyée par une validation, sans toucher les autres conditions', () => {
    const u = mk({
      id: 'MAJ-3',
      source: { id: 'NEW-3', titre: 'Ticket SEC-210', date: '2026-10-06', auteur: 'Sophie Lambert', autorite: 'validation', texte: 'Re-test OK. Acceptation sécurité donnée. Ticket fermé.' },
      statut_proposition: 'validation',
      impacts: [{ kind: 'condition', id: 'G1', champ: 'statut', apres: 'remplie' }],
    })
    const s = applyUpdates(BASELINE, [u], SOURCE_BY_ID)
    expect(s.conditions.map((c) => c.statut)).toEqual(['remplie', 'ouverte', 'ouverte'])
  })

  it('« en validation » n’est pas une fermeture', () => {
    expect(isClosing('en validation')).toBe(false)
    expect(isClosing('Non approuvé')).toBe(false)
    expect(isClosing('Validé')).toBe(true)
    expect(isClosing('remplie')).toBe(true)
  })

  it('ajoute nouvelles actions, source et événement daté ; signale une preuve introuvable', () => {
    const u = mk({
      id: 'MAJ-4',
      actions: [{ id: 'A15', cond: 'G1', titre: 'Suivre le re-test', resp: 'Nicolas Perron', resp_t: 'proposé', nature: 'recommandation', echeance: 'à confirmer', statut: 'À lancer', refs: [] }],
      refs: [{ s: 'M04', l: '15:25', q: 'citation inventée' }],
    })
    const s = applyUpdates(BASELINE, [u], SOURCE_BY_ID)
    expect(s.actions.at(-1)).toMatchObject({ id: 'A15', origine: 'MAJ-4' })
    expect(s.extraSources.map((x) => x.id)).toEqual(['NEW-MAJ-4'])
    expect(s.timeline.some((e) => e.origine === 'MAJ-4')).toBe(true)
    expect(s.journal.some((j) => !j.ok && j.message.includes('citation inventée'))).toBe(true)
  })
})
