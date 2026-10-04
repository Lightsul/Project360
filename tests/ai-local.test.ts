import { describe, expect, it } from 'vitest'
import { BASELINE } from '../src/data/baseline'
import { SOURCES, SOURCE_BY_ID } from '../src/data/sources'
import { applyUpdates } from '../src/domain/applyUpdates'
import { Update } from '../src/domain/types'
import { localProvider } from '../src/ai/local'
import { checkConsistency } from '../src/ai/provider'
import { SearchIndex, buildDocs } from '../src/search/index'

const state = applyUpdates(BASELINE, [], SOURCE_BY_ID)
const ctx = { state, index: new SearchIndex(buildDocs(state, SOURCES)), sources: SOURCE_BY_ID }

describe('IA locale (déterministe, sans réseau)', () => {
  it('répond aux questions types des consignes avec des repères', async () => {
    const cases: [string, RegExp][] = [
      ['Quelle est la date de livraison actuellement prévue et pourquoi?', /22 octobre 2026/],
      ['Quels sont les trois principaux risques du projet aujourd’hui?', /Runbook/],
      ['Existe-t-il des informations contradictoires?', /contradictions/],
      ['Quels engagements ne sont toujours pas complétés?', /engagements documentés/],
      ["Qu'est-ce qui a changé depuis la semaine dernière?", /Ce qui a changé/],
      ['Qui est responsable du projet?', /Nicolas Perron/],
    ]
    for (const [q, re] of cases) {
      const a = await localProvider.ask(q, ctx)
      expect(a.titre + a.paragraphs.map((p) => p.text).join(' '), q).toMatch(re)
      expect(a.paragraphs.some((p) => p.refs.length > 0), q).toBe(true)
    }
  })

  it('« Non documenté » quand rien ne correspond', async () => {
    const a = await localProvider.ask('xylophone quantique zébré', ctx)
    expect(a.nonDocumente).toBe(true)
  })

  it('un brouillon ne peut pas s’attribuer une validation sans autorité', async () => {
    const r = await localProvider.draftUpdate({ texte: 'Boréal : ACC-303 est validé et fermé de notre côté.', titre: 'Courriel Boréal', date: '2026-10-02', auteur: 'Julien Moreau', autorite: 'fournisseur' }, ctx, 'MAJ-1')
    expect(r.draft.statut_proposition).toBe('proposition')
    expect(r.draft.impacts?.some((i) => i.kind === 'condition' && i.id === 'G2')).toBe(true)
    expect(r.draft.impacts?.every((i) => i.apres !== 'remplie')).toBe(true)
  })

  it('le contrôle de cohérence signale les éléments liés non cochés', () => {
    const u = Update.parse({ id: 'MAJ-1', date: '2026-10-01', titre: 'Runbook', statut_probleme: 'OPS-601 reçu', statut_proposition: 'livraison',
      source: { id: 'S', titre: 'x', date: '2026-10-01', autorite: 'fournisseur', texte: 'Runbook OPS-601 livré avec rollback.' },
      impacts: [{ kind: 'condition', id: 'G3', champ: 'etat', apres: 'Runbook livré, approbation en attente' }] })
    const s = checkConsistency(u, state).map((x) => `${x.kind}:${x.id}`)
    expect(s).not.toContain('condition:G3')
    expect(s).toEqual(expect.arrayContaining(['action:A5', 'question:Q10']))
  })
})
