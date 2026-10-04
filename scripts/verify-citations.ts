/**
 * Garde-fou anti-hallucination : échoue si une citation du baseline
 * n'existe pas mot pour mot dans sa source.  Usage : npm run verify
 */
import { BASELINE } from '../src/data/baseline'
import { SOURCE_BY_ID } from '../src/data/sources'
import { verifyCitations } from '../src/domain/verify'

const { total, errors } = verifyCitations(BASELINE, SOURCE_BY_ID)
for (const e of errors) console.error(`✗ ${e.where}\n    [${e.ref.s} · ${e.ref.l}] « ${e.ref.q} » → ${e.reason}`)
console.log(`${errors.length ? '✗' : '✔'} ${total - errors.length}/${total} citations vérifiées mot pour mot`)
process.exit(errors.length ? 1 : 0)
