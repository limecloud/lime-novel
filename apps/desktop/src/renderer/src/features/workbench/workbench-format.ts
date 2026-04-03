export const formatCount = (value: number): string => new Intl.NumberFormat('zh-CN').format(value)

export const formatDateTime = (value: string): string => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('zh-CN', { hour12: false })
}

export const summarizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)

  if (segments.length <= 4) {
    return normalized
  }

  return `.../${segments.slice(-4).join('/')}`
}

export const formatSignedDelta = (value: number, unit = ''): string => {
  if (value === 0) {
    return `0${unit}`
  }

  return `${value > 0 ? '+' : ''}${value}${unit}`
}
