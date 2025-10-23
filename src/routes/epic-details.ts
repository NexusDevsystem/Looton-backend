import { FastifyInstance } from 'fastify';
import { listEpicFreeBase, EpicFreeBase } from '../integrations/epic/freeFeed.js';
import { fetchStoreContentWithLocale, extractAllImages, extractRequirements } from '../integrations/epic/storeContent.js';

export default async function epicDetailsRoutes(app: FastifyInstance) {
  app.get('/api/v1/epic/free/full', async (req, reply) => {
    try {
      const base = await listEpicFreeBase('pt-BR', 'BR');
      const items: any[] = [];
      for (const it of base) {
        // choose slug candidate
        const slug = it.productSlug || it.urlSlug || '';
        let images: string[] = Array.from(new Set([...(it.keyImages || [])]));
        let requirements: any = undefined;
        if (slug) {
          const sc = await fetchStoreContentWithLocale(slug, ['pt-BR', 'en-US']);
          if (sc && sc.data) {
            const moreImages = extractAllImages(sc.data);
            images = Array.from(new Set([...images, ...moreImages]));
            requirements = extractRequirements(sc.data);
          }
        }

        items.push({
          id: it.id,
          title: it.title,
          images,
          price: it.price,
          promoWindow: it.promoWindow,
          storeUrl: it.storeUrl,
          purchaseUrl: it.purchaseUrl,
          requirements,
        });
      }
      reply.header('X-Data-Source', 'epic:freeGamesPromotions+store-content');
      return { items, count: items.length };
    } catch (err) {
  console.error('epic free full error', err);
      reply.code(500).send({ error: 'failed' });
    }
  });

  app.get('/api/v1/epic/free/full/:id', async (req, reply) => {
    try {
      const { id } = req.params as any;
      const base = await listEpicFreeBase('pt-BR', 'BR');
      const found = base.find(b => b.offerId === id || b.id === id || b.id === String(id) || b.title === id || (b.productSlug && b.productSlug.endsWith(id)) );
      if (!found) return reply.code(404).send({ error: 'not found' });

      const slug = found.productSlug || found.urlSlug || '';
      let images: string[] = Array.from(new Set([...(found.keyImages || [])]));
      let requirements: any = undefined;
      if (slug) {
        const sc = await fetchStoreContentWithLocale(slug, ['pt-BR', 'en-US']);
        if (sc && sc.data) {
          const moreImages = extractAllImages(sc.data);
          images = Array.from(new Set([...images, ...moreImages]));
          requirements = extractRequirements(sc.data);
        }
      }

      reply.header('X-Data-Source', 'epic:freeGamesPromotions+store-content');
      return { item: { id: found.id, title: found.title, images, price: found.price, promoWindow: found.promoWindow, storeUrl: found.storeUrl, purchaseUrl: found.purchaseUrl, requirements } };
    } catch (err) {
  console.error('epic free full id error', err);
      reply.code(500).send({ error: 'failed' });
    }
  });
}
