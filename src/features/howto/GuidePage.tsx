import { Link } from 'react-router-dom'
import { AiSettings } from '../../components/AiSettings'
import { AuthorityBadge, EventBadge } from '../../components/Badge'
import { EvidenceChips } from '../../components/Evidence'
import { useFocusParam } from '../../components/useFocusParam'
import { AUTHORITY_INFO, EVENT_INFO } from '../../domain/authority'
import { AUTHORITIES, EVENT_TYPES } from '../../domain/types'
import { useApp, useViewState } from '../../store'

export function GuidePage() {
  const s = useViewState()
  const setSearchOpen = useApp((x) => x.setSearchOpen)
  useFocusParam()
  return (
    <article aria-labelledby="g-title" className="stack">
      <div className="page-head">
        <div>
          <h1 id="g-title">Mode d'emploi et limites</h1>
          <p>Comment ouvrir, naviguer et vérifier. Quels outils ont servi, ce qui a été fait à la main, et ce qui reste incertain.</p>
        </div>
      </div>

      <section className="card" aria-labelledby="g-open">
        <h2 id="g-open">1. Ouvrir</h2>
        <ul>
          <li><strong>Version jury :</strong> ouvrez <code>NOVA_memoire_reprise.html</code> (ou <code>dist-single/index.html</code>) par double-clic. Un seul fichier, hors ligne, sans compte ni abonnement ni appel réseau : les 64 sources (texte, cellules, captures en images embarquées) y sont incluses.</li>
          <li><strong>Développement :</strong> <code>npm install</code> puis <code>npm run dev</code>. Tests : <code>npm test</code> ; vérification des citations : <code>npm run verify</code>.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="g-nav">
        <h2 id="g-nav">2. Naviguer (en moins de 5 minutes)</h2>
        <ol>
          <li><Link to="/">Brief de reprise</Link> : l'essentiel sur une page, imprimable.</li>
          <li><Link to="/questions">Dix questions</Link> : réponse courte, nuance, puis preuves.</li>
          <li><Link to="/go-live">Go-live & actions</Link> : les 3 conditions, avec leurs actions, responsables et échéances.</li>
          <li><Link to="/chronologie">Chronologie</Link>, <Link to="/decisions">Décisions & contradictions</Link>, <Link to="/sources">Sources</Link>.</li>
        </ol>
        <p><strong>Retrouver une preuve :</strong> chaque repère (par ex. « M04 · 15:22 ») ouvre la source avec le passage <mark>surligné</mark>. Pour un tableur, c'est la cellule ; pour une capture, la zone encadrée et la ligne de transcription. Le bandeau indique l'autorité, la date et la validité de la source.</p>
        <p><strong>Rechercher :</strong> <button type="button" className="btn small" onClick={() => setSearchOpen(true)}>Ouvrir la recherche</button> ou <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>/</kbd> aussi). La recherche ignore accents et casse, et connaît quelques synonymes (rollback = retour arrière, go-live = mise en production).</p>
        <p><strong>Nouvelle information :</strong> <Link to="/mises-a-jour">Mises à jour</Link> → coller le texte → pré-remplir → vérifier les impacts → « Accepter ». La bascule <strong>Baseline / État actuel</strong> en haut compare les deux versions ; les éléments modifiés portent un encadré orange « modifié par MAJ-n » (avant → après).</p>
        <p><strong>Clavier :</strong> tout est accessible au clavier. <kbd>Tab</kbd> pour avancer, <kbd>Échap</kbd> pour fermer un panneau ; le focus reste dans le panneau ouvert, puis revient à l'élément d'origine.</p>
      </section>

      <section className="card" aria-labelledby="g-legend">
        <h2 id="g-legend">3. Légende</h2>
        <h3>Autorité des sources</h3>
        <ul className="ev-list">{AUTHORITIES.map((a) => <li key={a}><AuthorityBadge a={a} /><span className="small">{AUTHORITY_INFO[a].aide}</span></li>)}</ul>
        <h3 style={{ marginTop: '.8rem' }}>Types d'événement</h3>
        <ul className="ev-list">{EVENT_TYPES.map((t) => <li key={t}><EventBadge t={t} /><span className="small">{EVENT_INFO[t].aide}</span></li>)}</ul>
        <p className="small" style={{ marginTop: '.6rem' }}>Règles appliquées : une date de fichier récente ne prouve rien ; une pièce jointe identique à un fichier séparé n'est pas une confirmation indépendante (détecté par SHA-256) ; une capture historique ne prouve pas qu'un défaut est encore ouvert ; montants en CAD hors taxes, autorisé, facturé et payé séparés.</p>
      </section>

      <section className="card" aria-labelledby="g-tools">
        <h2 id="g-tools">4. Outils utilisés et traitements manuels</h2>
        <div className="grid-2">
          <div>
            <h3>Automatisé (scripts)</h3>
            <ul className="small">
              <li><code>scripts/extract-corpus.ts</code> : courriels (mailparser, avec pièces jointes et SHA-256), PDF (pdfjs-dist), tableurs (SheetJS, cellules A1), CSV/TXT/MD, PNG (data-URI).</li>
              <li><code>scripts/verify-citations.ts</code> : rejette toute citation introuvable mot pour mot dans sa source (cellule exacte pour les tableurs).</li>
              <li>Recherche locale MiniSearch (index en mémoire, sans serveur). React + TypeScript + Vite, empaqueté en un seul fichier (vite-plugin-singlefile).</li>
              <li>Tests Vitest : baseline gelé, faits de référence Q01–Q10, montants, garde-fous des MAJ, recherche. Playwright + axe-core : accessibilité, mobile 390 px, piège de focus.</li>
            </ul>
          </div>
          <div>
            <h3>Assisté par IA, puis relu par l'équipe</h3>
            <ul className="small">
              <li>Claude (Claude Code) a lu les 64 fichiers et proposé l'autorité, la validité et l'usage de chaque source (<code>scripts/source-meta.ts</code>).</li>
              <li>Transcription des 8 captures par vision, avec les zones à encadrer (<code>seed/captions.json</code>), relue contre chaque image.</li>
              <li>Rédaction des réponses, décisions, contradictions, actions et chronologie, avec citations verbatim validées par <code>verify-citations</code>.</li>
              <li><strong>Manuel :</strong> arbitrage des contradictions, choix « confirmé / proposé » et « engagement / recommandation », priorités du brief.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="card" id="limites" tabIndex={-1} aria-labelledby="g-lim">
        <h2 id="g-lim">5. Limites et informations incertaines ({s.incertitudes.length})</h2>
        <p className="small muted">Quand l'information manque, l'application l'indique au lieu de l'inventer. Les échéances absentes sont « à confirmer ».</p>
        <div className="table-wrap table-cards">
          <table>
            <thead><tr><th scope="col">Sujet</th><th scope="col">Ce qu'on sait / ne sait pas</th><th scope="col">Impact</th><th scope="col">Preuve</th></tr></thead>
            <tbody>
              {s.incertitudes.map((u) => (
                <tr key={u.id} id={u.id} tabIndex={-1}>
                  <td data-label="Sujet"><strong>{u.sujet}</strong></td>
                  <td data-label="Constat">{u.texte}</td>
                  <td data-label="Impact" className="small">{u.impact}</td>
                  <td data-label="Preuve"><EvidenceChips refs={u.refs} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 style={{ marginTop: '.8rem' }}>Limites de l'outil</h3>
        <ul className="small">
          <li>La mémoire est figée au baseline (30 sept 2026, 09:00). Les mises à jour sont enregistrées dans ce navigateur : exportez-les (JSON ou HTML) pour les transmettre.</li>
          <li>Le mode « Demander » local reconnaît les questions types et repère les passages par mots-clés. Il ne raisonne pas : pour une question hors gabarit, il renvoie les passages pertinents sans rédiger de réponse.</li>
          <li>Le mode Claude, optionnel, exige la clé de l'utilisateur et une connexion. Ses repères sont revérifiés mot pour mot ; ceux qui échouent sont rejetés et signalés.</li>
          <li>Les rôles de certaines personnes sont déduits de leurs interventions (signalé dans « Personnes »).</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="g-people">
        <h2 id="g-people">6. Personnes</h2>
        <div className="table-wrap table-cards">
          <table>
            <thead><tr><th scope="col">Nom</th><th scope="col">Rôle</th><th scope="col">Preuve</th></tr></thead>
            <tbody>{s.personnes.map((p) => <tr key={p.nom}><td data-label="Nom"><strong>{p.nom}</strong></td><td data-label="Rôle">{p.role}{p.note && <div className="small muted">{p.note}</div>}</td><td data-label="Preuve"><EvidenceChips refs={p.refs} /></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <AiSettings />
    </article>
  )
}
