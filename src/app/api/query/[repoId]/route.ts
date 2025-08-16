import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { 
  fetchCompleteCommitHistory, 
  analyzeRepositoryData,
  type CommitAnalysis
} from "@/lib/github-analysis";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function parseRepoId(repoId: string): { owner: string; repo: string } | null {
  const parts = repoId.split('-');
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts.slice(1).join('-');
    return { owner, repo };
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const { repoId } = await params;
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const parsed = parseRepoId(repoId);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid repository ID format" },
        { status: 400 }
      );
    }

    const { owner, repo } = parsed;

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN, // Optional: for higher rate limits
    });

    // Verify repository exists
    let repoData;
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      repoData = data;
    } catch {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Fetch complete commit history using shared function
    const commits = await fetchCompleteCommitHistory(octokit, owner, repo);

    // Analyze repository data using the same shared function as charts
    const analysisData = await analyzeRepositoryData(octokit, owner, repo, commits);

    // Get repository contents for file analysis
    let allFiles: string[] = [];
    try {
      const { data: contents } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });
      
      if (Array.isArray(contents)) {
        allFiles = contents
          .filter(item => item.type === 'file')
          .map(item => item.name)
          .slice(0, 20); // Limit for context
      }
    } catch (error) {
      console.error("Error reading files:", error);
    }

    // Build additional stats from the same analyzed commits that charts use
    const authorFirstLastCommits: { [author: string]: { firstCommit: string; lastCommit: string } } = {};
    const semanticCategories: { [category: string]: number } = {};
    const monthlyActivity: { [month: string]: number } = {};

    // Extract additional metadata from analyzed commits
    analysisData.commits.forEach(commit => {
      // Track first/last commit dates for each author
      if (!authorFirstLastCommits[commit.author]) {
        authorFirstLastCommits[commit.author] = {
          firstCommit: commit.date,
          lastCommit: commit.date
        };
      }
      if (new Date(commit.date) > new Date(authorFirstLastCommits[commit.author].lastCommit)) {
        authorFirstLastCommits[commit.author].lastCommit = commit.date;
      }
      if (new Date(commit.date) < new Date(authorFirstLastCommits[commit.author].firstCommit)) {
        authorFirstLastCommits[commit.author].firstCommit = commit.date;
      }

      // Semantic categories
      semanticCategories[commit.semanticCategory] = (semanticCategories[commit.semanticCategory] || 0) + 1;

      // Monthly activity
      const month = new Date(commit.date).toISOString().substring(0, 7); // YYYY-MM
      monthlyActivity[month] = (monthlyActivity[month] || 0) + 1;
    });

    // Calculate repository timeline
    const firstCommit = commits[commits.length - 1];
    const lastCommit = commits[0];
    const totalDays = firstCommit && lastCommit ? 
      Math.ceil((new Date(lastCommit.commit.author?.date || 0).getTime() - new Date(firstCommit.commit.author?.date || 0).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Prepare comprehensive context for AI using the SAME analyzed data as charts
    const repoContext = {
      name: `${owner}/${repo}`,
      summary: {
        totalCommits: analysisData.commits.length,
        totalAuthors: analysisData.authorContributions.length,
        repositoryAge: totalDays,
        firstCommit: analysisData.commits[analysisData.commits.length - 1]?.date,
        lastCommit: analysisData.commits[0]?.date,
        currentBranch: repoData.default_branch,
        totalFiles: allFiles.length,
        description: repoData.description,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
      recentCommits: analysisData.commits.slice(0, 10).map(commit => ({
        hash: commit.hash.substring(0, 8),
        message: commit.message,
        author: commit.author,
        date: commit.date,
        filesChanged: commit.filesChanged,
        insertions: commit.insertions,
        deletions: commit.deletions,
        complexity: commit.complexity,
      })),
      // Add complete commit timeline with EXACT SAME data as charts
      allCommits: (() => {
        const processedCommits = analysisData.commits.map(commit => ({
          hash: commit.hash.substring(0, 8),
          message: commit.message.split('\n')[0], // First line only to save space
          author: commit.author,
          date: commit.date,
          filesChanged: commit.filesChanged,
          insertions: commit.insertions,
          deletions: commit.deletions,
          complexity: commit.complexity,
          category: commit.semanticCategory,
          impact: commit.businessImpact,
        }));
        
        // For very large histories, prioritize recent commits and key milestones
        if (processedCommits.length > 500) {
          // Take recent 300 commits + every 5th commit from older history
          const recent = processedCommits.slice(0, 300);
          const older = processedCommits.slice(300).filter((_, index) => index % 5 === 0);
          return [...recent, ...older];
        }
        
        return processedCommits; // Include all commits if under 500
      })(),
      // Use EXACT SAME author data as charts
      authorStatistics: analysisData.authorContributions
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 10)
        .map(author => ({
          author: author.author,
          totalCommits: author.commits,
          linesChanged: author.linesChanged,
          firstCommit: authorFirstLastCommits[author.author]?.firstCommit || "Unknown",
          lastCommit: authorFirstLastCommits[author.author]?.lastCommit || "Unknown",
          percentage: Math.round((author.commits / analysisData.commits.length) * 100)
        })),
      // Use EXACT SAME business features data as charts
      businessFeatures: analysisData.businessFeatures
        .sort((a, b) => b.commits.length - a.commits.length)
        .map(feature => ({
          feature: feature.feature,
          commits: feature.commits.length,
          percentage: Math.round((feature.commits.length / analysisData.commits.length) * 100)
        })),
      semanticCategories: Object.entries(semanticCategories)
        .sort(([,a], [,b]) => b - a)
        .map(([category, count]) => ({
          category,
          commits: count,
          percentage: Math.round((count / analysisData.commits.length) * 100)
        })),
      monthlyActivity: Object.entries(monthlyActivity)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // Last 12 months
        .map(([month, count]) => ({ month, commits: count })),
      files: allFiles,
    };

    // Create AI prompt with EXACT SAME DATA as displayed in charts - grounded responses only
    const systemPrompt = `You are an AI assistant analyzing a GitHub repository. You have access to the EXACT SAME analyzed data that is displayed in the repository charts and graphs.

CRITICAL INSTRUCTIONS:
- Base your responses ONLY on the provided data below
- Do NOT add information from general knowledge about this repository
- Do NOT make assumptions beyond what is explicitly shown in the data
- Reference specific commits, statistics, and patterns from the provided context
- If asked about data not included in the context, clearly state it's not available in the current analysis

REPOSITORY OVERVIEW:
- Name: ${repoContext.name}
- Description: ${repoContext.summary.description || 'No description available'}
- Primary Language: ${repoContext.summary.language || 'Not specified'}
- Stars: ${repoContext.summary.stars}
- Forks: ${repoContext.summary.forks}
- Total Commits: ${repoContext.summary.totalCommits}
- Total Authors: ${repoContext.summary.totalAuthors}
- Repository Age: ${repoContext.summary.repositoryAge} days
- First Commit: ${repoContext.summary.firstCommit ? new Date(repoContext.summary.firstCommit).toLocaleDateString() : 'N/A'}
- Last Commit: ${repoContext.summary.lastCommit ? new Date(repoContext.summary.lastCommit).toLocaleDateString() : 'N/A'}
- Default Branch: ${repoContext.summary.currentBranch}
- Total Files: ${repoContext.summary.totalFiles}

AUTHOR STATISTICS (Top Contributors):
${repoContext.authorStatistics.map(author => 
  `- ${author.author}: ${author.totalCommits} commits (${author.percentage}%) - Active from ${new Date(author.firstCommit).toLocaleDateString()} to ${new Date(author.lastCommit).toLocaleDateString()}`
).join('\n')}

BUSINESS FEATURES BREAKDOWN:
${repoContext.businessFeatures.map(feature => 
  `- ${feature.feature}: ${feature.commits} commits (${feature.percentage}%)`
).join('\n')}

SEMANTIC COMMIT CATEGORIES:
${repoContext.semanticCategories.map(category => 
  `- ${category.category}: ${category.commits} commits (${category.percentage}%)`
).join('\n')}

RECENT MONTHLY ACTIVITY:
${repoContext.monthlyActivity.map(activity => 
  `- ${activity.month}: ${activity.commits} commits`
).join('\n')}

RECENT COMMITS (Last 10):
${repoContext.recentCommits.map(commit => 
  `${commit.hash} - ${commit.message} (by ${commit.author} on ${new Date(commit.date).toLocaleDateString()})`
).join('\n')}

COMPLETE COMMIT HISTORY (All ${repoContext.allCommits.length} commits for comprehensive analysis):
${repoContext.allCommits.map(commit => 
  `${commit.hash} - ${commit.message} (${commit.author}, ${new Date(commit.date).toLocaleDateString()})`
).join('\n')}

REPOSITORY FILES (Sample):
${repoContext.files.join(', ')}

Please answer the user's question based on this comprehensive repository analysis. You have access to the complete commit history above, including ${repoContext.allCommits.length} commits spanning from ${repoContext.summary.firstCommit ? new Date(repoContext.summary.firstCommit).toLocaleDateString() : 'N/A'} to ${repoContext.summary.lastCommit ? new Date(repoContext.summary.lastCommit).toLocaleDateString() : 'N/A'}. You can reference specific commits, analyze patterns, and provide detailed insights based on the complete data above.`;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4000, // Increased for comprehensive responses with complete git history
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    });

    const aiResponse = response.content[0];
    if (aiResponse.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }

    return NextResponse.json({
      success: true,
      response: aiResponse.text,
      context: repoContext,
    });

  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      { error: "Failed to process query" },
      { status: 500 }
    );
  }
}