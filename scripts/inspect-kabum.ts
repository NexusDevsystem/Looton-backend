import { fetchRateLimited } from '../src/services/pc/http.js'

async function main() {
  const url = 'https://www.kabum.com.br/promocoes'
  const res = await fetchRateLimited(url)
  console.log('status:', res.status, res.headers.get('content-type'))
  const html = await res.text()
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
  console.log('has __NEXT_DATA__:', !!m)
  if (!m) return
  const json = m[1]
  console.log('json length:', json.length)
  try {
    const data = JSON.parse(json)
    const root: any = data.props?.pageProps ?? data
    const walk = (node: any, path: string) => {
      if (!node) return
      if (Array.isArray(node)) {
        if (node.length > 0 && node.length < 200 && typeof node[0] === 'object') {
          const keys = Object.keys(node[0] || {})
          const hasPrice = keys.some((k) => /preco|price|valor/i.test(k))
          const hasUrl = keys.some((k) => /url|link|slug|href/i.test(k))
          const hasTitle = keys.some((k) => /name|titulo|title/i.test(k))
          if (hasPrice && hasUrl && hasTitle) {
            console.log('PRODUCT ARRAY at', path, 'len', node.length, 'sample keys', keys.slice(0, 12))
          }
        }
        for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`)
        return
      }
      if (typeof node === 'object') {
        const keys = Object.keys(node)
        const hasPrice = keys.some((k) => /preco|price|valor/i.test(k))
        const hasUrl = keys.some((k) => /url|link|slug|href/i.test(k))
        const hasTitle = keys.some((k) => /name|titulo|title/i.test(k))
        if (hasPrice && hasUrl && hasTitle) {
          console.log('PRODUCT OBJ at', path, 'keys', keys.slice(0, 12))
        }
        for (const k of keys) walk((node as any)[k], `${path}.${k}`)
      }
    }
    walk(root, 'root')
  } catch (e: any) {
    console.log('JSON parse error:', e?.message)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
