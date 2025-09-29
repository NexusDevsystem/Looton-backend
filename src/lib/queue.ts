import { Queue, Worker, JobsOptions, Job, QueueOptions, WorkerOptions } from 'bullmq'
import { redis } from './redis.js'
import Redis from 'ioredis'

export function createQueue<Name extends string, T = unknown>(name: Name) {
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
  const connection = (redis as Redis).duplicate()
  const opts: WorkerOptions = { connection }
  const worker = new Worker<T, R, Name>(name, processor, opts)
  return { worker }
}
