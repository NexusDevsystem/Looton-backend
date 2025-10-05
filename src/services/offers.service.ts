import { Types } from 'mongoose'
import { Offer } from '../db/models/Offer.js'
import { Game } from '../db/models/Game.js'
import { Store } from '../db/models/Store.js'
import { PriceHistory } from '../db/models/PriceHistory.js'
import { OfferDTO } from '../adapters/types.js'
import { redis, deleteByPattern } from '../lib/redis.js'
import { slugify } from '../utils/slugify.js'
import { checkAndNotify } from './alerts.service.js'
import { checkFavoritesAndNotify, verifyPriceChangeDebounce } from './favorites.service.js'

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
        coverUrl: dto.coverUrl,
        genres: dto.genres || [],
        tags: dto.tags || []
      })
    } else {
      // Update genres, tags, and coverUrl if provided
      let shouldUpdate = false
      if (dto.genres && dto.genres.length > 0) {
        game.genres = dto.genres
        shouldUpdate = true
      }
      if (dto.tags && dto.tags.length > 0) {
        game.tags = dto.tags
        shouldUpdate = true
      }
      // Update coverUrl if it's provided and different from current (or current is empty)
      if (dto.coverUrl && (dto.coverUrl !== game.coverUrl || !game.coverUrl)) {
        game.coverUrl = dto.coverUrl
        shouldUpdate = true
      }
      if (shouldUpdate) {
        await game.save()
      }
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
        
        // Check for existing alerts
        await checkAndNotify(String(game._id), created)
        
        // Check for favorites notifications with debounce
        const isStableChange = await verifyPriceChangeDebounce(game._id, store._id)
        if (isStableChange) {
          await checkFavoritesAndNotify(game._id, created)
        }
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
    // Exclude games that were soft-deleted
    { $match: { 'game.deletedAt': { $exists: false } } },
    { $lookup: { from: 'stores', localField: 'storeId', foreignField: '_id', as: 'store' } },
    { $unwind: '$store' },
  { $project: { _id: 1, url: 1, priceBase: 1, priceFinal: 1, discountPct: 1, 'game.title': 1, 'game.coverUrl': 1, 'game.genres': 1, 'store.name': 1 } }
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

export interface DealsFilters {
  genres?: string[]
  tags?: string[]
  stores?: string[]
  minDiscount?: number
  maxPrice?: number
  page?: number
  limit?: number
}

export async function getFilteredDeals(filters: DealsFilters) {
  const { 
    genres, 
    tags, 
    stores, 
    minDiscount = 0, 
    maxPrice, 
    page = 1, 
    limit = 24 
  } = filters
  
  const skip = (page - 1) * limit

  // Build aggregation pipeline
  const pipeline: any[] = [
    { $match: { isActive: true, discountPct: { $gte: minDiscount } } }
  ]

  // Price filter
  if (maxPrice !== undefined) {
    pipeline[0].$match.priceFinalCents = { $lte: maxPrice }
  }

  // Join with game and store
  pipeline.push(
    { $lookup: { from: 'games', localField: 'gameId', foreignField: '_id', as: 'game' } },
    { $unwind: '$game' },
    // Exclude soft-deleted games
    { $match: { 'game.deletedAt': { $exists: false } } },
    { $lookup: { from: 'stores', localField: 'storeId', foreignField: '_id', as: 'store' } },
    { $unwind: '$store' }
  )

  // Genre filter
  if (genres?.length) {
    pipeline.push({
      $match: { 'game.genres': { $in: genres } }
    })
  }

  // Tag filter  
  if (tags?.length) {
    pipeline.push({
      $match: { 'game.tags': { $in: tags } }
    })
  }

  // Store filter
  if (stores?.length) {
    pipeline.push({
      $match: { 'store.name': { $in: stores } }
    })
  }

  // Sort by discount descending
  pipeline.push({ $sort: { discountPct: -1 } })

  // Count total for pagination
  const countPipeline = [...pipeline, { $count: 'total' }]
  const [countResult] = await Offer.aggregate(countPipeline)
  const total = countResult?.total || 0

  // Add pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  )

  // Project final fields
  pipeline.push({
    $project: {
      _id: 1,
      url: 1,
      priceBaseCents: 1,
      priceFinalCents: 1,
      discountPct: 1,
      'game._id': 1,
      'game.title': 1,
      'game.coverUrl': 1,
      'game.genres': 1,
      'game.tags': 1,
      'store.name': 1
    }
  })

  const deals = await Offer.aggregate(pipeline)

  return {
    deals,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}
