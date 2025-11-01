/**
 * Job Processor
 *
 * Orchestrates the entire code change workflow by coordinating all services.
 * Main entry point for processing background jobs.
 *
 * Extracted from worker.ts lines 25-165
 */

import { GitHubService } from '../services/github.service';
import { GitService } from '../services/git.service';
import { SandboxService } from '../services/sandbox.service';
import { AIService } from '../services/ai.service';
import { generateBranchName, extractKeywords } from '../utils/helpers';

export class JobProcessor {
  private githubService: GitHubService;
  private gitService: GitService;
  private sandboxService: SandboxService;
  private aiService: AIService;

  constructor(githubToken: string) {
    this.githubService = new GitHubService(githubToken);
    this.gitService = new GitService();
    this.sandboxService = new SandboxService();
    this.aiService = new AIService();
  }

  /**
   * Process a code change job
   * Main workflow orchestration
   */
  async process(job: any): Promise<{ success: boolean; prUrl: string; prNumber: number }> {
    const { repoUrl, task } = job.data;
    const projectId = `job-${job.id}`;

    console.log(`Processing job ${job.id}: ${task}`);

    try {
      // Step 1: Ensure fork exists
      await job.updateProgress(10);
      console.log('Step 1: Ensuring fork exists...');
      const { forkUrl, forkOwner } = await this.githubService.ensureFork(repoUrl);

      // Step 2: Create or get sandbox
      await job.updateProgress(20);
      console.log('Step 2: Creating sandbox...');
      const sandbox = await this.sandboxService.getOrCreateSandbox(projectId);

      // Step 3: Clone repository
      await job.updateProgress(30);
      console.log('Step 3: Cloning repository...');
      const repoPath = await this.gitService.cloneRepository(sandbox, forkUrl);

      // Step 4: Find relevant files using LangGraph
      await job.updateProgress(40);
      console.log('Step 4: Finding relevant files...');
      const relevantFiles = await this.aiService.findRelevantFiles(sandbox, repoPath, task);

      // Step 5: Select files to modify using LLM
      console.log('Step 5: Selecting files to modify...');
      const keywords = extractKeywords(task);
      const filesToModify = await this.aiService.selectFilesToModify(sandbox, task, relevantFiles);

      // Step 6: Read file contents and get project structure
      await job.updateProgress(60);
      console.log('Step 6: Reading file contents...');
      const fileContents = await this.sandboxService.getFileContents(sandbox, filesToModify);
      const allFiles = await this.sandboxService.getFileTree(sandbox, repoPath);

      // Step 7: Generate code changes using AI
      await job.updateProgress(70);
      console.log('Step 7: Generating code changes...');
      const generation = await this.aiService.generateCodeChanges(
        repoUrl,
        task,
        fileContents,
        relevantFiles,
        allFiles,
        keywords
      );

      // Step 8: Execute file operations
      await job.updateProgress(80);
      console.log('Step 8: Executing file operations...');
      await this.sandboxService.executeFileOperations(sandbox, generation.fileOperations, repoPath);

      // Step 9: Run shell commands if needed
      if (generation.shellCommands && generation.shellCommands.length > 0) {
        console.log('Step 9: Running shell commands...');
        await this.sandboxService.runShellCommands(sandbox, generation.shellCommands, repoPath);
      }

      // Step 10: Create branch, commit, and push
      await job.updateProgress(90);
      console.log('Step 10: Committing and pushing changes...');
      const branchName = generateBranchName();
      await this.gitService.commitAndPush(
        sandbox,
        repoPath,
        branchName,
        `feat: ${task}`,
        forkUrl,
        process.env.GITHUB_ACCESS_TOKEN!
      );

      // Step 11: Create pull request
      console.log('Step 11: Creating pull request...');
      const pr = await this.githubService.createPullRequest(
        repoUrl,
        forkOwner,
        branchName,
        task,
        generation.explanation
      );

      // Step 12: Cleanup
      await job.updateProgress(100);
      console.log('Step 12: Cleaning up...');
      await this.sandboxService.cleanup(projectId);

      console.log(`Job ${job.id} completed. PR: ${pr.url}`);

      return {
        success: true,
        prUrl: pr.url,
        prNumber: pr.number
      };

    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      await this.sandboxService.cleanup(projectId);
      throw error;
    }
  }
}
