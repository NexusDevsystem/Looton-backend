import { getHardwareRecommendationsForGame, TB_HARDWARE_COMPONENTS } from '../services/terabyte.hardware';

export default async function (app: any) {
  app.get('/games/:appId/recommended-hardware', async (req: any, res: any) => {
    const { appId } = req.params as any;

    // For now try to read game requirements from query or return generic recommendations
    // In a real setup we'd fetch game details from DB or external API
    const fakeRequirements = req.query && (req.query as any).requirements;

    const recommendations = getHardwareRecommendationsForGame(fakeRequirements || '', String(appId));

    // Ensure all components include imageUrl and url
    const normalized = (recommendations || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      price: c.price,
      originalPrice: c.originalPrice,
      discountPct: c.discountPct,
      imageUrl: c.imageUrl || (c.image || null) || null,
      url: c.url || c.link || null,
      category: c.category || 'other',
      brand: c.brand || null,
      specs: c.specs || null,
    }));

    return res.send({
      gameAppId: Number(appId) || null,
      gameName: null,
      recommendedHardware: normalized,
    });
  });

  // POST variant used by associateHardwareWithGame in the mobile client
  app.post('/games/:appId/recommended-hardware', async (req: any, res: any) => {
    const { appId } = req.params as any;
    const body = req.body as any;

    const requirements = body?.requirements || '';
    const gameName = body?.gameName || null;

    const recommendations = getHardwareRecommendationsForGame(String(requirements), gameName || String(appId));

    const normalized = (recommendations || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      price: c.price,
      originalPrice: c.originalPrice,
      discountPct: c.discountPct,
      imageUrl: c.imageUrl || (c.image || null) || null,
      url: c.url || c.link || null,
      category: c.category || 'other',
      brand: c.brand || null,
      specs: c.specs || null,
    }));

    return res.send({
      gameAppId: Number(appId) || null,
      gameName: gameName,
      recommendedHardware: normalized,
    });
  });
}
