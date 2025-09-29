import mongoose, { Schema, model, Types } from 'mongoose'

export interface AlertDoc {
  _id: Types.ObjectId
  userId: Types.ObjectId
  query?: string
  gameId?: Types.ObjectId
  maxPrice: number
  stores: string[]
  isActive: boolean
  createdAt: Date
}

const AlertSchema = new Schema<AlertDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  query: { type: String },
  gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
  maxPrice: { type: Number, required: true },
  stores: [{ type: String, required: true }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() }
})

AlertSchema.index({ userId: 1, isActive: 1 })

export const Alert = (mongoose.models.Alert as mongoose.Model<AlertDoc>) || model<AlertDoc>('Alert', AlertSchema)
