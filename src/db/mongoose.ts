import mongoose from 'mongoose'
import { env } from '../env.js'

export async function connectMongo() {
  if (!env.MONGODB_URI || !env.MONGODB_DBNAME) {
    throw new Error('Missing MONGODB_URI or MONGODB_DBNAME in environment')
  }
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DBNAME })
}

export async function disconnectMongo() {
  await mongoose.disconnect()
}
