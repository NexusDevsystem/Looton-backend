import cron from 'node-cron'
import { env } from '../env.js'
import { buildCuratedFeed } from '../services/curate.js'

export function startCurationJob() {
  // run once at startup
  buildCuratedFeed().catch((e) => console.error('curation initial error', e))

  // schedule
  cron.schedule(env.CURATION_CRON, async () => {
    try {
      await buildCuratedFeed()
      console.log('[curation] feed updated')
    } catch (e) {
      console.error('[curation] job error', e)
    }
  })
}