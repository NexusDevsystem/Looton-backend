import axios from 'axios'

let lastRate: number | null = null
let lastUpdated: number | null = null

export async function getBRLRate(base = 'BRL') {
  if (base === 'BRL') return 1
  const now = Date.now()
  if (lastRate && lastUpdated && now - lastUpdated < 12 * 60 * 60 * 1000) {
    return lastRate
  }
  const url = `https://api.exchangerate.host/latest?base=${base}&symbols=BRL`
  const { data } = await axios.get(url)
  const rate = data?.rates?.BRL ?? 1
  lastRate = rate
  lastUpdated = now
  return rate
}
// Removed unused toBRL helper; keep only getBRLRate which is used elsewhere.
