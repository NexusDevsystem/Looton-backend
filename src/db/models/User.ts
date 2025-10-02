import mongoose, { Schema, model, Types } from 'mongoose'

export interface UserDoc {
  _id: Types.ObjectId
  email: string
  pushToken?: string
  preferences?: {
    preferredSteamGenreIds: string[]
    minDiscount?: number
    stores?: string[]
  }
  createdAt: Date
}

const UserSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true },
  pushToken: { type: String },
  preferences: {
    preferredSteamGenreIds: { type: [String], default: [] },
    minDiscount: { type: Number, default: 0, min: 0, max: 100 },
    stores: { type: [String], default: [] }
  },
  createdAt: { type: Date, default: () => new Date() }
})

// Unique index enforced via field option above

export const User = (mongoose.models.User as mongoose.Model<UserDoc>) || model<UserDoc>('User', UserSchema)
