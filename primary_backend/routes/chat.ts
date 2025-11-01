import { Router } from 'express';
import { workerQueue } from '../src/config/queues';

const router = Router();

// POST /chat - Add job to queue and return immediately
router.post('/', async (req, res) => {
  try {
    const { userRequest, repoUrl } = req.body;

    // Validation
    if (!userRequest || !repoUrl) {
      return res.status(400).json({
        error: 'Missing required fields: userRequest, repoUrl, projectId',
      });
    }

    // Add job to queue
    const job = await workerQueue.add('handle-worker-queue', {
      userRequest,
      repoUrl,
      timestamp: Date.now(),
    });

    console.log(`Job queued: ${job.id}`);

    // Return immediately (non-blocking)
    res.status(202).json({
      message: 'Job queued successfully',
      jobId: job.id,
      status: 'queued',
      statusUrl: `/chat/status/${job.id}`,
    });

  } catch (error: any) {
    console.error('Error queuing job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /chat/status/:jobId - Check job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await workerQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({
      jobId: job.id,
      state, // 'waiting', 'active', 'completed', 'failed'
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
