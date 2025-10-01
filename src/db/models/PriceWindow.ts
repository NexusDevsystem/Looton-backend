import mongoose, { Schema, model, Types } from 'mongoose'

export interface PriceWindowDoc {
  _id: Types.ObjectId
  userId: Types.ObjectId
  gameId?: Types.ObjectId
  store?: string
  min?: number
  max?: number
  enabled: boolean
  createdAt: Date
}

const PriceWindowSchema = new Schema<PriceWindowDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
  store: { type: String },
  min: { type: Number },
  max: { type: Number },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() }
})

PriceWindowSchema.index({ userId: 1, enabled: 1 })

export const PriceWindow = (mongoose.models.PriceWindow as mongoose.Model<PriceWindowDoc>) || model<PriceWindowDoc>('PriceWindow', PriceWindowSchema)
