import { env } from '../../env.js'

const hostBuckets = new Map<string, number>()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// naive token bucket per host: allow ~1 req/s, burst 1
export async function fetchRateLimited(url: string, init: RequestInit = {}) {
  const u = new URL(url)
  const host = u.host
  const now = Date.now()
  const next = hostBuckets.get(host) || 0
  if (now < next) await sleep(next - now)
  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Dest': 'document',
    'Sec-Ch-Ua': '"Chromium";v="124", "Not.A/Brand";v="24", "Google Chrome";v="124"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Referer': `${u.protocol}//${u.host}/`
  }
  // Optional site-specific cookies from env to help pass anti-bot challenges (if provided)
  if (host.includes('pichau.com.br') && env.PCH_COOKIE) defaultHeaders['Cookie'] = env.PCH_COOKIE
  else if (host.includes('terabyteshop.com.br') && env.TBT_COOKIE) defaultHeaders['Cookie'] = env.TBT_COOKIE
  else if (host.includes('kabum.com.br') && env.KABUM_COOKIE) defaultHeaders['Cookie'] = env.KABUM_COOKIE
  const headers = { ...defaultHeaders, ...(init.headers as any) }
  const res = await fetch(url, { ...init, headers } as any)
  // schedule next allowed time ~ 800-1200ms to keep 1-2 rps
  hostBuckets.set(host, Date.now() + 900)
  return res
}
