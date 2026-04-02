export type ValueOf<T> = T[keyof T]

export const createId = (prefix: string): string => {
  const fallback = Math.random().toString(36).slice(2, 10)
  const uuid =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : fallback

  return `${prefix}-${uuid}`
}

export const nowIso = (): string => new Date().toISOString()

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

