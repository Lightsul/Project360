import { describe, expect, it } from 'vitest'
import { BASELINE } from '../src/data/baseline'
import { SOURCES, SOURCE_BY_ID } from '../src/data/sources'
import { verifyCitations } from '../src/domain/verify'

const q = (id: string) => BASELINE.questions.find((x) => x.id === id)!
const all = (id: string) => { const x = q(id); return [x.court, ...x.detail, x.nuance].join(' ') }

describe('Baseline', () => {
  it('est gelé en profondeur (immuable)', () => {
    expect(Object.isFrozen(BASELINE)).toBe(true)
    expect(Object.isFrozen(BASELINE.questions[0].refs[0])).toBe(true)
    expect(() => { (BASELINE.questions[0] as { court: string }).court = 'x' }).toThrow()
    expect(() => { (BASELINE.conditions as unknown as unknown[]).push({}) }).toThrow()
  })

  it('cite uniquement des passages qui existent mot pour mot (verify-citations = 0 erreur)', () => {
    const { total, errors } = verifyCitations(BASELINE, SOURCE_BY_ID)
    expect(errors).toEqual([])
    expect(total).toBeGreaterThan(200)
  })

  it('couvre les 64 fichiers du corpus', () => {
    expect(SOURCES).toHaveLength(64)
    expect(SOURCE_BY_ID.get('ARCHIVE-17')?.email?.duplicateOf).toBe('E12')
    expect(SOURCE_BY_ID.get('E07')?.email?.attachments[0].duplicateOf).toBe('INV-003')
    expect(SOURCE_BY_ID.get('INV-778')?.authority).toBe('hors-projet')
    expect(SOURCES.filter((s) => s.format === 'image')).toHaveLength(8)
  })

  it('chaque réponse a au moins un repère, et au moins trois croisent des sources distinctes', () => {
    for (const x of BASELINE.questions) expect(x.refs.length).toBeGreaterThan(0)
    const crossed = BASELINE.questions.filter((x) => new Set(x.refs.map((r) => r.s)).size >= 2)
    expect(crossed.length).toBeGreaterThanOrEqual(3)
  })
})

describe('Réponses de référence (non-régression §6)', () => {
  it('Q01 : 22 octobre 2026, conditionnel ; le 15 oct du plan v3 est contredit', () => {
    expect(q('Q01').court).toMatch(/22 octobre 2026/)
    expect(q('Q01').court).toMatch(/conditionnelle/)
    expect(q('Q01').refs.some((r) => r.s === 'M04')).toBe(true)
    expect(q('Q01').refs.some((r) => r.s === 'M06' || r.s === 'E09')).toBe(true)
    expect(all('Q01')).toMatch(/plan v3/)
  })
  it('Q02 : INT-101, 401 / jeton expiré, fermé le 17 sept 16:10 (120/120), R-01 périmé', () => {
    expect(q('Q02').court).toMatch(/INT-101/)
    expect(q('Q02').court).toMatch(/401/)
    expect(q('Q02').court).toMatch(/17 septembre à 16:10/)
    expect(q('Q02').court).toMatch(/120 recherches sur 120/)
    expect(q('Q02').nuance).toMatch(/R-01/)
  })
  it('Q03 : proposé par Boréal / Julien Moreau le 8 sept (E05), approuvé par le comité le 10 sept (M04)', () => {
    expect(q('Q03').court).toMatch(/Julien Moreau/)
    expect(q('Q03').court).toMatch(/8 septembre/)
    expect(q('Q03').court).toMatch(/comité de direction le 10 septembre/)
  })
  it('Q04 : Nicolas Perron depuis le 16 sept, avant Élodie Caron', () => {
    expect(q('Q04').court).toMatch(/Nicolas Perron.*16 septembre 2026/)
    expect(q('Q04').court).toMatch(/Élodie Caron/)
  })
  it('Q05 : 204 000 = 180 000 + 24 000 ; facturé 186 000, payé 132 000 ; CR-04 non autorisé', () => {
    for (const m of ['204 000', '180 000', '24 000', '186 000', '132 000', '18 000']) expect(q('Q05').court).toContain(m)
    expect(q('Q05').court).toMatch(/CR-04 \(18 000 \$\) n'est pas autorisé/)
  })
  it('Q06 : INV-003 = 54 000 $, ligne CR-04 de 18 000 $ à refuser, 36 000 $ à confirmer', () => {
    expect(q('Q06').court).toMatch(/54 000 \$/)
    expect(q('Q06').court).toMatch(/18 000 \$/)
    expect(q('Q06').court).toMatch(/refuser/)
    expect(q('Q06').court).toMatch(/36 000 \$\) reste à confirmer/)
  })
  it('Q07 : Canada Central (ADR-007), déclaré le 26 août, vérifié le 27 août', () => {
    expect(q('Q07').court).toMatch(/Canada Central/)
    expect(q('Q07').court).toMatch(/26 août/)
    expect(q('Q07').court).toMatch(/vérifiée par l'équipe d'architecture/)
  })
  it('Q08 : Non — livré le 19 sept, en validation', () => {
    expect(q('Q08').court).toMatch(/^Non\./)
    expect(q('Q08').court).toMatch(/19 septembre/)
    expect(q('Q08').court).toMatch(/EN VALIDATION/)
  })
  it('Q09 : Non — ACC-303 ouvert (Enregistrer inatteignable)', () => {
    expect(q('Q09').court).toMatch(/^Non\./)
    expect(q('Q09').court).toMatch(/ACC-303 reste ouvert/)
    expect(q('Q09').court).toMatch(/Enregistrer/)
  })
  it('Q10 : trois conditions + étape 4 TODO et étape 5 À compléter', () => {
    expect(q('Q10').court).toMatch(/SEC-210/)
    expect(q('Q10').court).toMatch(/ACC-303/)
    expect(q('Q10').court).toMatch(/rollback/)
    expect(q('Q10').court).toMatch(/étape 4 « Procédure de retour arrière » est TODO/)
    expect(q('Q10').court).toMatch(/étape 5 « Validation fonctionnelle post-déploiement » est « À compléter »/)
  })
  it('INV-778 est hors projet (ORION) ; le rapport du 21 sept et E11 sont contredits', () => {
    expect(BASELINE.finance.horsProjet[0]).toMatchObject({ id: 'INV-778', projet: 'ORION' })
    expect(SOURCE_BY_ID.get('RAPPORT-21')?.statut).toBe('contredit')
    expect(SOURCE_BY_ID.get('E11')?.statut).toBe('contredit')
  })
})

describe('Finances (autorisé / facturé / payé séparés)', () => {
  const f = BASELINE.finance
  const sum = (xs: { montant: number }[]) => xs.reduce((a, b) => a + b.montant, 0)
  it('calcule 204 000 / 186 000 / 132 000 et isole CR-04', () => {
    expect(sum(f.autorise)).toBe(204000)
    expect(sum(f.factures.flatMap((i) => i.lignes))).toBe(186000)
    expect(sum(f.factures.filter((i) => i.statut === 'Payée').flatMap((i) => i.lignes))).toBe(132000)
    expect(f.factures.flatMap((i) => i.lignes).filter((l) => !l.approuve)).toEqual([expect.objectContaining({ montant: 18000 })])
  })
})

describe('Go-live, actions, chronologie', () => {
  it('aucune condition n’est remplie au baseline', () => {
    expect(BASELINE.conditions.map((c) => c.id)).toEqual(['G1', 'G2', 'G3'])
    expect(BASELINE.conditions.every((c) => c.statut !== 'remplie')).toBe(true)
  })
  it('chaque condition est reliée à au moins une action avec responsable et échéance', () => {
    for (const g of ['G1', 'G2', 'G3']) {
      const acts = BASELINE.actions.filter((a) => a.cond === g)
      expect(acts.length).toBeGreaterThan(0)
      for (const a of acts) {
        expect(a.resp).toBeTruthy()
        expect(a.echeance === 'à confirmer' || /^\d{4}-\d{2}-\d{2}$/.test(a.echeance)).toBe(true)
      }
    }
  })
  it('distingue engagements documentés et recommandations de l’équipe', () => {
    const natures = new Set(BASELINE.actions.map((a) => a.nature))
    expect(natures).toEqual(new Set(['engagement', 'recommandation']))
  })
  it('chronologie : ≥ 47 événements, tous les types présents', () => {
    expect(BASELINE.timeline.length).toBeGreaterThanOrEqual(47)
    expect(new Set(BASELINE.timeline.map((e) => e.type))).toEqual(new Set(['proposition', 'decision', 'livraison', 'validation', 'annonce', 'constat', 'document']))
  })
  it('contradictions : au moins une dans un plan et une dans le registre des risques', () => {
    const srcs = (c: (typeof BASELINE.contradictions)[number]) => c.oppose.flatMap((o) => o.refs.map((r) => r.s))
    expect(BASELINE.contradictions.some((c) => srcs(c).includes('PLAN-V3'))).toBe(true)
    expect(BASELINE.contradictions.some((c) => srcs(c).includes('RISQUES'))).toBe(true)
  })
})
