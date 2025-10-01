import mongoose, { Schema, model, Types } from 'mongoose'

export interface NotificationRuleDoc {
  _id: Types.ObjectId
  userId: Types.ObjectId
  type: 'studio' | 'franchise' | 'game' | 'store'
  query?: string
  gameId?: Types.ObjectId
  enabled: boolean
  createdAt: Date
}

const NotificationRuleSchema = new Schema<NotificationRuleDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['studio', 'franchise', 'game', 'store'], required: true },
  query: { type: String },
  gameId: { type: Schema.Types.ObjectId, ref: 'Game' },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() }
})

NotificationRuleSchema.index({ userId: 1, enabled: 1 })

export const NotificationRule = (mongoose.models.NotificationRule as mongoose.Model<NotificationRuleDoc>) || model<NotificationRuleDoc>('NotificationRule', NotificationRuleSchema)
