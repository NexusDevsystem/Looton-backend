import mongoose, { Schema, model, Types } from 'mongoose'

export interface GameDoc {
  _id: Types.ObjectId
  storeId: Types.ObjectId
  storeAppId: string
  title: string
  slug: string
  publisher?: string
  coverUrl?: string
  createdAt: Date
}

const GameSchema = new Schema<GameDoc>({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  storeAppId: { type: String, required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  publisher: { type: String },
  coverUrl: { type: String },
  createdAt: { type: Date, default: () => new Date() }
})

GameSchema.index({ storeId: 1, storeAppId: 1 }, { unique: true })
GameSchema.index({ title: 'text' })

export const Game = (mongoose.models.Game as mongoose.Model<GameDoc>) || model<GameDoc>('Game', GameSchema)
