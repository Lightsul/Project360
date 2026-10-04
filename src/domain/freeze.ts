/** Gel profond : le baseline ne peut plus être modifié, même par erreur. */
export function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj)
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v)
  }
  return obj
}
