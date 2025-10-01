import mongoose, { Schema, model, Types } from 'mongoose'

export interface ListItemDoc {
  _id: Types.ObjectId
  listId: Types.ObjectId
  gameId: Types.ObjectId
  notes?: string
  sortIndex?: number
  createdAt: Date
}

const ListItemSchema = new Schema<ListItemDoc>({
  listId: { type: Schema.Types.ObjectId, ref: 'List', required: true },
  gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
  notes: { type: String },
  sortIndex: { type: Number, default: 0 },
  createdAt: { type: Date, default: () => new Date() }
})

ListItemSchema.index({ listId: 1 })
ListItemSchema.index({ gameId: 1 })
ListItemSchema.index({ listId: 1, gameId: 1 }, { unique: true })
ListItemSchema.index({ listId: 1, sortIndex: 1 })

export const ListItem = (mongoose.models.ListItem as mongoose.Model<ListItemDoc>) || model<ListItemDoc>('ListItem', ListItemSchema)