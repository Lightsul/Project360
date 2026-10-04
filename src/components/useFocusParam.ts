import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/** `?focus=Q01` : fait défiler jusqu'à l'élément, lui donne le focus et le met en évidence. */
export function useFocusParam(ready = true) {
  const [params] = useSearchParams()
  const id = params.get('focus')
  useEffect(() => {
    if (!id || !ready) return
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
  }, [id, ready])
  return id
}
