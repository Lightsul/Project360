import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const FILE = pathToFileURL(path.resolve('dist-single/index.html')).href
const ROUTES = ['/', '/questions', '/go-live', '/chronologie', '/decisions', '/sources', '/mises-a-jour', '/demander', '/guide']

async function open(page: Page, route = '/') {
  await page.goto(`${FILE}#${route}`)
  await expect(page.locator('main h1')).toBeVisible()
}

test('s’ouvre hors ligne depuis file:// sans aucun appel réseau ni erreur', async ({ page }) => {
  const external: string[] = []
  const errors: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()) })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  for (const r of ROUTES) await open(page, r)
  expect(external).toEqual([])
  expect(errors).toEqual([])
  expect(fs.statSync('dist-single/index.html').size).toBeLessThan(15 * 1024 * 1024)
})

for (const route of ROUTES) {
  test(`axe : aucune violation sérieuse/critique sur ${route}`, async ({ page }) => {
    await open(page, route)
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
  })
}

test('axe en thème sombre (accueil, questions)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  for (const r of ['/', '/questions', '/decisions']) {
    await open(page, r)
    const res = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze()
    expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  }
})

test('mobile 390 px : aucun défilement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  for (const r of ROUTES) {
    await open(page, r)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over, r).toBeLessThanOrEqual(0)
  }
})

test('un repère ouvre la source, surligne la citation, piège le focus et le rend', async ({ page }) => {
  await open(page, '/questions')
  const chip = page.locator('#Q10 .ev-chip', { hasText: 'OPS-601.png' }).first()
  await chip.focus()
  await page.keyboard.press('Enter')
  const dialog = page.locator('dialog.drawer')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('h2')).toContainText('OPS-601.png')
  await expect(dialog.locator('.caption-lines li.hit')).toContainText('4. Procédure de retour arrière — TODO')
  await expect(dialog.locator('.figure .box')).toHaveCount(1)
  await expect(dialog).toContainText('Autorité')
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog.drawer'))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog.drawer'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(chip).toBeFocused()
})

test('repère sur une cellule de tableur et sur un passage de transcript', async ({ page }) => {
  await open(page, '/questions')
  await page.locator('#Q01 .ev-chip', { hasText: 'PLAN-V3' }).first().click()
  await expect(page.locator('dialog.drawer td.hit')).toHaveText('2026-10-15')
  await expect(page.locator('dialog.drawer td.hit')).toHaveAttribute('title', 'F7')
  await page.keyboard.press('Escape')
  await page.locator('#Q01 .ev-chip', { hasText: 'M04' }).first().click()
  await expect(page.locator('dialog.drawer mark')).toContainText('22 octobre 2026')
})

test('recherche Ctrl+K : rollback, CR-04, Canada Central, Perron (accents ignorés)', async ({ page }) => {
  await open(page, '/')
  for (const [q, expected] of [['rollback', 'G3'], ['CR-04', 'INV-003'], ['canada central', 'ADR-007'], ['Perron', 'Q04'], ['securite', 'SEC-210']]) {
    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox', { name: /Rechercher/ })
    await expect(input).toBeFocused()
    await input.fill(q)
    await expect(page.getByRole('option').filter({ hasText: expected }).first()).toBeVisible()
    await page.keyboard.press('Escape')
  }
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: /Rechercher/ }).fill('rollback')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/(questions|go-live)\?focus=(Q\d\d|G3)/)
  await expect(page.locator("main [id^=Q].flash, main [id^=G].flash")).toHaveCount(1)
})

test('le brief tient sur une page A4', async ({ page }) => {
  await open(page, '/')
  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: false })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(pages).toBe(1)
})

test('mise à jour : baseline intact, aucune autre condition fermée, encadré « modifié par »', async ({ page }) => {
  await open(page, '/mises-a-jour')
  await page.getByRole('button', { name: 'Charger un exemple de test (fictif)' }).click()
  await page.getByRole('button', { name: /Pré-remplir le brouillon/ }).click()
  await page.getByLabel('Statut du problème').fill('SEC-210 toujours EN VALIDATION ; re-test planifié le 6 octobre.')
  // Tentative de fermer G2 avec une source de suivi : doit être refusée par les garde-fous.
  await page.getByRole('button', { name: '+ Ajouter un impact' }).click()
  const last = page.locator('fieldset').filter({ hasText: 'Informations précédentes affectées' }).locator('.card').last()
  await last.getByLabel('Type').selectOption('condition')
  await last.getByLabel('Élément').selectOption('G2')
  await last.getByLabel('Champ').selectOption('statut')
  await last.getByLabel('Nouvelle valeur').fill('remplie')
  await expect(last.getByRole('alert')).toContainText('Refusé')
  await page.getByRole('button', { name: /Accepter et ajouter MAJ-1/ }).click()
  await expect(page.locator('#MAJ-1')).toContainText('Refusé par les garde-fous')

  await page.goto(`${FILE}#/go-live`)
  await expect(page.locator('#G2')).toContainText('Ouverte — non remplie')
  await expect(page.locator('#G3')).toContainText('Ouverte — non remplie')
  await expect(page.locator('#G1 > .modif')).toContainText('Modifié par MAJ-1')
  await page.getByRole('button', { name: 'Baseline', exact: true }).click()
  await expect(page.locator('#G1 .modif')).toHaveCount(0)
  await expect(page.locator('#G1')).toContainText('re-test planifié le 26 sept')
})
