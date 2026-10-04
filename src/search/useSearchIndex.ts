import { useMemo } from 'react'
import { useAllSources, useViewState } from '../store'
import { SearchIndex, buildDocs } from './index'

/** Index local (MiniSearch) reconstruit quand l'état affiché ou les sources changent. */
export function useSearchIndex(): SearchIndex {
  const state = useViewState()
  const { list } = useAllSources()
  return useMemo(() => new SearchIndex(buildDocs(state, list)), [state, list])
}
