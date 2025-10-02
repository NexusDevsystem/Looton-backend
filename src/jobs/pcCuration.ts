import cron from 'node-cron'
import { env } from '../env.js'
import { rebuildPcFeed } from '../services/pc/aggregate.js'
import * as pichau from '../services/pc/pichau.js'
import * as terabyte from '../services/pc/terabyte.js'
import * as kabum from '../services/pc/kabum.js'

export function startPcCurationJob() {
  const connectors = [
    () => pichau.fetchDeals({ limit: 50 }),
    () => terabyte.fetchDeals({ limit: 50 }),
    () => kabum.fetchDeals({ limit: 50 })
  ]

  const run = async () => {
    try { await rebuildPcFeed(connectors) } catch (e) { console.warn('pc-curation run error:', e) }
  }

  // run once at startup
  run()
  // schedule
  cron.schedule(env.PC_CUR_CRON, run)
}
