import { Types } from 'mongoose'
import { Offer } from '../db/models/Offer.js'
import { Game } from '../db/models/Game.js'
import { Store } from '../db/models/Store.js'
import { PriceHistory } from '../db/models/PriceHistory.js'
import { OfferDTO } from '../adapters/types.js'
import { redis, deleteByPattern } from '../lib/redis.js'
import { slugify } from '../utils/slugify.js'
import { checkAndNotify } from './alerts.service.js'

export async function upsertOffersAndNotify(list: OfferDTO[]) {
  for (const dto of list) {
    const storeName = dto.store
    let store = await Store.findOne({ name: storeName })
    if (!store) {
      store = await Store.create({ name: storeName, region: 'BR', currency: 'BRL' })
    }

    let game = await Game.findOne({ storeId: store._id, storeAppId: dto.storeAppId })
    if (!game) {
      game = await Game.create({
        storeId: store._id,
        storeAppId: dto.storeAppId,
        title: dto.title,
        slug: slugify(dto.title),
        coverUrl: dto.coverUrl
      })
    }

    const active = await Offer.findOne({ gameId: game._id, storeId: store._id, isActive: true })

    if (active) {
      const changed = active.priceFinal !== dto.priceFinal || active.discountPct !== dto.discountPct
      if (changed) {
        active.isActive = false
        await active.save()
        const created = await Offer.create({
          gameId: game._id,
          storeId: store._id,
          url: dto.url,
          priceBase: dto.priceBase,
          priceFinal: dto.priceFinal,
          discountPct: dto.discountPct,
          isActive: true
        })
        await PriceHistory.create({
          gameId: game._id,
          storeId: store._id,
          priceFinal: dto.priceFinal,
          discountPct: dto.discountPct
        })
        await checkAndNotify(String(game._id), created)
      } else {
        // Refresh lastSeen
        active.lastSeenAt = new Date()
        await active.save()
      }
    } else {
      const created = await Offer.create({
        gameId: game._id,
        storeId: store._id,
        url: dto.url,
        priceBase: dto.priceBase,
        priceFinal: dto.priceFinal,
        discountPct: dto.discountPct,
        isActive: true
      })
      await PriceHistory.create({
        gameId: game._id,
        storeId: store._id,
        priceFinal: dto.priceFinal,
        discountPct: dto.discountPct
      })
      await checkAndNotify(String(game._id), created)
    }
  }
  await deleteByPattern('cache:deals:*')
}

export async function getTopDeals(minDiscount = 0, limit = 20) {
  const key = `cache:deals:${minDiscount}:${limit}`
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached)

  const docs = await Offer.aggregate([
    { $match: { isActive: true, discountPct: { $gte: minDiscount } } },
    { $sort: { discountPct: -1 } },
    { $limit: limit },
    { $lookup: { from: 'games', localField: 'gameId', foreignField: '_id', as: 'game' } },
    { $unwind: '$game' },
    { $lookup: { from: 'stores', localField: 'storeId', foreignField: '_id', as: 'store' } },
    { $unwind: '$store' },
    { $project: { _id: 1, url: 1, priceBase: 1, priceFinal: 1, discountPct: 1, 'game.title': 1, 'game.coverUrl': 1, 'store.name': 1 } }
  ])

  await redis.setex(key, 60, JSON.stringify(docs))
  return docs
}

export async function getOffersByGame(gameId: string) {
  const id = new Types.ObjectId(gameId)
  const offers = await Offer.aggregate([
    { $match: { gameId: id, isActive: true } },
    { $lookup: { from: 'stores', localField: 'storeId', foreignField: '_id', as: 'store' } },
    { $unwind: '$store' },
    { $project: { _id: 1, url: 1, priceBase: 1, priceFinal: 1, discountPct: 1, 'store.name': 1 } },
    { $sort: { priceFinal: 1 } }
  ])
  return offers
}

export async function getHistory(gameId: string, limit = 60) {
  const id = new Types.ObjectId(gameId)
  const hist = await PriceHistory.find({ gameId: id }).sort({ seenAt: -1 }).limit(limit).lean()
  return hist
}
