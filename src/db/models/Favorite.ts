import mongoose, { Schema, model, Types } from 'mongoose'

export interface FavoriteDoc {
  _id: Types.ObjectId
  userId: Types.ObjectId
  gameId: Types.ObjectId
  stores?: string[]
  notifyUp?: boolean
  notifyDown?: boolean
  pctThreshold?: number
  desiredPriceCents?: number // optional absolute desired price in cents
  lastNotifiedAt?: Date
  listId?: Types.ObjectId | null
  createdAt: Date
}

const FavoriteSchema = new Schema<FavoriteDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  stores: { type: [String] },
  notifyUp: { type: Boolean, default: false },
  notifyDown: { type: Boolean, default: true },
  pctThreshold: { type: Number, default: 10 },
  // optional absolute desired price in cents (server will honor this if present)
  desiredPriceCents: { type: Number },
  lastNotifiedAt: { type: Date },
  // optional link to a user list/collection
  listId: { type: Schema.Types.ObjectId, ref: 'List' },
  createdAt: { type: Date, default: () => new Date() }
})

FavoriteSchema.index({ userId: 1 })
FavoriteSchema.index({ gameId: 1 })
FavoriteSchema.index({ userId: 1, gameId: 1 }, { unique: true })

export const Favorite = (mongoose.models.Favorite as mongoose.Model<FavoriteDoc>) || model<FavoriteDoc>('Favorite', FavoriteSchema)