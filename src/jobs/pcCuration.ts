import cron from 'node-cron'
import { env } from '../env.js'
import { rebuildPcFeed } from '../services/pc/aggregate.js'
import * as terabyte from '../services/pc/terabyte.js'
import * as aliexpress from '../services/pc/aliexpress.js'

export function startPcCurationJob() {
  const connectors = [
    // AliExpress em PRIMEIRO para ter prioridade no feed curado
    () => aliexpress.fetchDeals({ limit: 100 }), // Mais itens para garantir diversidade
    () => terabyte.fetchDeals({ limit: 50 })
  ]

  const run = async () => {
    try { await rebuildPcFeed(connectors) } catch (e) { console.warn('pc-curation run error:', e) }
  }

  // run once at startup
  run()
  // schedule
  cron.schedule(env.PC_CUR_CRON, run)
}
