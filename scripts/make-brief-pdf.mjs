// Génère livrable/BRIEF_NOVA.pdf (A4, 1 page) depuis le fichier autonome. Usage : npm run brief:pdf
import { chromium } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const src = path.resolve('livrable/NOVA_memoire_reprise.html')
const out = path.resolve('livrable/BRIEF_NOVA.pdf')
const browser = await chromium.launch()
const page = await browser.newPage({ locale: 'fr-CA' })
await page.goto(`${pathToFileURL(src).href}#/`)
await page.locator('main h1').waitFor()
await page.emulateMedia({ media: 'print' })
await page.pdf({ path: out, format: 'A4', preferCSSPageSize: true, printBackground: true })
await browser.close()
const pages = (fs.readFileSync(out).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
console.log(`${pages === 1 ? '✔' : '✗'} ${path.relative('.', out)} — ${pages} page(s), ${(fs.statSync(out).size / 1024).toFixed(0)} Ko`)
process.exit(pages === 1 ? 0 : 1)
