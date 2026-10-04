import { useEffect, useMemo, useRef } from 'react'
import type { Evidence, Source } from '../domain/types'
import { AUTHORITY_INFO, KIND_LABEL, frDate } from '../domain/authority'
import { cellRefs, findQuote } from '../domain/quote'
import { useAllSources, useApp } from '../store'
import { AuthorityBadge, StatutBadge } from './Badge'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Piège le focus dans un <dialog> modal (Tab / Maj+Tab bouclent) et restitue le focus à la fermeture. */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<Element | null>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      opener.current = document.activeElement
      d.showModal()
    } else if (!open && d.open) {
      d.close()
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus()
    }
  }, [open])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onCancel = (e: Event) => { e.preventDefault(); onClose() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = Array.from(d.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !d.contains(document.activeElement))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    const onClick = (e: MouseEvent) => { if (e.target === d) onClose() }
    d.addEventListener('cancel', onCancel)
    d.addEventListener('keydown', onKey)
    d.addEventListener('click', onClick)
    return () => { d.removeEventListener('cancel', onCancel); d.removeEventListener('keydown', onKey); d.removeEventListener('click', onClick) }
  }, [onClose])
  return ref
}

function download(src: Source) {
  const name = src.file.split('/').pop() || `${src.id}.txt`
  const blob = src.original
    ? new Blob([Uint8Array.from(atob(src.original.b64), (c) => c.charCodeAt(0))], { type: src.original.mime })
    : src.image
      ? new Blob([Uint8Array.from(atob(src.image.dataUri.split(',')[1]), (c) => c.charCodeAt(0))], { type: 'image/png' })
      : new Blob([src.text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function TextBody({ text, quote }: { text: string; quote?: string }) {
  const span = quote ? findQuote(text, quote) ?? (text.indexOf(quote) >= 0 ? { start: text.indexOf(quote), end: text.indexOf(quote) + quote.length } : null) : null
  if (!span) return <pre className="src-text">{text}</pre>
  return (
    <pre className="src-text">
      {text.slice(0, span.start)}
      <mark data-hit>{text.slice(span.start, span.end)}</mark>
      {text.slice(span.end)}
    </pre>
  )
}

function SheetBody({ src, evidence: ref, passage }: { src: Source; evidence?: Evidence; passage?: string }) {
  const wanted = ref ? cellRefs(ref.l.split('!').pop() ?? '') : []
  const passageRow = passage ? Number(/^Ligne (\d+)/.exec(passage)?.[1] ?? 0) : 0
  const isHit = (c: { ref: string; v: string }) => {
    if (passageRow) return Number(c.ref.replace(/^[A-Z]+/, '')) === passageRow
    if (!ref) return false
    if (wanted.length) return wanted.includes(c.ref) && (!!findQuote(c.v, ref.q) || wanted.length > 1)
    return !!findQuote(c.v, ref.q)
  }
  return (
    <>
      {src.sheets!.map((s) => (
        <div key={s.name} className="stack">
          <p className="small muted">Feuille « {s.name} » — plage {s.ref}</p>
          <div className="table-wrap">
            <table className="xls">
              <thead>
                <tr><th className="colh" scope="col"><span className="visually-hidden">Ligne</span></th>{s.rows[0].map((c) => <th key={c.ref} className="colh" scope="col">{c.ref.replace(/\d+/, '')}</th>)}</tr>
              </thead>
              <tbody>
                {s.rows.map((row, i) => (
                  <tr key={i}>
                    <th className="rowh" scope="row">{i + 1}</th>
                    {row.map((c) => <td key={c.ref} className={isHit(c) ? 'hit' : undefined} data-hit={isHit(c) || undefined} title={c.ref}>{c.v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}

function ImageBody({ src, quote }: { src: Source; quote?: string }) {
  const img = src.image!
  const hit = (t: string) => !!quote && (!!findQuote(t, quote) || t === quote)
  const boxes = img.caption.lignes.filter((l) => l.box && hit(l.t))
  return (
    <div className="stack">
      <div className="figure">
        <img src={img.dataUri} width={img.w} height={img.h} alt={`Capture ${src.id} : ${img.caption.entete}. Transcription ci-dessous.`} />
        {boxes.map((l, i) => {
          const [x, y, w, h] = l.box!
          return <span key={i} className="box" data-hit style={{ left: `${(x / img.w) * 100}%`, top: `${(y / img.h) * 100}%`, width: `${(w / img.w) * 100}%`, height: `${(h / img.h) * 100}%` }} aria-hidden="true" />
        })}
      </div>
      <h3>Transcription (relue)</h3>
      <ul className="caption-lines">
        <li className="muted">{img.caption.entete}</li>
        {img.caption.lignes.map((l, i) => <li key={i} className={hit(l.t) ? 'hit' : undefined}>{l.t}</li>)}
      </ul>
      <div className="callout ok"><strong>Ce que la capture prouve.</strong> {img.caption.prouve}</div>
      <div className="callout warn"><strong>Ce qu'elle ne prouve pas.</strong> {img.caption.ne_prouve_pas}</div>
    </div>
  )
}

export function SourceDrawer() {
  const target = useApp((s) => s.drawer)
  const close = useApp((s) => s.closeDrawer)
  const { byId } = useAllSources()
  const ref = useDialog(!!target, close)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const src = target ? byId.get(target.sourceId) : undefined
  const quote = target?.ref?.q ?? target?.passage

  // Après showModal() (effet déclaré plus haut) : focus sur « Fermer » et défilement jusqu'au passage cité.
  useEffect(() => {
    if (!target) return
    closeBtn.current?.focus()
    const id = requestAnimationFrame(() => {
      const hit = body.current?.querySelector('[data-hit]')
      if (hit) hit.scrollIntoView({ block: 'center' })
      else body.current?.scrollTo({ top: 0 })
    })
    return () => cancelAnimationFrame(id)
  }, [target])

  const proofStatus = useMemo(() => {
    if (!src) return ''
    if (src.image) return `${src.image.caption.statut_preuve} — ${src.image.caption.statut_note}`
    return ''
  }, [src])

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="drawer-title">
      {target && (
        <>
          <div className="drawer-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="id-tag">{src ? `${KIND_LABEL[src.kind]} · ${src.file}` : 'Source'}</div>
              <h2 id="drawer-title">{src ? `${src.id} — ${src.title}` : `Source introuvable : ${target.sourceId}`}</h2>
            </div>
            <button ref={closeBtn} type="button" className="btn small" onClick={close}>Fermer <kbd>Échap</kbd></button>
          </div>
          <div className="drawer-body" ref={body}>
            {src && (
              <>
                <div className="authority-banner" role="group" aria-label="Fiabilité de la source">
                  <span>Autorité : <AuthorityBadge a={src.authority} /></span>
                  <span>Date : <strong>{frDate(src.date)}</strong></span>
                  <span>Statut de la preuve : <StatutBadge s={src.statut} /></span>
                  {src.author && <span>Auteur : {src.author}</span>}
                </div>
                <p className="small"><strong>Usage :</strong> {src.usage} <span className="muted">({AUTHORITY_INFO[src.authority].aide})</span></p>
                {proofStatus && <p className="small"><strong>Statut de la capture :</strong> {proofStatus}</p>}
                {target.ref && (
                  <div className="callout info">
                    <strong>Repère cité :</strong> {target.ref.l} — <q>{target.ref.q.replace(/\*\*/g, '')}</q>
                  </div>
                )}
                {src.email?.attachments.length ? (
                  <div className="callout">
                    <strong>Pièces jointes</strong>
                    <ul>
                      {src.email.attachments.map((a) => (
                        <li key={a.filename}>
                          {a.filename} ({Math.round(a.size / 1024)} Ko){' '}
                          {a.duplicateOf && <span className="badge b-outline">identique (SHA-256) au fichier séparé {a.duplicateOf} — pas une confirmation indépendante</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {src.email?.duplicateOf && <div className="callout warn">Même Message-ID que <strong>{src.email.duplicateOf}</strong> : copie, pas une confirmation indépendante.</div>}
                {src.format === 'image' ? <ImageBody src={src} quote={quote} />
                  : src.format === 'xlsx' ? <SheetBody src={src} evidence={target.ref} passage={target.passage} />
                  : <TextBody text={src.text} quote={quote} />}
              </>
            )}
          </div>
          {src && (
            <div className="drawer-foot">
              <button type="button" className="btn" onClick={() => download(src)}>Télécharger l'original</button>
              <span className="small muted" style={{ alignSelf: 'center' }}>{src.size.toLocaleString('fr-CA')} octets{src.sha256 && ` · SHA-256 ${src.sha256.slice(0, 12)}…`}</span>
            </div>
          )}
        </>
      )}
    </dialog>
  )
}
