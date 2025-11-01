import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;

console.log('Starting Primary Backend');

// Redis connection for queue
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const chatQueue = new Queue('worker-job', { connection });

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes - ONLY add to queue
app.post('/api/chat', async (req, res) => {
  try {
    const { repoUrl, task } = req.body;

    if (!repoUrl || !task) {
      return res.status(400).json({ error: 'Missing repoUrl or task' });
    }

    const job = await chatQueue.add('process', { repoUrl, task });

    res.status(202).json({
      message: 'Task queued',
      jobId: job.id,
      statusUrl: `/api/status/${job.id}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check job status
app.get('/api/status/:jobId', async (req, res) => {
  try {
    const job = await chatQueue.getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      state: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'primary-backend' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`CORS enabled for: ${FRONTEND_URL}`);
  console.log(`Queue: Redis on ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
});
