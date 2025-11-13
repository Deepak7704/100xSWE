import { App } from '@octokit/app';

// Validate environment variables
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_WEBHOOK_SECRET) {
  throw new Error('Missing GitHub App credentials');
}

// Initialize GitHub App with Octokit
const app = new App({
  appId: GITHUB_APP_ID,
  privateKey: GITHUB_APP_PRIVATE_KEY,
  webhooks: {
    secret: GITHUB_WEBHOOK_SECRET,
  },
});

// Get authenticated Octokit instance for installation
export async function getInstallationOctokit(installationId: number) {
  console.log(`[GitHub App] Authenticating installation ${installationId}`);

  try {
    const octokit = await app.getInstallationOctokit(installationId);
    console.log(`[GitHub App] Authenticated installation ${installationId}`);
    return octokit;
  } catch (error: any) {
    console.error(`[GitHub App] Auth failed:`, error.message);
    throw new Error(`Failed to authenticate installation: ${error.message}`);
  }
}

// Get raw installation token (for git clone, etc.)
export async function getInstallationToken(installationId: number): Promise<string> {
  console.log(`[GitHub App] Generating token for installation ${installationId}`);

  try {
    const octokit = await app.getInstallationOctokit(installationId);
    const { token } = await octokit.auth({ type: 'installation' }) as { token: string };
    console.log(`[GitHub App] Token generated for installation ${installationId}`);
    return token;
  } catch (error: any) {
    console.error(`[GitHub App] Token generation failed:`, error.message);
    throw new Error(`Failed to generate token: ${error.message}`);
  }
}

// Verify webhook signature
export async function verifyWebhookSignature(payload: Buffer | string, signature: string): Promise<boolean> {
  if (!signature) return false;

  try {
    const payloadString = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    return await app.webhooks.verify(payloadString, signature);
  } catch (error) {
    console.error('[GitHub App] Signature verification failed');
    return false;
  }
}

// Helper: Get repository details
export async function getRepository(installationId: number, owner: string, repo: string) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await (octokit as any).rest.repos.get({ owner, repo });
  return data;
}

// Helper: Create pull request
export async function createPullRequest(
  installationId: number,
  owner: string,
  repo: string,
  params: { title: string; body: string; head: string; base: string }
) {
  const octokit = await getInstallationOctokit(installationId);
  console.log(`[GitHub App] Creating PR: ${params.title}`);

  const { data } = await (octokit as any).rest.pulls.create({
    owner,
    repo,
    ...params,
  });

  console.log(`[GitHub App] PR created: #${data.number}`);
  return data;
}

// Helper: Get file contents
export async function getContents(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref?: string
) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await (octokit as any).rest.repos.getContent({
    owner,
    repo,
    path,
    ...(ref && { ref }),
  });
  return data;
}

export default app;
