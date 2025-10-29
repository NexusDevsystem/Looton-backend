import { buildApp } from './app.js'
import { env } from './env.js'
import { startJobs } from './jobs/index.js'

async function main() {
  // No database connection - using live APIs only as requested
  const app = await buildApp()
  // Habilitar jobs incluindo reengajamento
  if (env.NODE_ENV !== 'test') {
    await startJobs()
    // startCurationJob() e startPcCurationJob() desabilitados para evitar rate limiting
  }
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Backend rodando em http://0.0.0.0:${env.PORT}`)
  console.log(`Acessível em: http://192.168.1.216:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})