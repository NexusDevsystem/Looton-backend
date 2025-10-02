import mongoose, { Schema, model, Types } from 'mongoose'

export interface GameDoc {
  _id: Types.ObjectId
  storeId: Types.ObjectId
  storeAppId: string
  steamAppId?: number
  title: string
  slug: string
  publisher?: string
  coverUrl?: string
  genres: string[]
  tags: string[]
  steamGenres: Array<{ id: string; name: string }>
  genreSlugs: string[]
  createdAt: Date
  deletedAt?: Date
}

const GameSchema = new Schema<GameDoc>({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  storeAppId: { type: String, required: true },
  steamAppId: { type: Number },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  publisher: { type: String },
  coverUrl: { type: String },
  genres: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  steamGenres: [{
    id: { type: String, required: true },
    name: { type: String, required: true }
  }],
  genreSlugs: { type: [String], default: [] },
  createdAt: { type: Date, default: () => new Date() },
  deletedAt: { type: Date }
})

GameSchema.index({ storeId: 1, storeAppId: 1 }, { unique: true })
GameSchema.index({ title: 'text' })
GameSchema.index({ genres: 1 })
GameSchema.index({ tags: 1 })
GameSchema.index({ 'steamGenres.id': 1 })
GameSchema.index({ genreSlugs: 1 })
GameSchema.index({ steamAppId: 1 })
// Optional index to quickly find soft-deleted games
GameSchema.index({ deletedAt: 1 })

export const Game = (mongoose.models.Game as mongoose.Model<GameDoc>) || model<GameDoc>('Game', GameSchema)
