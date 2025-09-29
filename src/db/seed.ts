import { connectMongo, disconnectMongo } from './mongoose.js'
import { Store } from './models/Store.js'
import { upsertOffersAndNotify } from '../services/offers.service.js'
import { steamAdapter } from '../adapters/steam.adapter.js'

async function seed() {
  await connectMongo()
  await Store.updateOne({ name: 'steam' }, { $setOnInsert: { name: 'steam', region: 'BR', currency: 'BRL' } }, { upsert: true })

  const offers = await steamAdapter.fetchTrending()
  await upsertOffersAndNotify(offers)

  await disconnectMongo()
  console.log('Seed completed')
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
