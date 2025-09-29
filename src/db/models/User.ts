import mongoose, { Schema, model, Types } from 'mongoose'

export interface UserDoc {
  _id: Types.ObjectId
  email: string
  pushToken?: string
  createdAt: Date
}

const UserSchema = new Schema<UserDoc>({
  email: { type: String, required: true, unique: true },
  pushToken: { type: String },
  createdAt: { type: Date, default: () => new Date() }
})

// Unique index enforced via field option above

export const User = (mongoose.models.User as mongoose.Model<UserDoc>) || model<UserDoc>('User', UserSchema)
