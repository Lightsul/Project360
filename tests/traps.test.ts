import { describe, expect, it } from 'vitest'
import { BASELINE } from '../src/data/baseline'
import { SOURCES, SOURCE_BY_ID } from '../src/data/sources'
import { collectEvidence, independentSourceCount } from '../src/domain/verify'
import type { Evidence } from '../src/domain/types'

/** Une règle de lecture des consignes (README.txt / consignes.pdf) = un test. */
const refsOf = (x: unknown) => collectEvidence(x).map((e) => e.ref)
const q = (id: string) => BASELINE.questions.find((x) => x.id === id)!
const txt = (id: string) => [q(id).court, ...q(id).detail, q(id).nuance].join(' ')

describe('Règle 1 — répondre selon le 30 sept 2026 09 h, pas la date réelle', () => {
  it('aucun fait du baseline n’est postérieur au 30 sept', () => {
    expect(BASELINE.meta.date).toBe('2026-09-30T09:00:00-04:00')
    for (const e of BASELINE.timeline) expect(e.date.slice(0, 10) <= '2026-09-30', e.id).toBe(true)
    for (const d of BASELINE.decisions) expect(d.date <= '2026-09-30', d.id).toBe(true)
    for (const s of SOURCES) expect(s.date.slice(0, 10) <= '2026-09-30', s.id).toBe(true)
  })
})

describe('Règle 2 — une date de fichier récente ne prouve rien (autorité du contenu)', () => {
  it('le plan v3 (postérieur à la décision) et le registre du 29 sept sont contredits, pas crus', () => {
    expect(SOURCE_BY_ID.get('PLAN-V3')).toMatchObject({ statut: 'contredit', date: '2026-09-12' })
    expect(SOURCE_BY_ID.get('RISQUES')?.statut).toBe('contredit')
    expect(SOURCE_BY_ID.get('CHARTE')?.statut).toBe('perime')
  })
  it('Q01 dit 22 oct. (pas 15) ; Q02 signale que R-01 est périmé', () => {
    expect(q('Q01').court).toMatch(/22 octobre 2026/)
    expect(q('Q01').court).not.toMatch(/15 octobre 2026/)
    expect(q('Q02').nuance).toMatch(/R-01.*périmée/s)
  })
  it('le plan v3 n’est pas présenté comme preuve du responsable', () => {
    expect(txt('Q04')).toMatch(/anomalie du plan/)
    expect(refsOf(q('Q04')).some((r) => r.s === 'PLAN-V3')).toBe(false)
  })
})

describe('Règle 3 — une pièce jointe dupliquée n’est pas une confirmation indépendante', () => {
  it('les 5 pièces jointes identiques et la copie archivée sont détectées', () => {
    const dups = SOURCES.flatMap((s) => s.email?.attachments ?? []).filter((a) => a.duplicateOf)
    expect(dups.map((a) => a.duplicateOf).sort()).toEqual(['ARCHI-V1', 'ARCHI-V2', 'CR-04', 'INV-003', 'RAPPORT-21'])
    expect(SOURCE_BY_ID.get('ARCHIVE-17')).toMatchObject({ authority: 'copie', statut: 'copie' })
  })
  it('aucune preuve du baseline ne s’appuie sur la copie archivée', () => {
    expect(refsOf(BASELINE).some((r) => r.s === 'ARCHIVE-17')).toBe(false)
  })
  it('le compteur de sources indépendantes réunit une copie et son original', () => {
    const r = (s: string): Evidence => ({ s, l: 'x', q: 'y' })
    expect(independentSourceCount([r('E12'), r('ARCHIVE-17')], SOURCE_BY_ID)).toBe(1)
    expect(independentSourceCount([r('E12'), r('M05')], SOURCE_BY_ID)).toBe(2)
  })
  it('Q04 n’annonce pas « trois sources distinctes » pour trois documents du même auteur', () => {
    expect(q('Q04').court).not.toMatch(/trois sources distinctes/)
    expect(q('Q04').court).toMatch(/même auteur/)
  })
})

describe('Règle 4 — correction annoncée ≠ acceptée ; proposition ≠ décision', () => {
  const sec = BASELINE.timeline.filter((e) => e.topics.includes('securite'))
  it('SEC-210 : livraison et annonce du fournisseur ne sont jamais typées « validation »', () => {
    expect(sec.find((e) => e.id === 'T42')?.type).toBe('livraison')
    expect(sec.find((e) => e.id === 'T43')?.type).toBe('annonce')
    expect(sec.filter((e) => e.type === 'validation')).toEqual([])
    expect(BASELINE.timeline.filter((e) => e.topics.includes('runbook') && e.type === 'validation')).toEqual([])
  })
  it('« Tout devrait être conforme » (E04) est une annonce non validée', () => {
    expect(BASELINE.timeline.find((e) => e.id === 'T18')?.type).toBe('annonce')
  })
  it('le 22 oct. : proposition de Boréal (8 sept) puis décision du comité (10 sept), deux événements distincts', () => {
    const p = BASELINE.timeline.find((e) => e.id === 'T28')!
    const d = BASELINE.timeline.find((e) => e.id === 'T31')!
    expect([p.type, p.date]).toEqual(['proposition', '2026-09-08'])
    expect([d.type, d.date]).toEqual(['decision', '2026-09-10'])
    expect(BASELINE.decisions.find((x) => x.id === 'D5')?.propose_par).toMatch(/Boréal/)
    expect(q('Q03').court).toMatch(/proposition/i)
  })
  it('CR-04 n’est jamais présenté comme approuvé', () => {
    expect(q('Q05').court).toMatch(/CR-04 \(18 000 \$\) n'est pas autorisé/)
    expect(SOURCE_BY_ID.get('CR-04')?.authority).toBe('brouillon')
  })
  it('Q08 distingue livraison et validation', () => {
    expect(q('Q08').court).toMatch(/livré/)
    expect(q('Q08').court).toMatch(/acceptation sécurité n'est pas donnée/)
  })
})

describe('Règle 5 — une capture historique ne prouve pas qu’un défaut est ouvert', () => {
  const caption = (id: string) => SOURCE_BY_ID.get(id)!.image!.caption
  it('captures de tickets fermés = historiques ; captures de défauts ouverts = courantes', () => {
    for (const id of ['ACC-301.png', 'ACC-302.png', 'DATA-401.png', 'INT-101.png', 'PERF-501.png', 'SEC-210.png']) expect(caption(id).statut_preuve, id).toBe('historique')
    for (const id of ['ACC-303.png', 'OPS-601.png']) expect(caption(id).statut_preuve, id).toBe('courante')
  })
  it('chaque capture dit explicitement ce qu’elle ne prouve pas', () => {
    for (const s of SOURCES.filter((x) => x.format === 'image')) expect(s.image!.caption.ne_prouve_pas.length, s.id).toBeGreaterThan(20)
  })
  it('Q02 et Q09 s’appuient sur le ticket daté, pas sur la capture seule', () => {
    expect(refsOf(q('Q02')).some((r) => r.s === 'INT-101')).toBe(true)
    expect(refsOf(q('Q09')).some((r) => r.s === 'ACC-303')).toBe(true)
    expect(refsOf(q('Q09')).filter((r) => r.s === 'ACC-303.png').length).toBeLessThan(refsOf(q('Q09')).length)
  })
})

describe('Règle 6 — information manquante : le dire, n’inventer ni décision, ni échéance, ni approbation', () => {
  it('toute échéance est « à confirmer », sauf si la date figure dans une preuve citée', () => {
    for (const a of BASELINE.actions) {
      if (a.echeance === 'à confirmer') continue
      expect(a.refs.some((r) => r.q.includes(a.echeance)), a.id).toBe(true)
    }
  })
  it('les 8 incertitudes que le corpus ne tranche pas sont affichées', () => {
    const all = BASELINE.incertitudes.map((u) => u.sujet).join(' | ')
    for (const re of [/re-test SEC-210/i, /prochaine build/i, /go\/no-go/i, /jalon 3/i, /CR-04/, /Canada Central/, /décideur.*24 sept/i, /clause contractuelle/i]) expect(all).toMatch(re)
  })
  it('aucune condition ni décision n’est fermée sans preuve', () => {
    expect(BASELINE.conditions.every((c) => c.statut !== 'remplie')).toBe(true)
    for (const d of BASELINE.decisions) expect(d.refs.length, d.id).toBeGreaterThan(0)
  })
  it('Q07 admet l’absence de preuve technique directe', () => {
    expect(q('Q07').nuance).toMatch(/aucune preuve technique directe/i)
  })
  it('Q01 reconnaît qu’aucun go/no-go formel n’est daté', () => {
    expect(q('Q01').nuance).toMatch(/Aucune date de go\/no-go/)
  })
})

describe('Règle 7 — montants en CAD hors taxes, autorisé / facturé / payé séparés', () => {
  it('aucune taxe calculée, INV-778 exclue', () => {
    const all = JSON.stringify([BASELINE.questions, BASELINE.brief, BASELINE.finance])
    expect(all).not.toMatch(/TPS|TVQ|taxes? incluses?|taxes? en sus/i)
    const lignes = BASELINE.finance.factures.flatMap((i) => i.lignes)
    expect(lignes.some((l) => l.montant === 41000)).toBe(false)
  })
  it('Q05 présente les trois notions', () => {
    for (const w of ['autorisé', 'facturés', 'payés']) expect(q('Q05').court.toLowerCase()).toContain(w)
  })
})

describe('Règle 8 — sources anciennes, incomplètes ou peu utiles', () => {
  it('le bruit (formation Excel, infolettre, INV-778, notes perso) n’appuie aucun fait NOVA', () => {
    const core = [BASELINE.questions, BASELINE.conditions, BASELINE.actions, BASELINE.decisions, BASELINE.brief]
    const noise = new Set(['FORMATION-EXCEL', 'NEWSLETTER', 'INV-778', 'NOTES-PERSO'])
    expect(core.flatMap(refsOf).filter((r) => noise.has(r.s))).toEqual([])
    for (const id of noise) expect(SOURCE_BY_ID.get(id)?.authority === 'hors-projet' || SOURCE_BY_ID.get(id)?.authority === 'brouillon').toBe(true)
  })
  it('le bruit des transcriptions (salle 18B, café, HDMI) n’est pas retenu', () => {
    expect(JSON.stringify(BASELINE)).not.toMatch(/salle 18B|café|HDMI/i)
  })
})

describe('Critères d’évaluation des consignes', () => {
  it('Preuves : ≥ 3 réponses avec fichier et repère, dont ≥ 2 croisant des sources indépendantes', () => {
    const ok = BASELINE.questions.filter((x) => x.refs.every((r) => r.s && r.l && r.q))
    expect(ok.length).toBe(10)
    expect(BASELINE.questions.filter((x) => independentSourceCount(x.refs, SOURCE_BY_ID) >= 2).length).toBeGreaterThanOrEqual(2)
  })
  it('Chronologie : proposition, décision et validation datées et sourcées ; ≥ 2 contradictions dont plan et registre', () => {
    for (const t of ['proposition', 'decision', 'validation'] as const) {
      const evs = BASELINE.timeline.filter((e) => e.type === t)
      expect(evs.length).toBeGreaterThan(0)
      for (const e of evs) expect(e.date && e.refs.length > 0).toBeTruthy()
    }
    expect(BASELINE.contradictions.length).toBeGreaterThanOrEqual(2)
    const opp = (id: string) => BASELINE.contradictions.some((c) => c.oppose.some((o) => o.refs.some((r) => r.s === id)))
    expect(opp('PLAN-V3')).toBe(true)
    expect(opp('RISQUES')).toBe(true)
    for (const c of BASELINE.contradictions) expect(['autorité', 'date', 'autorité et date']).toContain(c.critere)
  })
  it('Brief : les thèmes demandés y sont (responsable, date et conditions, portée, budget, factures, priorités)', () => {
    expect(BASELINE.brief.map((b) => b.theme)).toEqual(['Responsable', 'Date et conditions', 'Portée', 'Budget', 'Factures', 'Priorités'])
  })
  it('Actions : chaque condition a des actions avec responsable (confirmé/proposé), preuve et échéance connue ou « à confirmer »', () => {
    for (const g of ['G1', 'G2', 'G3'] as const) {
      const acts = BASELINE.actions.filter((a) => a.cond === g)
      expect(acts.length).toBeGreaterThan(0)
      for (const a of acts) {
        expect(a.resp).toBeTruthy()
        expect(['confirmé', 'proposé']).toContain(a.resp_t)
        expect(a.refs.length).toBeGreaterThan(0)
        expect(a.echeance === 'à confirmer' || /^\d{4}-\d{2}-\d{2}$/.test(a.echeance)).toBe(true)
      }
    }
  })
  it('Recommandation ≠ engagement : toute action sans engagement documenté est marquée recommandation', () => {
    for (const a of BASELINE.actions.filter((x) => x.resp_t === 'proposé' && !x.cond)) expect(a.nature, a.id).toBe('recommandation')
  })
})
