import { buildApp } from './app.js'
import { env } from './env.js'
import { startJobs } from './jobs/index.js'
import { startCurationJob } from './jobs/curation.js'
// import { startPcCurationJob } from './jobs/pcCuration.js' // pcCuration job may not exist

async function main() {
  // No database connection - using live APIs only as requested
  const app = buildApp()

  const enableJobs = process.env.ENABLE_JOBS === 'true' && env.NODE_ENV !== 'test'
  if (enableJobs) {
    try {
      await startJobs()
      startCurationJob()
      // startPcCurationJob()
      console.log('[jobs] curation jobs enabled')
    } catch (e) {
      console.error('[jobs] failed to start jobs', e)
    }
  } else {
    console.log('[jobs] disabled by ENV or NODE_ENV=test')
  }

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Backend rodando em http://0.0.0.0:${env.PORT}`)
  console.log(`Acessível em: http://192.168.1.216:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
