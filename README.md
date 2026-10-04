# NOVA · Mémoire de reprise

Mémoire opérationnelle du projet NOVA (Défi 24 h Projet 360, Loto-Québec, défi 2). Elle permet de comprendre l'état du projet en moins de 5 minutes, de retrouver n'importe quelle preuve et d'intégrer une nouvelle information sans réécrire le baseline.

**Baseline : 30 septembre 2026, 09 h 00 (Montréal, UTC−04:00).**

## Ouvrir (jury)

Double-cliquer sur **`livrable/NOVA_memoire_reprise.html`**.

- Un seul fichier d'environ 1,8 Mo, qui fonctionne hors ligne depuis `file://` : sans compte, sans abonnement, sans appel réseau.
- Les 64 fichiers du corpus sont embarqués : textes, cellules de tableur, PDF extraits, captures PNG avec leur transcription relue, et les originaux téléchargeables.
- L'IA est optionnelle. Tout fonctionne sans clé API.

## Ce que contient l'application

| Vue | Rôle |
|---|---|
| **Brief de reprise** | Une page imprimable en A4 : responsable, date et conditions, portée, budget (autorisé, facturé, payé), factures, priorités. |
| **Dix questions** | Réponse courte, nuance, réponse détaillée et repères `{fichier · localisation · citation exacte}`. |
| **Go-live & actions** | Les 3 conditions (G1 SEC-210, G2 ACC-303, G3 runbook et rollback), reliées aux actions avec responsable *confirmé/proposé*, échéance (date ou *à confirmer*) et nature (*engagement documenté/recommandation de l'équipe*). |
| **Chronologie** | 61 événements typés (proposition, décision, livraison, validation, annonce non validée, constat, document), filtrables par type, source, sujet et période. |
| **Décisions & contradictions** | 9 décisions (décideur, proposant, raison, statut) et 12 contradictions : ce qui s'oppose, ce qui tranche, et pourquoi (autorité ou date). |
| **Sources** | Les 64 fichiers, avec leur autorité et leur validité. Duplicatas détectés automatiquement (SHA-256 des pièces jointes, Message-ID). |
| **Demander à la mémoire** | Questions en langage naturel. Répond « Non documenté dans le corpus » quand aucune preuve n'existe. |
| **Mises à jour** | Intégration d'une nouvelle information et bascule **Baseline / État actuel**. |
| **Mode d'emploi & limites** | Navigation, outils, traitements manuels, 10 incertitudes, personnes. |

Recherche globale avec <kbd>Ctrl</kbd>+<kbd>K</kbd> ou <kbd>/</kbd>. Elle ignore les accents et la casse et connaît quelques synonymes (rollback = retour arrière). Chaque repère ouvre la source avec le passage surligné : la cellule pour un tableur, la zone encadrée pour une capture.

## Le jour de la nouvelle information

1. **Mises à jour** → coller le texte reçu, puis renseigner la date, l'auteur et **l'autorité de la source**.
2. **Pré-remplir** : en mode local, les identifiants cités (SEC-210, OPS-601…) sont détectés et les éléments liés proposés. Avec une clé Claude, un brouillon complet est proposé.
3. Compléter les champs : **statut du problème**, **décision antérieure touchée**, **nouvelle proposition et son statut**, **éléments inchangés**, **impacts** (avant → après), **nouvelles actions**, **preuves** (vérifiées mot pour mot en direct).
4. Consulter l'aperçu, puis **Accepter**. La vue *État actuel* montre les encadrés orange « Modifié par MAJ-n ». Le bouton *Baseline* affiche l'état initial, inchangé.
5. Exporter au besoin : JSON (baseline + MAJ) ou HTML autonome avec les MAJ embarquées.

Garde-fous codés dans `applyUpdates` (fonction pure, testée) :

- le baseline est gelé (`Object.freeze` profond) et n'est jamais modifié ;
- une fermeture, une validation ou une approbation est **refusée** si la source n'a pas l'autorité *validation* ou *décision*. Aucune approbation n'est inventée, et aucune autre condition n'est fermée par effet de bord ;
- les preuves citées par une MAJ doivent exister mot pour mot ;
- un contrôle de cohérence signale les éléments qui citent les mêmes tickets mais n'ont pas été cochés.

## Développement

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # Vitest : baseline gelé, faits Q01–Q10, montants, garde-fous, recherche, IA locale
npm run verify         # rejette toute citation introuvable mot pour mot (288 citations)
npm run build:single   # → dist-single/index.html et livrable/NOVA_memoire_reprise.html
npm run e2e            # Playwright sur le fichier file:// : axe-core, 390 px, focus, impression, MAJ
npm run check          # tout ce qui précède
npm run extract        # régénère src/data/sources.json depuis seed/NOVA_ETUDIANTS
```

### Architecture

```
seed/NOVA_ETUDIANTS/        corpus d'origine (64 fichiers)
seed/captions.json          transcriptions des 8 captures et zones à encadrer (relues)
scripts/source-meta.ts      classification des sources : autorité, validité, usage
scripts/extract-corpus.ts   .eml (mailparser), .pdf (pdfjs-dist), .xlsx (SheetJS), .png → sources.json
scripts/verify-citations.ts garde-fou anti-hallucination
src/data/baseline/*.json    questions, conditions, actions, chronologie, décisions, contradictions, brief, finances…
src/domain/                 types zod, applyUpdates (pur), quote (citation verbatim), authority, verify
src/search/                 index MiniSearch local, normalisation NFD sans accents, surlignage
src/ai/                     AIProvider · local.ts (règles) · anthropic.ts (optionnel)
src/features/               une vue par dossier
src/components/             SourceDrawer, SearchPalette, EvidenceChip, ModifBox, badges
```

Pile technique : Vite, React 19, TypeScript strict, React Router (hash, pour `file://`), Zustand (MAJ et brouillons persistés localement, avec repli si le stockage est indisponible), zod, MiniSearch, Vitest + Testing Library, Playwright + axe-core, vite-plugin-singlefile.

## Utilisation de l'IA

**Pour construire (Claude Code), toujours relu par l'équipe :**

- lecture des 64 fichiers et classification de l'autorité, de la validité et de l'usage (`scripts/source-meta.ts`) ;
- transcription des 8 captures par vision, avec ce qu'elles prouvent et ne prouvent pas (`seed/captions.json`) ;
- rédaction des réponses, décisions, contradictions, actions et chronologie avec citations verbatim, toutes validées par `verify-citations` ;
- génération des tests.

**Traitements manuels :** arbitrage des contradictions ; choix *confirmé/proposé* et *engagement/recommandation* ; priorités du brief ; relecture des transcriptions.

**Dans le produit, de façon optionnelle :** en choisissant « Claude » et en collant sa propre clé (gardée dans `sessionStorage`, jamais exportée), on obtient :

- *Demander à la mémoire* : seuls les passages récupérés par la recherche locale sont envoyés, et chaque repère renvoyé est revérifié mot pour mot (les repères invalides sont rejetés et signalés) ;
- *Pré-remplir une MAJ* : sortie JSON contrainte par schéma puis revalidée par zod. Le statut est ramené à « proposition » si l'autorité ne permet pas mieux. Rien n'est appliqué sans clic sur « Accepter ».

Modèle : `claude-opus-5-5` via le SDK officiel `@anthropic-ai/sdk`, avec le repli serveur `fallbacks: "default"` en cas de refus.

## Limites et incertitudes

Elles sont détaillées dans l'application (*Mode d'emploi & limites*) :

- dates inconnues : re-test SEC-210, prochaine build, runbook final et go/no-go ;
- critères du jalon 3 et réponse de Boréal sur CR-04 non documentés ;
- aucune preuve technique directe de Canada Central ;
- décideur de la décision de portée du 24 sept non nommé ;
- effet des CR approuvés sur le plafond contractuel non précisé : les 204 000 $ résultent de notre calcul.

Le mode « Demander » local reconnaît les questions types et, au-delà, renvoie les passages pertinents. Il ne raisonne pas.
