# GitHub Webhook Implementation Guide

## Overview

This guide explains the GitHub webhook implementation for the OpenSWE project. The webhook allows your application to automatically respond to GitHub events (like code pushes and pull requests) in real-time.

---

## Architecture

```
GitHub Repository
    ↓ (event occurs: push, PR, etc.)
    ↓
GitHub Webhook System
    ↓ (HTTP POST with signed payload)
    ↓
Your Server: POST /webhook/github
    ↓
Signature Verification (HMAC-SHA256)
    ↓
Event Processing & Queue Job
    ↓
BullMQ Redis Queue
    ↓
Worker Processes Job
```

---

## Files Modified/Created

### 1. **New File**: `primary_backend/routes/webhook.ts`

This is the main webhook handler that:
- Receives webhook events from GitHub
- Verifies the signature to ensure authenticity
- Processes different event types (push, pull_request, ping, etc.)
- Queues indexing jobs based on events

**Key Functions:**

#### `verifySignature(payload: Buffer, signature: string): boolean`
- **Purpose**: Verifies that webhook requests actually come from GitHub
- **How it works**:
  1. GitHub signs the webhook payload using HMAC-SHA256 with your secret
  2. They send this signature in the `X-Hub-Signature-256` header
  3. We compute the same signature using the raw request body
  4. If signatures match → legitimate GitHub request ✅
  5. If signatures don't match → reject request ❌

**Security Note**: Uses `crypto.timingSafeEqual()` to prevent timing attacks

#### `POST /webhook/github`
Main webhook endpoint that handles these events:

| Event Type | Trigger | Action |
|------------|---------|--------|
| `push` | Code pushed to branch | Queues re-indexing job for updated code |
| `pull_request` | PR opened/updated | Queues indexing job for PR branch |
| `ping` | Webhook first created | Confirms webhook is connected |
| `repository` | Repo created/deleted/etc. | Logs event (no action) |
| Others | Various events | Acknowledges but doesn't process |

---

### 2. **Modified**: `primary_backend/src/server.ts`

#### Changes Made:

**a) Import webhook route** (Line 6):
```typescript
import webhookRoute from '../routes/webhook';
```

**b) Configure raw body parser** (Lines 29-39):
```typescript
app.use(express.json({
  limit: '10mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf;  // Store raw buffer for signature verification
  }
}));
```

**Why this is critical:**
- GitHub signs the **raw** payload (bytes as sent)
- Express by default parses JSON immediately
- JSON parsing normalizes the data (whitespace, key order)
- If we compute signature on parsed JSON, it won't match GitHub's signature
- The `verify` callback runs **before** JSON parsing and stores the original bytes

**c) Mount webhook route** (Line 162):
```typescript
app.use('/webhook', webhookRoute);
```

This makes the webhook accessible at: `http://your-domain.com/webhook/github`

---

### 3. **Modified**: `primary_backend/.env`

Added GitHub webhook secret:
```env
GITHUB_WEBHOOK_SECRET = "hemanth"
```

**Important**:
- This secret must match what you configure in GitHub
- For production, generate a strong random secret:
  ```bash
  openssl rand -hex 32
  ```
- Never commit this to version control (already in `.gitignore`)

---

## How Signature Verification Works

### Step-by-Step Process:

1. **GitHub Side**:
   ```
   payload = { "repository": {...}, "commits": [...], ... }
   signature = HMAC_SHA256(secret, payload)
   headers = {
     "X-Hub-Signature-256": "sha256=abc123...",
     "X-GitHub-Event": "push",
     ...
   }
   ```

2. **Your Server Receives**:
   ```
   raw_body = <Buffer 7b 22 72 65 70 6f ...>  // Raw bytes
   signature_from_github = "sha256=abc123..."
   ```

3. **Verification**:
   ```typescript
   // Compute signature on YOUR end using raw body
   const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
   const your_signature = 'sha256=' + hmac.update(raw_body).digest('hex');

   // Compare using timing-safe function
   if (timingSafeEqual(your_signature, signature_from_github)) {
     // ✅ Valid - process event
   } else {
     // ❌ Invalid - reject (possible attack)
   }
   ```

### Why This Matters:
- **Without verification**: Anyone could send fake webhook requests to your server
- **With verification**: Only GitHub (who knows the secret) can send valid requests
- **Prevents**: Unauthorized triggering of expensive operations (indexing, deployments, etc.)

---

## Supported Webhook Events

### 1. Push Event
**Trigger**: Code is pushed to any branch

**Payload Example**:
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "owner/repo",
    "clone_url": "https://github.com/owner/repo.git"
  },
  "pusher": {
    "name": "john_doe"
  },
  "commits": [
    { "message": "Fix bug", "id": "abc123" },
    { "message": "Add feature", "id": "def456" }
  ]
}
```

**What Happens**:
1. Extracts branch name from `ref` (e.g., "main")
2. Queues indexing job with retry logic:
   ```typescript
   {
     projectId: "owner/repo",
     branch: "main",
     trigger: "webhook",
     event: "push",
     pusher: "john_doe",
     commits: 2
   }
   ```
3. Returns job ID and status URL

**Response**:
```json
{
  "message": "Push event processed successfully",
  "event": "push",
  "repository": "owner/repo",
  "branch": "main",
  "jobId": "12345",
  "statusUrl": "/api/index-status/12345"
}
```

---

### 2. Pull Request Event
**Trigger**: PR opened, closed, reopened, synchronized (new commits pushed)

**Actions**:
- **opened**: Indexes PR branch for analysis
- **synchronize**: Re-indexes when new commits pushed
- **closed/reopened**: Just logs (no indexing)

**Payload Example**:
```json
{
  "action": "opened",
  "pull_request": {
    "number": 42,
    "title": "Add new feature",
    "head": {
      "ref": "feature-branch"
    }
  }
}
```

**What Happens**:
1. Extracts PR number, title, and branch
2. If action is "opened" or "synchronize":
   - Queues indexing job for the PR branch
   - Uses unique project ID: `owner/repo/pr-42`
3. Returns job details

---

### 3. Ping Event
**Trigger**: Webhook first created in GitHub (test event)

**Purpose**: Verifies your endpoint is accessible

**Response**:
```json
{
  "message": "Webhook is active",
  "event": "ping",
  "zen": "Design for failure."
}
```

---

## Setting Up GitHub Webhook

### Prerequisites:
1. Server must be publicly accessible (or use tunneling tool like ngrok for testing)
2. Server must be running on HTTPS in production (GitHub requires it)
3. Have the secret from your `.env` file ready

### Steps:

1. **Go to Repository Settings**:
   - Navigate to your GitHub repository
   - Click **Settings** → **Webhooks** → **Add webhook**

2. **Configure Webhook**:
   ```
   Payload URL: https://your-domain.com/webhook/github
   Content type: application/json
   Secret: [paste your GITHUB_WEBHOOK_SECRET]
   ```

3. **Select Events**:
   - Choose "Let me select individual events"
   - Check:
     - ✅ Pushes
     - ✅ Pull requests
     - (Optional) Add others as needed

4. **Activate**:
   - Check "Active"
   - Click **Add webhook**

5. **Test**:
   - GitHub immediately sends a "ping" event
   - Check "Recent Deliveries" tab
   - Should see 200 response code ✅

---

## Testing Locally with ngrok

For local development, you need to expose your localhost to the internet:

### 1. Install ngrok:
```bash
# Download from https://ngrok.com/download
# Or via brew (macOS)
brew install ngrok
```

### 2. Start your server:
```bash
cd primary_backend
bun run dev
```

### 3. Start ngrok tunnel:
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 4. Configure GitHub webhook:
```
Payload URL: https://abc123.ngrok.io/webhook/github
```

### 5. Test by pushing to your repo:
```bash
git commit -m "Test webhook" --allow-empty
git push
```

### 6. Monitor logs:
- **Terminal 1**: Your server logs
- **Terminal 2**: ngrok web interface at http://localhost:4040
- **GitHub**: Check webhook delivery status

---

## Request/Response Flow Example

### Scenario: Developer pushes code to main branch

**1. GitHub sends webhook**:
```http
POST /webhook/github HTTP/1.1
Host: your-domain.com
Content-Type: application/json
X-Hub-Signature-256: sha256=abc123...
X-GitHub-Event: push
X-GitHub-Delivery: 12345-67890

{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "owner/repo",
    "clone_url": "https://github.com/owner/repo.git"
  },
  "commits": [...]
}
```

**2. Your server processes**:
```
✓ Signature verified
✓ Event type: push
✓ Repository: owner/repo
✓ Branch: main
✓ Queuing indexing job...
✓ Job 67890 queued
```

**3. Server responds**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Push event processed successfully",
  "event": "push",
  "repository": "owner/repo",
  "branch": "main",
  "jobId": "67890",
  "statusUrl": "/api/index-status/67890"
}
```

**4. BullMQ processes job**:
- Worker picks up job from Redis queue
- Indexes repository code
- Updates vector database
- Marks job as complete

**5. Check status**:
```bash
curl http://your-domain.com/api/index-status/67890
```

---

## Error Handling

### 1. Invalid Signature (403)
**Cause**: Webhook secret mismatch or tampered request

**Response**:
```json
{
  "error": "Invalid signature",
  "message": "Webhook signature verification failed"
}
```

**Solution**: Verify `GITHUB_WEBHOOK_SECRET` matches GitHub webhook configuration

---

### 2. Missing Repository Info (400)
**Cause**: Malformed webhook payload

**Response**:
```json
{
  "error": "Missing repository information"
}
```

---

### 3. Processing Error (500)
**Cause**: Internal error (queue connection failed, etc.)

**Response**:
```json
{
  "error": "Webhook processing failed",
  "message": "Connection to Redis failed"
}
```

**GitHub Behavior**: Will retry webhook delivery (up to 3 times)

---

## Monitoring & Debugging

### Check Webhook Health:
```bash
curl http://your-domain.com/webhook/health
```

Response:
```json
{
  "status": "ok",
  "service": "webhook",
  "timestamp": "2025-11-09T12:00:00.000Z"
}
```

### Server Logs:
When webhook is received, you'll see:
```
=== Webhook Received ===
Event: push
Delivery ID: 12345-67890
Timestamp: 2025-11-09T12:00:00.000Z
✅ Signature verified
Repository: owner/repo
📦 Push to branch: main
👤 Pushed by: john_doe
📝 Commits: 3
✅ Indexing job queued: 67890
```

### GitHub Dashboard:
- Go to **Settings** → **Webhooks** → Click your webhook
- View **Recent Deliveries**
- See request/response for each delivery
- Redeliver failed webhooks manually

---

## Security Best Practices

### 1. Use Strong Secret
```bash
# Generate 32-byte random secret
openssl rand -hex 32
```

### 2. Always Verify Signatures
Never skip signature verification, even in development:
```typescript
if (!verifySignature(rawBody, signature)) {
  return res.status(403).json({ error: 'Invalid signature' });
}
```

### 3. Use HTTPS in Production
GitHub requires HTTPS for webhook endpoints (except localhost for testing)

### 4. Rate Limiting
Consider adding rate limiting to prevent abuse:
```typescript
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/webhook', webhookLimiter, webhookRoute);
```

### 5. Log Suspicious Activity
Log all failed verification attempts:
```typescript
if (!verifySignature(rawBody, signature)) {
  console.error(`⚠️ Invalid signature from IP: ${req.ip}`);
  // Consider alerting security team
}
```

---

## Queue Job Schema

Jobs queued by webhooks follow this structure:

```typescript
{
  projectId: string,        // "owner/repo" or "owner/repo/pr-42"
  repoUrl: string,          // "https://github.com/owner/repo"
  repoId: string,           // "owner/repo"
  branch: string,           // "main" or "feature-branch"
  timestamp: number,        // Unix timestamp
  trigger: 'webhook',       // Indicates webhook-triggered job
  event: string,            // "push" or "pull_request"

  // Push-specific fields
  pusher?: string,          // GitHub username
  commits?: number,         // Number of commits

  // PR-specific fields
  prNumber?: number,        // PR number
  action?: string,          // "opened", "synchronize", etc.
}
```

---

## Troubleshooting

### Issue: Webhook returns 403 Invalid Signature

**Causes**:
1. Secret in `.env` doesn't match GitHub webhook secret
2. Using parsed `req.body` instead of `req.rawBody`
3. Body-parser middleware running before webhook route

**Solution**:
```typescript
// ✅ Correct
const rawBody = (req as any).rawBody as Buffer;
if (!verifySignature(rawBody, signature)) { ... }

// ❌ Wrong
const rawBody = JSON.stringify(req.body); // Don't do this!
```

---

### Issue: `req.rawBody` is undefined

**Cause**: Missing `verify` function in JSON parser

**Solution**: Ensure this is in your server setup:
```typescript
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;  // This line is critical!
  }
}));
```

---

### Issue: GitHub shows "Recent delivery failed"

**Steps**:
1. Click on the failed delivery in GitHub
2. Check response code and body
3. Look at "Request" and "Response" tabs
4. Copy the delivery ID and check your server logs
5. Use "Redeliver" button to retry

---

### Issue: Jobs not processing

**Check**:
1. Redis connection: `redis-cli ping` → should return `PONG`
2. Worker running: Check worker process logs
3. Queue name matches: `indexingQueue` in both webhook and worker
4. Job in queue: Use BullMQ UI or check Redis keys

---

## Advanced: Custom Event Handlers

To handle additional GitHub events, add cases to the switch statement in `webhook.ts`:

```typescript
case 'issues':
  const issue = body.issue;
  console.log(`Issue #${issue.number}: ${body.action}`);
  // Your custom logic here
  return res.status(200).json({
    message: 'Issue event processed'
  });

case 'release':
  const release = body.release;
  console.log(`Release ${release.tag_name} ${body.action}`);
  // Trigger documentation build, deployment, etc.
  return res.status(200).json({
    message: 'Release event processed'
  });
```

---

## Testing Checklist

- [ ] Server starts without errors
- [ ] `/webhook/health` returns 200 OK
- [ ] GitHub webhook shows successful ping
- [ ] Push to repo triggers indexing job
- [ ] Job appears in queue (check Redis or BullMQ dashboard)
- [ ] Worker processes the job successfully
- [ ] Invalid signature request returns 403
- [ ] Logs show detailed event information
- [ ] Pull request creates indexing job
- [ ] Status endpoints return job information

---

## Summary

You now have a complete webhook implementation that:

✅ **Securely receives** GitHub events with signature verification
✅ **Processes events** like pushes and pull requests
✅ **Queues jobs** for asynchronous processing via BullMQ
✅ **Logs detailed information** for monitoring and debugging
✅ **Handles errors gracefully** with proper HTTP status codes
✅ **Scales easily** with queue-based architecture

The webhook automatically keeps your codebase index up-to-date whenever changes occur in GitHub!

---

## Next Steps

1. **Production Deployment**:
   - Deploy to cloud (AWS, Heroku, Vercel, etc.)
   - Configure HTTPS
   - Update GitHub webhook URL to production domain

2. **Monitoring**:
   - Set up logging service (Datadog, Sentry, etc.)
   - Monitor webhook delivery success rate
   - Alert on repeated failures

3. **Enhancements**:
   - Add webhook authentication beyond signatures
   - Implement webhook event replay
   - Create admin UI for webhook management
   - Add metrics and analytics

---

**Questions or Issues?** Check the logs first, then review the GitHub webhook delivery details!
