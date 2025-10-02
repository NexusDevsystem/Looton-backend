import { buildApp } from './app.js'
import { env } from './env.js'
import { connectMongo } from './db/mongoose.js'
import { startJobs } from './jobs/index.js'
import { startCurationJob } from './jobs/curation.js'
import { startPcCurationJob } from './jobs/pcCuration.js'

async function main() {
  // Optional DB connect for other features; curation itself is DB-less
  try { await connectMongo() } catch {}
  const app = buildApp()
  if (env.NODE_ENV !== 'test') {
    await startJobs()
    startCurationJob()
    startPcCurationJob()
  }
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Backend rodando em http://0.0.0.0:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
