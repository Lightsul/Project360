import { useId, useState } from 'react'
import { MODEL, getKey, setKey } from '../ai/anthropic'
import { useApp } from '../store'

/** Choix du fournisseur d'IA. Par défaut : local (aucun réseau). La clé reste dans sessionStorage. */
export function AiSettings() {
  const aiMode = useApp((s) => s.aiMode)
  const setAiMode = useApp((s) => s.setAiMode)
  const [key, setK] = useState(getKey())
  const [saved, setSaved] = useState(!!getKey())
  const id = useId()
  return (
    <fieldset>
      <legend>Assistant IA (optionnel)</legend>
      <div className="row">
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="radio" name={`${id}-m`} checked={aiMode === 'local'} onChange={() => setAiMode('local')} /> Local, déterministe, hors ligne (par défaut)
        </label>
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="radio" name={`${id}-m`} checked={aiMode === 'anthropic'} onChange={() => setAiMode('anthropic')} /> Claude ({MODEL}) avec votre clé
        </label>
      </div>
      {aiMode === 'anthropic' && (
        <div className="field" style={{ marginTop: '.5rem' }}>
          <label htmlFor={`${id}-k`}>Clé API Anthropic</label>
          <div className="row">
            <input id={`${id}-k`} type="password" autoComplete="off" value={key} onChange={(e) => { setK(e.target.value); setSaved(false) }} style={{ flex: '1 1 240px' }} aria-describedby={`${id}-h`} />
            <button type="button" className="btn small" onClick={() => { setKey(key.trim()); setSaved(!!key.trim()) }}>Enregistrer pour la session</button>
            <button type="button" className="btn small" onClick={() => { setKey(''); setK(''); setSaved(false) }}>Effacer</button>
          </div>
          <span id={`${id}-h`} className="hint">
            Stockée uniquement dans le sessionStorage de cet onglet, jamais embarquée dans l'export. Seuls les passages récupérés par la recherche sont envoyés. {saved ? 'Clé active.' : 'Aucune clé active : le mode local sera utilisé.'}
          </span>
        </div>
      )}
    </fieldset>
  )
}
