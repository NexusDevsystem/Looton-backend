import mongoose, { Schema, model, Types } from 'mongoose'

export interface PriceHistoryDoc {
  _id: Types.ObjectId
  gameId: Types.ObjectId
  storeId: Types.ObjectId
  priceFinal: number
  discountPct: number
  seenAt: Date
}

const PriceHistorySchema = new Schema<PriceHistoryDoc>({
  gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  priceFinal: { type: Number, required: true },
  discountPct: { type: Number, required: true },
  seenAt: { type: Date, default: () => new Date() }
})

PriceHistorySchema.index({ gameId: 1, seenAt: -1 })

export const PriceHistory = (mongoose.models.PriceHistory as mongoose.Model<PriceHistoryDoc>) || model<PriceHistoryDoc>('PriceHistory', PriceHistorySchema)
