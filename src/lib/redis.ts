import Redis from 'ioredis'
import { env } from '../env.js'

// Lightweight in-memory stub for tests to avoid real Redis connections
function createMemoryRedis() {
	const store = new Map<string, string>()
	const mem = {
		get: async (key: string) => store.get(key) ?? null,
		setex: async (key: string, _seconds: number, value: string) => {
			store.set(key, value)
			return 'OK'
		},
		scan: async (_cursor: string, _matchLiteral: string, pattern: string, _countLiteral: string, _count: number) => {
			// Naive pattern matcher for '*' wildcard only
			const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
			const keys = Array.from(store.keys()).filter((k) => regex.test(k))
			return ['0', keys] as [string, string[]]
		},
		del: async (...keys: string[]) => {
			let count = 0
			for (const k of keys) {
				if (store.delete(k)) count++
			}
			return count
		},
		duplicate: () => mem
	}
	return mem
}

type SimpleRedis = {
	get: (key: string) => Promise<string | null>
	setex: (key: string, seconds: number, value: string) => Promise<'OK'>
	scan: (cursor: string, matchLiteral: string, pattern: string, countLiteral: string, count: number) => Promise<[string, string[]]>
	del: (...keys: string[]) => Promise<number>
	duplicate: () => SimpleRedis
}

export const redis: SimpleRedis | Redis =
	env.NODE_ENV === 'test'
		? ((createMemoryRedis() as SimpleRedis))
		: new Redis(env.REDIS_URL, {
			// BullMQ requires this to be null to avoid retrying failed commands implicitly
			maxRetriesPerRequest: null
		})

export async function deleteByPattern(pattern: string) {
	let cursor = '0'
	do {
		const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
		cursor = next
		if (keys.length) await redis.del(...keys)
	} while (cursor !== '0')
}
