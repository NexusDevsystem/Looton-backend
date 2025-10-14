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

let warnedPolicy = false

function createDisabledRedis(): SimpleRedis {
	const stub = createMemoryRedis()
	// Ensure type compatibility
	return {
		get: stub.get,
		setex: async (key: string, seconds: number, value: string) => {
			await stub.setex(key, seconds, value)
			return 'OK'
		},
		scan: stub.scan,
		del: stub.del,
		duplicate: () => createDisabledRedis()
	}
}

export const redis: SimpleRedis | Redis = (() => {
	if (!env.USE_REDIS) {
		return createDisabledRedis()
	}
	if (env.NODE_ENV === 'test') {
		return createMemoryRedis() as SimpleRedis
	}
	const client = new Redis(env.REDIS_URL, {
		maxRetriesPerRequest: null,
		enableAutoPipelining: true
	})
	// If required, check eviction policy once and warn (no throw)
	if (env.REDIS_REQUIRE_NOEVICTION && !warnedPolicy) {
		client.config('GET', 'maxmemory-policy').then((res: any) => {
			try {
				const policy = Array.isArray(res) ? String(res[1]) : String(res?.['maxmemory-policy'] || res)
				if (policy && policy !== 'noeviction' && !warnedPolicy) {
					warnedPolicy = true
					console.warn('IMPORTANT! Redis eviction policy is', policy, 'expected "noeviction". Proceeding anyway.')
				}
			} catch (e) {
				// Ignorar erros ao verificar política de memória do Redis
			}
		}).catch(() => {/* ignore */})
	}
	return client
})()

export async function deleteByPattern(pattern: string) {
	let cursor = '0'
	do {
		const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
		cursor = next
		if (keys.length) await redis.del(...keys)
	} while (cursor !== '0')
}
