import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

export default async function thumbRoute(app: any) {
  app.get('/thumb', async (req: any, res: any) => {
    const { url, w = '640' } = req.query as any;
    if (!url) return res.status(400).send({ error: 'url is required' });

    const width = Math.max(120, Math.min(2048, Number(w) || 640));

    const upstream = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'LootonBot/1.0; (+https://looton.app)',
        'Accept': 'image/avif,image/webp,image/*;q=0.8,*/*;q=0.5'
      }
    }, 15000); // 15 segundos
    if (!upstream.ok) return res.status(502).send({ error: 'upstream fetch failed' });
    const buf = Buffer.from(await upstream.arrayBuffer());

    const sharp = (await import('sharp')).default;
    const out = await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();

    res
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      .send(out);
  });
}