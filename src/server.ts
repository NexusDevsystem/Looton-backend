import { buildApp } from './app.js'
import { env } from './env.js'
import { connectMongo } from './db/mongoose.js'
import { startJobs } from './jobs/index.js'

async function main() {
  await connectMongo()
  const app = buildApp()
  if (env.NODE_ENV !== 'test') {
    await startJobs()
  }
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Backend rodando em http://0.0.0.0:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
