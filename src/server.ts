import { buildApp } from './app.js';
import { env } from './env.js';
import { startJobs } from './jobs/index.js';
import { startCurationJob } from './jobs/curation.js';

async function main() {
  const app = await buildApp();

  const enableJobs = process.env.ENABLE_JOBS === 'true' && env.NODE_ENV !== 'test';
  if (enableJobs) {
    try {
      await startJobs()
      startCurationJob()
      console.log('[jobs] curation jobs enabled')
    } catch (e) {
      console.error('[jobs] failed to start jobs', e)
    }
  } else {
    console.log('[jobs] disabled by ENV or NODE_ENV=test')
  }

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Backend rodando em http://localhost:${env.PORT}`);
    console.log(`Acessível em: http://192.168.1.216:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});