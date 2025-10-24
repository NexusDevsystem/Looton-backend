import fetch from 'node-fetch';
import NodeCache from 'node-cache';

const FREE_FEED_URL = 'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions';
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 min TTL

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

export interface EpicFreeBase {
  id: string;
  title: string;
  keyImages: string[];
  price?: { original: number; current: number; currency: string; discountPct: number };
  promoWindow?: { start: string; end: string } | null;
  namespace?: string;
  offerId?: string;
  productSlug?: string;
  urlSlug?: string;
  storeUrl?: string;
  purchaseUrl?: string;
}

export async function listEpicFreeBase(locale = 'pt-BR', country = 'BR') {
  const cacheKey = `epic:free:${locale}:${country}`;
  const cached = cache.get(cacheKey) as EpicFreeBase[] | undefined;
  if (cached) return cached;

  const url = `${FREE_FEED_URL}`;
  const data = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, 3, 6000);

  // traverse structure: data?.data?.Catalog?.searchStore?.elements
  const elements = (((data || {}).data || {}).Catalog || {}).searchStore?.elements || [];

  const items: EpicFreeBase[] = [];
  for (const el of elements) {
    try {
      const title = el.title || el.name || '';
      const keyImages = (el.keyImages || []).map((ki: any) => ki.url).filter(Boolean);
      // find price and promotions
      const priceObj: any = el.price || el.price || {};
      const promoWindow = (() => {
        try {
          const promos = el.promotions || el.promotions || {};
          const all = (promos.promotionalOffers || []).flatMap((p: any) => p.promotionalOffers || [])
            .concat((promos.upcomingPromotionalOffers || []).flatMap((p: any) => p.promotionalOffers || []));
          if (all.length > 0) {
            return { start: all[0].startDate, end: all[0].endDate };
          }
        } catch (e) {
          // ignore parsing error inside promotions
          void e
        }
        return null;
      })();

      const namespace = el.namespace || el.catalogNs?.mappings?.[0]?.namespace || el.namespace;
      const offerId = el.offerId || el.id || (el.promotions && el.promotions.offerId) || undefined;

      // deduce slug candidate: productSlug, urlSlug, catalog mappings
      let productSlug = el.productSlug || el.urlSlug || undefined;
      if (!productSlug) {
        const mapping = el.catalogNs?.mappings?.[0];
        productSlug = mapping?.pageSlug || mapping?.urlSlug || mapping?.pageSlug;
      }
      if (typeof productSlug === 'string') productSlug = productSlug.replace(/\/home$/i, '').replace(/\/home$/i, '').replace(/\/home$/i, '');

      const slug = productSlug || el.offer?.productSlug || el.productNamespace || '';

      const storeUrl = slug ? `https://store.epicgames.com/${locale}/p/${slug.replace(/\/home$/i, '')}` : undefined;
      const purchaseUrl = (namespace && offerId) ? `https://store.epicgames.com/purchase?offers=1-${namespace}-${offerId}` : undefined;

      const normalized: EpicFreeBase = {
        id: offerId || `${title}-${el.id || Math.random().toString(36).slice(2, 8)}`,
        title,
        keyImages,
        price: priceObj ? { original: priceObj.totalPrice?.originalPrice || 0, current: priceObj.totalPrice?.discountPrice || 0, currency: priceObj.totalPrice?.currencyCode || 'USD', discountPct: priceObj.totalPrice?.discount || 0 } : undefined,
        promoWindow,
        namespace,
        offerId,
        productSlug: slug,
        urlSlug: el.urlSlug || undefined,
        storeUrl,
        purchaseUrl,
      };

      items.push(normalized);
    } catch (e) {
      // ignore element errors
      console.warn('Error normalizing epic element', e);
    }
  }

  cache.set(cacheKey, items);
  return items;
}
