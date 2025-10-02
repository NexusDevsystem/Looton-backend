import { Queue, Worker, JobsOptions, Job, QueueOptions, WorkerOptions } from 'bullmq'
import { redis } from './redis.js'
import Redis from 'ioredis'
import { env } from '../env.js'

export function createQueue<Name extends string, T = unknown>(name: Name) {
  if (!env.USE_REDIS) {
    // no-op queue
    return {
      queue: {
        add: async () => ({}),
      } as unknown as Queue<T, any, Name>
    }
  }
  // Ensure connection type is compatible with BullMQ
  const connection = (redis as Redis).duplicate()
  const opts: QueueOptions = { connection }
  const queue = new Queue<T, any, Name>(name, opts)
  return { queue }
}

export type { JobsOptions }

export function createWorker<Name extends string, T = unknown, R = unknown>(
  name: Name,
  processor: (job: Job<T, R, Name>) => Promise<R>
) {
  if (!env.USE_REDIS) {
    // no-op worker
    return { worker: undefined as unknown as Worker<T, R, Name> }
  }
  const connection = (redis as Redis).duplicate()
  const opts: WorkerOptions = { connection }
  const worker = new Worker<T, R, Name>(name, processor, opts)
  return { worker }
}
