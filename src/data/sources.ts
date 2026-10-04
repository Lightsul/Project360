import type { Source } from '../domain/types'
import raw from './sources.json'

export const SOURCES = raw as unknown as Source[]
export const SOURCE_BY_ID: ReadonlyMap<string, Source> = new Map(SOURCES.map((s) => [s.id, s]))
