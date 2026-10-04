/**
 * Extraction du corpus NOVA → src/data/sources.json
 *   .eml  → mailparser (en-têtes, corps, pièces jointes + SHA-256 pour détecter les duplicatas)
 *   .pdf  → pdfjs-dist (texte par page, reconstruit ligne par ligne)
 *   .xlsx → SheetJS (cellules avec leur référence A1)
 *   .png  → data-URI + transcription relue (seed/captions.json)
 *   .txt/.md/.csv → texte brut
 * Usage : npm run extract
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { simpleParser, type AddressObject } from 'mailparser'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import * as XLSX from 'xlsx'
import { SOURCE_META } from './source-meta'
import type { Caption, Sheet, Source } from '../src/domain/types'

const ROOT = path.resolve(import.meta.dirname, '..')
const CORPUS = path.join(ROOT, 'seed/NOVA_ETUDIANTS')
const OUT = path.join(ROOT, 'src/data/sources.json')
const captions: Record<string, Caption> = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed/captions.json'), 'utf8'))

const sha = (b: Buffer | Uint8Array) => crypto.createHash('sha256').update(b).digest('hex')
const addr = (a?: AddressObject | AddressObject[]) => (a ? (Array.isArray(a) ? a.map((x) => x.text).join(', ') : a.text) : '')

async function pdfPages(buf: Buffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    let out = ''
    let lastY: number | null = null
    for (const it of content.items) {
      if (!('str' in it)) continue
      const y = it.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n'
      else if (lastY !== null && out && !out.endsWith(' ') && it.str && !it.str.startsWith(' ')) out += ' '
      out += it.str
      lastY = y
    }
    pages.push(out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n+/g, '\n').trim())
  }
  return pages
}

function readSheets(buf: Buffer): Sheet[] {
  const wb = XLSX.read(buf, { type: 'buffer' })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    const rows = []
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = []
      for (let c = range.s.c; c <= range.e.c; c++) {
        const ref = XLSX.utils.encode_cell({ r, c })
        const cell = ws[ref]
        row.push({ ref, v: cell ? String(cell.w ?? cell.v ?? '') : '' })
      }
      rows.push(row)
    }
    return { name, ref: ws['!ref'] ?? '', rows }
  })
}

const sheetText = (sheets: Sheet[]) =>
  sheets
    .map((s) => {
      const header = s.rows[0]?.map((c) => c.v) ?? []
      return [`Feuille « ${s.name} »`, ...s.rows.map((row, i) => (i === 0 ? header.join(' | ') : `Ligne ${i + 1} — ` + row.map((c, j) => `${header[j]}: ${c.v}`).join(' · ')))].join('\n')
    })
    .join('\n\n')

async function main() {
  // Empreintes des fichiers séparés, pour reconnaître une pièce jointe identique.
  const byHash = new Map<string, string>()
  for (const m of SOURCE_META) byHash.set(sha(fs.readFileSync(path.join(CORPUS, m.file))), m.id)

  const messageIds = new Map<string, string>()
  const sources: Source[] = []

  for (const meta of SOURCE_META) {
    const abs = path.join(CORPUS, meta.file)
    const buf = fs.readFileSync(abs)
    const ext = path.extname(abs).toLowerCase()
    const { image: imageKey, ...rest } = meta
    const base = { ...rest, size: buf.length, sha256: sha(buf) }

    if (ext === '.eml') {
      const mail = await simpleParser(buf)
      const attachments = mail.attachments.map((a) => {
        const h = sha(a.content)
        return { filename: a.filename ?? 'sans-nom', size: a.size, sha256: h, duplicateOf: byHash.get(h) }
      })
      const messageId = mail.messageId ?? ''
      const rawDate = buf.toString('utf8').match(/^Date: (.*)$/m)?.[1]?.trim() ?? ''
      const dupOf = messageIds.get(messageId)
      if (!dupOf) messageIds.set(messageId, meta.id)
      const head = [
        `De : ${addr(mail.from)}`,
        `À : ${addr(mail.to)}`,
        mail.cc ? `Cc : ${addr(mail.cc)}` : '',
        `Date : ${rawDate}`,
        `Objet : ${mail.subject ?? ''}`,
        `Message-ID : ${messageId}`,
        ...attachments.map((a) => `Pièce jointe : ${a.filename}${a.duplicateOf ? ` (identique au fichier séparé ${a.duplicateOf})` : ''}`),
      ].filter(Boolean)
      sources.push({
        ...base,
        format: 'email',
        text: head.join('\n') + '\n\n' + (mail.text ?? '').trim(),
        email: {
          from: addr(mail.from), to: addr(mail.to), cc: mail.cc ? addr(mail.cc) : undefined,
          date: rawDate,
          subject: mail.subject ?? '', messageId, attachments, duplicateOf: dupOf,
        },
        original: { mime: 'message/rfc822', b64: buf.toString('base64') },
      })
    } else if (ext === '.pdf') {
      const pages = await pdfPages(buf)
      sources.push({ ...base, format: 'pdf', pages, text: pages.map((p, i) => (pages.length > 1 ? `[Page ${i + 1}]\n` : '') + p).join('\n\n'), original: { mime: 'application/pdf', b64: buf.toString('base64') } })
    } else if (ext === '.xlsx') {
      const sheets = readSheets(buf)
      sources.push({ ...base, format: 'xlsx', sheets, text: sheetText(sheets), original: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64: buf.toString('base64') } })
    } else if (ext === '.png') {
      const caption = imageKey ? captions[imageKey] : undefined
      if (!caption) throw new Error(`Transcription manquante pour ${meta.file}`)
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      sources.push({
        ...base,
        format: 'image',
        text: [caption.entete, ...caption.lignes.map((l) => l.t), `Ce que la capture prouve : ${caption.prouve}`, `Ce qu’elle ne prouve pas : ${caption.ne_prouve_pas}`].join('\n'),
        image: { dataUri: `data:image/png;base64,${buf.toString('base64')}`, w, h, caption },
      })
    } else {
      sources.push({ ...base, format: 'text', text: buf.toString('utf8').replace(/\r\n/g, '\n').trimEnd() })
    }
  }

  const files = fs.readdirSync(CORPUS, { recursive: true, withFileTypes: true }).filter((d) => d.isFile() && d.name !== '.DS_Store')
  if (files.length !== SOURCE_META.length) throw new Error(`Corpus : ${files.length} fichiers, ${SOURCE_META.length} classés`)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(sources))
  const dups = sources.flatMap((s) => (s.email?.attachments ?? []).filter((a) => a.duplicateOf).map((a) => `${s.id} › ${a.filename} = ${a.duplicateOf}`))
  console.log(`✔ ${sources.length} sources → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko)`)
  console.log(`  Pièces jointes identiques à un fichier séparé : ${dups.join(' ; ')}`)
  console.log(`  Courriels en double (Message-ID) : ${sources.filter((s) => s.email?.duplicateOf).map((s) => `${s.id} = ${s.email!.duplicateOf}`).join(' ; ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
