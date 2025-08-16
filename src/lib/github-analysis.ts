import { Octokit } from "@octokit/rest";

export interface CommitAnalysis {
  hash: string;
  date: string;
  author: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  complexity: number;
  semanticCategory: string;
  businessImpact: string;
}

export interface AnalysisResult {
  commits: CommitAnalysis[];
  complexityTrends: { date: string; complexity: number }[];
  authorContributions: { author: string; commits: number; linesChanged: number }[];
  businessFeatures: { feature: string; commits: string[]; timeline: string[] }[];
}

export function categorizeCommit(message: string): { category: string; impact: string } {
  const msg = message.toLowerCase();
  
  let category = "other";
  let impact = "maintenance";
  
  if (msg.includes("feat") || msg.includes("feature") || msg.includes("add")) {
    category = "feature";
    impact = "enhancement";
  } else if (msg.includes("fix") || msg.includes("bug")) {
    category = "bugfix";
    impact = "stability";
  } else if (msg.includes("refactor") || msg.includes("clean")) {
    category = "refactor";
    impact = "technical debt";
  } else if (msg.includes("test") || msg.includes("spec")) {
    category = "testing";
    impact = "quality";
  } else if (msg.includes("doc") || msg.includes("readme")) {
    category = "documentation";
    impact = "usability";
  } else if (msg.includes("perf") || msg.includes("optimize")) {
    category = "performance";
    impact = "performance";
  } else if (msg.includes("security") || msg.includes("auth")) {
    category = "security";
    impact = "security";
  }
  
  return { category, impact };
}

export function extractBusinessFeature(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("auth") || msg.includes("login") || msg.includes("signup")) {
    return "Authentication";
  } else if (msg.includes("user") || msg.includes("profile")) {
    return "User Management";
  } else if (msg.includes("api") || msg.includes("endpoint")) {
    return "API Development";
  } else if (msg.includes("ui") || msg.includes("frontend") || msg.includes("component")) {
    return "UI/UX";
  } else if (msg.includes("database") || msg.includes("db") || msg.includes("migration")) {
    return "Database";
  } else if (msg.includes("deploy") || msg.includes("ci") || msg.includes("build")) {
    return "DevOps";
  } else if (msg.includes("test") || msg.includes("spec")) {
    return "Testing";
  } else if (msg.includes("doc") || msg.includes("readme")) {
    return "Documentation";
  }
  
  return "Core Development";
}

interface ComplexityStats {
  files?: number;
  insertions?: number;
  deletions?: number;
}

export function calculateComplexity(stats: ComplexityStats): number {
  const files = stats.files || 0;
  const insertions = stats.insertions || 0;
  const deletions = stats.deletions || 0;
  
  return Math.min(100, Math.log(files + 1) * 10 + Math.log(insertions + deletions + 1) * 5);
}

export async function fetchCompleteCommitHistory(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Array<{
  sha: string;
  commit: {
    message: string;
    author?: { name?: string; date?: string };
  };
  author?: { login?: string };
}>> {
  let allCommits: Array<{
    sha: string;
    commit: {
      message: string;
      author?: { name?: string; date?: string };
    };
    author?: { login?: string };
  }> = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  console.log(`Fetching complete commit history for ${owner}/${repo}...`);
  
  while (hasMore && allCommits.length < 1000) { // Limit to 1000 commits to avoid timeouts
    try {
      const { data: commits } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
        page: page,
      });

      if (commits.length === 0) {
        hasMore = false;
      } else {
        allCommits = [...allCommits, ...commits];
        console.log(`Fetched page ${page}: ${commits.length} commits (total: ${allCommits.length})`);
        page++;
        
        // If we get less than the full page, we've reached the end
        if (commits.length < perPage) {
          hasMore = false;
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMore = false;
    }
  }

  console.log(`Total commits fetched: ${allCommits.length}`);
  return allCommits;
}

export async function analyzeRepositoryData(
  octokit: Octokit,
  owner: string,
  repo: string,
  commits: Array<{
    sha: string;
    commit: {
      message: string;
      author?: { name?: string; date?: string };
    };
    author?: { login?: string };
  }>
): Promise<AnalysisResult> {
  const commitAnalyses: CommitAnalysis[] = [];
  const authorStats: { [author: string]: { commits: number; lines: number } } = {};
  const businessFeatures: { [feature: string]: { commits: string[]; timeline: string[] } } = {};

  // Process commits with selective detailed information
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const { category, impact } = categorizeCommit(commit.commit.message);
    const businessFeature = extractBusinessFeature(commit.commit.message);
    
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    // Only fetch detailed stats for recent commits (first 50) to avoid rate limits
    // For older commits, use estimation to preserve API quota
    if (i < 50) {
      try {
        const { data: commitDetails } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha,
        });

        filesChanged = commitDetails.files?.length || 0;
        insertions = commitDetails.stats?.additions || 0;
        deletions = commitDetails.stats?.deletions || 0;
      } catch {
        console.warn(`Failed to fetch details for commit ${commit.sha.substring(0, 8)}, using estimation`);
        // Fallback to estimation
        const messageLength = commit.commit.message.length;
        filesChanged = Math.max(1, Math.floor(messageLength / 50));
        insertions = Math.max(5, Math.floor(messageLength / 10));
        deletions = Math.max(0, Math.floor(messageLength / 20));
      }
    } else {
      // Use estimation for older commits to save API calls
      const messageLength = commit.commit.message.length;
      filesChanged = Math.max(1, Math.floor(messageLength / 50));
      insertions = Math.max(5, Math.floor(messageLength / 10));
      deletions = Math.max(0, Math.floor(messageLength / 20));
    }

    const complexity = calculateComplexity({ files: filesChanged, insertions, deletions });
    const authorName = commit.commit.author?.name || commit.author?.login || "Unknown";
    
    const commitAnalysis: CommitAnalysis = {
      hash: commit.sha,
      date: commit.commit.author?.date || new Date().toISOString(),
      author: authorName,
      message: commit.commit.message,
      filesChanged,
      insertions,
      deletions,
      complexity,
      semanticCategory: category,
      businessImpact: impact,
    };
    
    commitAnalyses.push(commitAnalysis);
    
    if (!authorStats[authorName]) {
      authorStats[authorName] = { commits: 0, lines: 0 };
    }
    authorStats[authorName].commits++;
    authorStats[authorName].lines += insertions + deletions;
    
    if (!businessFeatures[businessFeature]) {
      businessFeatures[businessFeature] = { commits: [], timeline: [] };
    }
    businessFeatures[businessFeature].commits.push(commit.sha);
    businessFeatures[businessFeature].timeline.push(commit.commit.author?.date || new Date().toISOString());
  }
  
  const authorContributions = Object.entries(authorStats).map(([author, stats]) => ({
    author,
    commits: stats.commits,
    linesChanged: stats.lines,
  }));
  
  const complexityTrends = commitAnalyses
    .reverse()
    .map(commit => ({
      date: commit.date,
      complexity: commit.complexity,
    })); // Include ALL commits for complete historical analysis
  
  const businessFeaturesArray = Object.entries(businessFeatures).map(([feature, data]) => ({
    feature,
    commits: data.commits,
    timeline: data.timeline,
  }));
  
  return {
    commits: commitAnalyses.reverse(),
    complexityTrends,
    authorContributions,
    businessFeatures: businessFeaturesArray,
  };
}