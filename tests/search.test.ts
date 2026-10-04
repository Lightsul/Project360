import { describe, expect, it } from 'vitest'
import { BASELINE } from '../src/data/baseline'
import { SOURCES } from '../src/data/sources'
import { applyUpdates } from '../src/domain/applyUpdates'
import { SearchIndex, buildDocs } from '../src/search/index'
import { fold, highlightTerms } from '../src/search/normalize'

const idx = new SearchIndex(buildDocs(applyUpdates(BASELINE, []), SOURCES))
const refs = (q: string) => idx.search(q).map((h) => h.doc.ref)

describe('Recherche', () => {
  it('« rollback » trouve la condition G3, le runbook et sa capture', () => {
    const r = refs('rollback')
    expect(r).toContain('G3')
    expect(r).toContain('OPS-601')
    expect(r).toContain('OPS-601.png')
  })
  it('« CR-04 » et « cr04 » trouvent INV-003 et la décision de portée', () => {
    for (const q of ['CR-04', 'cr04']) {
      const r = refs(q)
      expect(r).toContain('INV-003')
      expect(r).toContain('DECISION-PORTEE')
    }
  })
  it('« Canada Central » trouve Q07, ADR-007 et E03', () => {
    const r = refs('Canada Central')
    expect(r).toEqual(expect.arrayContaining(['Q07', 'ADR-007', 'E03']))
  })
  it('« Perron » trouve Q04 et E06', () => {
    expect(refs('Perron')).toEqual(expect.arrayContaining(['Q04', 'E06']))
  })
  it('ignore les accents dans les deux sens', () => {
    expect(refs('securite')).toContain('SEC-210')
    expect(refs('elodie caron')).toContain('Q04')
    expect(refs('accessibilité')).toEqual(expect.arrayContaining(refs('accessibilite').slice(0, 5)))
  })
  it('surligne sans tenir compte des accents', () => {
    expect(fold('Élodie')).toBe('elodie')
    expect(highlightTerms('Sécurité VERT', ['securite']).filter((s) => s.hit).map((s) => s.t)).toEqual(['Sécurité'])
  })
})
