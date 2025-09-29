import mongoose, { Schema, model, Types } from 'mongoose'

export interface StoreDoc {
  _id: Types.ObjectId
  name: string
  region: string
  currency: string
  createdAt: Date
}

const StoreSchema = new Schema<StoreDoc>({
  name: { type: String, required: true, unique: true },
  region: { type: String, required: true },
  currency: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() }
})

// Unique index enforced via field option above

export const Store = (mongoose.models.Store as mongoose.Model<StoreDoc>) || model<StoreDoc>('Store', StoreSchema)
