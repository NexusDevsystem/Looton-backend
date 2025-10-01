import mongoose, { Schema, model, Types } from 'mongoose'

export interface MuteDoc {
  _id: Types.ObjectId
  userId: Types.ObjectId
  targetType: 'game' | 'store'
  targetId: string
  until: Date
  createdAt: Date
}

const MuteSchema = new Schema<MuteDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['game', 'store'], required: true },
  targetId: { type: String, required: true },
  until: { type: Date, required: true },
  createdAt: { type: Date, default: () => new Date() }
})

MuteSchema.index({ userId: 1, targetType: 1, targetId: 1 })

export const Mute = (mongoose.models.Mute as mongoose.Model<MuteDoc>) || model<MuteDoc>('Mute', MuteSchema)
