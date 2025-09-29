import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DBNAME: z.string().min(1, 'MONGODB_DBNAME is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  CURRENCY_BASE: z.string().default('BRL'),
  CURRENCY_REFRESH_CRON: z.string().default('0 3 * * *'),
  DEALS_REFRESH_CRON: z.string().default('*/20 * * * *'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  USE_MOCK_ADAPTERS: z.coerce.boolean().default(true)
})

export const env = envSchema.parse(process.env)
