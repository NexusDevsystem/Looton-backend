import { Types } from 'mongoose'
import { Alert } from '../db/models/Alert'
import { User } from '../db/models/User'
import { Store } from '../db/models/Store'
import { Game } from '../db/models/Game'

export async function registerUser(input: { email: string; pushToken?: string }) {
  const exists = await User.findOne({ email: input.email })
  if (exists) {
    if (input.pushToken) {
      exists.pushToken = input.pushToken
      await exists.save()
    }
    return exists
  }
  return User.create({ email: input.email, pushToken: input.pushToken })
}

export async function createAlert(input: {
  userId: string
  query?: string
  gameId?: string
  maxPrice: number
  stores: string[]
  isActive?: boolean
}) {
  const alert = await Alert.create({
    userId: new Types.ObjectId(input.userId),
    query: input.query,
    gameId: input.gameId ? new Types.ObjectId(input.gameId) : undefined,
    maxPrice: input.maxPrice,
    stores: input.stores,
    isActive: input.isActive ?? true
  })
  return alert
}

export async function getAlertsByUser(userId: string) {
  return Alert.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean()
}

export async function deleteAlert(id: string) {
  await Alert.deleteOne({ _id: new Types.ObjectId(id) })
}

export async function testNotify({ token, title, body }: { token: string; title: string; body: string }) {
  // Stub: In production, integrate Expo Push or FCM here
  console.log('Push to', token, title, body)
  return true
}

export async function checkAndNotify(gameId: string, offer: { priceFinal: number; discountPct: number; storeId: Types.ObjectId }) {
  const gameRaw = await Game.findById(gameId).lean()
  const game = gameRaw as ({ _id: Types.ObjectId; title: string } | null)
  if (!game) return
  const storeRaw = await Store.findById(offer.storeId).lean()
  const store = storeRaw as ({ _id: Types.ObjectId; name: string } | null)
  if (!store) return

  const alerts = await Alert.find({ isActive: true, $or: [{ gameId: game._id }, { query: { $exists: true, $ne: null } }] }).lean()
  for (const alert of alerts) {
    const storeOk = alert.stores.includes(store.name)
    const priceOk = offer.priceFinal <= alert.maxPrice
    const textOk = alert.gameId ? String(alert.gameId) === String(game._id) : (alert.query ? game.title.toLowerCase().includes(alert.query.toLowerCase()) : false)
    if (storeOk && priceOk && textOk) {
      const userRaw = await User.findById(alert.userId).lean()
      const user = userRaw as ({ pushToken?: string } | null)
      if (user?.pushToken) {
        await testNotify({ token: user.pushToken, title: 'Looton: oferta atingiu preço', body: `${game.title} por R$ ${offer.priceFinal} na ${store.name}` })
      }
    }
  }
}
