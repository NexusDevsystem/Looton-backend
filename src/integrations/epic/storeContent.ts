import fetch from 'node-fetch';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 min

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, opts: any = {}, retries = 3, timeoutMs = 6000) {
  let attempt = 0;
  let backoff = 300;
  while (attempt < retries) {
    attempt++;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      if (res.status === 404) throw Object.assign(new Error('NotFound'), { status: 404 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(id);
      if (attempt >= retries) throw err;
      await sleep(backoff);
      backoff *= 2;
    }
  }
}

export async function fetchStoreContent(locale: string, slug: string) {
  const cacheKey = `epic:store:${locale}:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `https://store-content.ak.epicgames.com/api/${locale}/content/products/${encodeURIComponent(slug)}.json`;
  const data = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, 3, 6000);
  cache.set(cacheKey, data);
  return data;
}

// Deep scan for image URLs inside pageJson
export function extractAllImages(pageJson: any): string[] {
  const set = new Set<string>();
  const walk = (obj: any) => {
    if (!obj) return;
    if (typeof obj === 'string') {
      const s = obj.trim();
      if (/^https?:\/\//i.test(s) && (s.match(/\.(jpe?g|png|webp|gif|avif|jpeg)/i) || s.includes('/images/') || s.includes('/content/'))) {
        set.add(s);
      }
      return;
    }
    if (Array.isArray(obj)) return obj.forEach(walk);
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        try { walk(obj[k]); } catch (e) { }
      }
    }
  };
  walk(pageJson);
  return Array.from(set);
}

// Extract requirements text blocks and normalize into platform buckets
export function extractRequirements(pageJson: any): { platform?: string; items: string[] }[] | undefined {
  if (!pageJson) return undefined;

  // Strategy: find nodes where the key or text contains keywords
  const keywords = ['requirement', 'requirements', 'system requirements', 'requisitos', 'technical specifications', 'specifications', 'technical'];
  const candidates: string[] = [];

  const walk = (obj: any) => {
    if (!obj) return;
    if (typeof obj === 'string') {
      const lower = obj.toLowerCase();
      for (const kw of keywords) if (lower.includes(kw)) { candidates.push(obj); break; }
      return;
    }
    if (Array.isArray(obj)) return obj.forEach(walk);
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const lk = k.toLowerCase();
        for (const kw of keywords) if (lk.includes(kw)) { walk(obj[k]); break; }
        try { walk(obj[k]); } catch (e) {}
      }
    }
  };

  walk(pageJson);

  if (candidates.length === 0) return undefined;

  // Merge candidate strings and split by headings / <br> / newlines
  const text = candidates.join('\n\n');

  // Remove HTML tags and decode some entities
  const cleaned = text.replace(/<[^>]*>/g, '\n').replace(/&nbsp;|&amp;|&quot;/g, ' ').replace(/\r/gi, '\n');

  // Split into blocks by platform headers or common labels
  const lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);

  // heuristics: group lines under platform headers like 'Windows', 'macOS', 'Linux', 'Minimum', 'Recommended'
  const buckets: { platform?: string; items: string[] }[] = [];
  let current: { platform?: string; items: string[] } | null = null;
  for (const line of lines) {
    const low = line.toLowerCase();
    if (/(windows|microsoft windows|sistema operacional|os:)/i.test(line)) {
      current = { platform: 'Windows', items: [] };
      buckets.push(current);
      continue;
    }
    if (/(mac|macos|osx)/i.test(line)) {
      current = { platform: 'macOS', items: [] };
      buckets.push(current);
      continue;
    }
    if (/(linux|ubuntu|debian|steamos)/i.test(line)) {
      current = { platform: 'Linux', items: [] };
      buckets.push(current);
      continue;
    }
    if (/(recommended|minim)/i.test(low) && !current) {
      current = { items: [] };
      buckets.push(current);
    }

    if (!current) {
      current = { items: [line] };
      buckets.push(current);
    } else {
      current.items.push(line);
    }
  }

  // cleanup: dedupe items
  for (const b of buckets) {
    b.items = Array.from(new Set(b.items)).slice(0, 200);
  }

  return buckets.length ? buckets : undefined;
}

export async function fetchStoreContentWithLocale(slug: string, locales = ['pt-BR', 'en-US']) {
  for (const loc of locales) {
    try {
      const data = await fetchStoreContent(loc, slug);
      // basic validation: has product or pages
      if (data && Object.keys(data).length > 0) {
        if (loc !== locales[0]) console.warn(`Epic store-content: locale fallback ${locales[0]} -> ${loc} for ${slug}`);
        return { locale: loc, data };
      }
    } catch (err: any) {
      if (err && err.status === 404) {
        // continue to next locale
        console.warn(`store-content ${slug} not found for locale ${loc}`);
        continue;
      }
      console.warn(`error fetching store-content ${slug} locale ${loc}`, err instanceof Error ? err.message : String(err));
    }
  }
  return { locale: locales[0], data: null };
}
