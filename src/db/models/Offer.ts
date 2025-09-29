import mongoose, { Schema, model, Types } from 'mongoose'

export interface OfferDoc {
  _id: Types.ObjectId
  gameId: Types.ObjectId
  storeId: Types.ObjectId
  url: string
  priceBase: number
  priceFinal: number
  discountPct: number
  isActive: boolean
  lastSeenAt: Date
  createdAt: Date
}

const OfferSchema = new Schema<OfferDoc>({
  gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  url: { type: String, required: true },
  priceBase: { type: Number, required: true },
  priceFinal: { type: Number, required: true },
  discountPct: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  lastSeenAt: { type: Date, default: () => new Date() },
  createdAt: { type: Date, default: () => new Date() }
})

OfferSchema.index({ gameId: 1, isActive: 1 })
OfferSchema.index({ storeId: 1, isActive: 1 })

export const Offer = (mongoose.models.Offer as mongoose.Model<OfferDoc>) || model<OfferDoc>('Offer', OfferSchema)
