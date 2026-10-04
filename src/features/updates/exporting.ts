import { BASELINE } from '../../data/baseline'
import { Update } from '../../domain/types'
import { z } from 'zod'

function save(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** JSON complet : baseline (intact) + mises à jour. */
export function exportJson(updates: Update[]) {
  const data = { format: 'nova-memoire/1', exporteLe: new Date().toISOString(), baseline: BASELINE, updates }
  save(`nova-memoire-${updates.length ? updates.at(-1)!.id : 'baseline'}.json`, JSON.stringify(data, null, 2), 'application/json')
}

/** Importe un JSON exporté (ou un tableau de MAJ). Le baseline du fichier est ignoré : seul le baseline embarqué fait foi. */
export async function importJson(file: File): Promise<Update[]> {
  const raw = JSON.parse(await file.text())
  const list = Array.isArray(raw) ? raw : raw.updates
  return z.array(Update).parse(list)
}

/** Vrai quand la page est la version autonome (script embarqué) : l'export HTML est alors possible. */
export const isStandalone = () => Array.from(document.scripts).some((s) => !s.src && s.textContent && s.textContent.length > 100_000)

export const EMBED_ID = 'nova-embedded-updates'

/** Copie autonome de la page, avec les mises à jour embarquées (rechargées à l'ouverture si le navigateur n'en a pas). */
export function exportHtml(updates: Update[]) {
  const root = document.documentElement.cloneNode(true) as HTMLElement
  root.removeAttribute('data-theme')
  root.querySelector('#root')!.innerHTML = ''
  root.querySelectorAll(`#${EMBED_ID}`).forEach((n) => n.remove())
  root.querySelectorAll('dialog').forEach((n) => n.remove())
  const tag = document.createElement('script')
  tag.type = 'application/json'
  tag.id = EMBED_ID
  tag.textContent = JSON.stringify(updates).replace(/</g, '\\u003c')
  root.querySelector('body')!.prepend(tag)
  save(`NOVA_memoire_reprise${updates.length ? `_${updates.at(-1)!.id}` : ''}.html`, '<!doctype html>\n' + root.outerHTML, 'text/html')
}

export function readEmbeddedUpdates(): Update[] {
  const el = document.getElementById(EMBED_ID)
  if (!el?.textContent) return []
  const r = z.array(Update).safeParse(JSON.parse(el.textContent))
  return r.success ? r.data : []
}
