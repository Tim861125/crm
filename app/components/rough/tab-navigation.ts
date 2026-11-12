export function nextTabIndex(currentIndex: number, key: string, count: number): number | null {
  if (count <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null

  const current = ((currentIndex % count) + count) % count
  const step = key === 'ArrowRight' ? 1 : -1
  return (current + step + count) % count
}
