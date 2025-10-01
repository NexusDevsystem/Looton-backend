import mongoose, { Schema, model, Types } from 'mongoose'
import { slugify } from '../../utils/slugify.js'

export interface ListDoc {
  _id: Types.ObjectId
  userId?: Types.ObjectId | null
  name: string
  slug: string
  description?: string
  coverUrl?: string
  createdAt: Date
  updatedAt?: Date
}

const ListSchema = new Schema<ListDoc>({
  // userId is optional: if absent/null the list is public (shared)
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String },
  coverUrl: { type: String },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date }
})

ListSchema.index({ userId: 1 })
// Unique slug per user
ListSchema.index({ userId: 1, slug: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } })
// Unique slug for public lists (userId == null)
ListSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { userId: { $eq: null } } })

// Generate unique slug per user when creating or renaming
ListSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('name')) {
    let baseSlug = slugify(this.name)
    let slug = baseSlug
    let counter = 1

    while (await (this.constructor as any).findOne({
        // match same userId (including null) and slug, excluding current doc
        userId: this.userId === null || this.userId === undefined ? null : this.userId,
        slug,
        _id: { $ne: this._id }
    })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    this.slug = slug
  }
  next()
})

export const List = (mongoose.models.List as mongoose.Model<ListDoc>) || model<ListDoc>('List', ListSchema)