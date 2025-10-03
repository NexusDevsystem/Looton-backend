import { FastifyInstance } from 'fastify';

export default async function thumbRoute(app: FastifyInstance) {
  app.get('/thumb', async (req, reply) => {
    const { url, w = '640' } = req.query as any;
    if (!url) return reply.code(400).send({ error: 'url is required' });

    const width = Math.max(120, Math.min(2048, Number(w) || 640));

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LootonBot/1.0; (+https://looton.app)',
        'Accept': 'image/avif,image/webp,image/*;q=0.8,*/*;q=0.5'
      }
    });
    if (!res.ok) return reply.code(502).send({ error: 'upstream fetch failed' });
    const buf = Buffer.from(await res.arrayBuffer());

    const sharp = (await import('sharp')).default;
    const out = await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();

    reply
      .header('Content-Type', 'image/webp')
      .header('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
      .send(out);
  });
}