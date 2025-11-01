/**
 * Worker Entry Point
 *
 * 
 */

import { Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { JobProcessor } from './processors/job.processor';

dotenv.config();

// Redis connection for queue
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

// Validate GitHub token
const githubToken = process.env.GITHUB_ACCESS_TOKEN;
if (!githubToken) {
  throw new Error('GITHUB_ACCESS_TOKEN not configured');
}

// Create job processor
const processor = new JobProcessor(githubToken);

// Create and configure worker
const worker = new Worker('worker-job', async (job) => {
  return await processor.process(job);
}, { connection, concurrency: 2 });

// Event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log('Worker started');
