import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";

const REPOS_DIR = path.join(process.cwd(), "cloned-repos");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

    const repoPath = path.join(REPOS_DIR, repoId);

    // Check if repository exists
    try {
      await fs.access(repoPath);
    } catch {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Get comprehensive repository context
    const git = simpleGit(repoPath);
    const fullLog = await git.log({ maxCount: 500 }); // Get more commits for full analysis
    const status = await git.status();
    
    // Get all files in repository
    let allFiles: string[] = [];
    try {
      const files = await fs.readdir(repoPath);
      allFiles = files.filter(f => !f.startsWith('.'));
    } catch (error) {
      console.error("Error reading files:", error);
    }

    // Analyze full commit history for comprehensive stats
    const commits = fullLog.all;
    const authorStats: { [author: string]: { commits: number; firstCommit: string; lastCommit: string } } = {};
    const businessFeatures: { [feature: string]: number } = {};
    const semanticCategories: { [category: string]: number } = {};
    const monthlyActivity: { [month: string]: number } = {};

    // Process all commits for complete analysis
    commits.forEach(commit => {
      // Author statistics
      if (!authorStats[commit.author_name]) {
        authorStats[commit.author_name] = {
          commits: 0,
          firstCommit: commit.date,
          lastCommit: commit.date
        };
      }
      authorStats[commit.author_name].commits++;
      if (new Date(commit.date) > new Date(authorStats[commit.author_name].lastCommit)) {
        authorStats[commit.author_name].lastCommit = commit.date;
      }
      if (new Date(commit.date) < new Date(authorStats[commit.author_name].firstCommit)) {
        authorStats[commit.author_name].firstCommit = commit.date;
      }

      // Business feature categorization
      const msg = commit.message.toLowerCase();
      let businessFeature = "Core Development";
      if (msg.includes("auth") || msg.includes("login") || msg.includes("signup")) {
        businessFeature = "Authentication";
      } else if (msg.includes("user") || msg.includes("profile")) {
        businessFeature = "User Management";
      } else if (msg.includes("api") || msg.includes("endpoint")) {
        businessFeature = "API Development";
      } else if (msg.includes("ui") || msg.includes("frontend") || msg.includes("component")) {
        businessFeature = "UI/UX";
      } else if (msg.includes("database") || msg.includes("db") || msg.includes("migration")) {
        businessFeature = "Database";
      } else if (msg.includes("deploy") || msg.includes("ci") || msg.includes("build")) {
        businessFeature = "DevOps";
      } else if (msg.includes("test") || msg.includes("spec")) {
        businessFeature = "Testing";
      } else if (msg.includes("doc") || msg.includes("readme")) {
        businessFeature = "Documentation";
      }
      
      businessFeatures[businessFeature] = (businessFeatures[businessFeature] || 0) + 1;

      // Semantic categorization
      let category = "other";
      if (msg.includes("feat") || msg.includes("feature") || msg.includes("add")) {
        category = "feature";
      } else if (msg.includes("fix") || msg.includes("bug")) {
        category = "bugfix";
      } else if (msg.includes("refactor") || msg.includes("clean")) {
        category = "refactor";
      } else if (msg.includes("test") || msg.includes("spec")) {
        category = "testing";
      } else if (msg.includes("doc") || msg.includes("readme")) {
        category = "documentation";
      } else if (msg.includes("perf") || msg.includes("optimize")) {
        category = "performance";
      } else if (msg.includes("security") || msg.includes("auth")) {
        category = "security";
      }
      
      semanticCategories[category] = (semanticCategories[category] || 0) + 1;

      // Monthly activity
      const month = new Date(commit.date).toISOString().substring(0, 7); // YYYY-MM
      monthlyActivity[month] = (monthlyActivity[month] || 0) + 1;
    });

    // Calculate repository timeline
    const firstCommit = commits[commits.length - 1];
    const lastCommit = commits[0];
    const totalDays = firstCommit && lastCommit ? 
      Math.ceil((new Date(lastCommit.date).getTime() - new Date(firstCommit.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Prepare comprehensive context for AI
    const repoContext = {
      name: repoId,
      summary: {
        totalCommits: commits.length,
        totalAuthors: Object.keys(authorStats).length,
        repositoryAge: totalDays,
        firstCommit: firstCommit?.date,
        lastCommit: lastCommit?.date,
        currentBranch: status.current,
        totalFiles: allFiles.length,
      },
      recentCommits: commits.slice(0, 10).map(commit => ({
        hash: commit.hash.substring(0, 8),
        message: commit.message,
        author: commit.author_name,
        date: commit.date,
      })),
      authorStatistics: Object.entries(authorStats)
        .sort(([,a], [,b]) => b.commits - a.commits)
        .slice(0, 10)
        .map(([author, stats]) => ({
          author,
          totalCommits: stats.commits,
          firstCommit: stats.firstCommit,
          lastCommit: stats.lastCommit,
          percentage: Math.round((stats.commits / commits.length) * 100)
        })),
      businessFeatures: Object.entries(businessFeatures)
        .sort(([,a], [,b]) => b - a)
        .map(([feature, count]) => ({
          feature,
          commits: count,
          percentage: Math.round((count / commits.length) * 100)
        })),
      semanticCategories: Object.entries(semanticCategories)
        .sort(([,a], [,b]) => b - a)
        .map(([category, count]) => ({
          category,
          commits: count,
          percentage: Math.round((count / commits.length) * 100)
        })),
      monthlyActivity: Object.entries(monthlyActivity)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // Last 12 months
        .map(([month, count]) => ({ month, commits: count })),
      files: allFiles.slice(0, 20), // Show more files for context
    };

    // Create AI prompt with comprehensive repository context
    const systemPrompt = `You are an AI assistant helping users understand and analyze Git repositories. You have access to comprehensive repository information including complete commit history, author statistics, business feature analysis, and file structure.

REPOSITORY OVERVIEW:
- Name: ${repoContext.name}
- Total Commits: ${repoContext.summary.totalCommits}
- Total Authors: ${repoContext.summary.totalAuthors}
- Repository Age: ${repoContext.summary.repositoryAge} days
- First Commit: ${repoContext.summary.firstCommit ? new Date(repoContext.summary.firstCommit).toLocaleDateString() : 'N/A'}
- Last Commit: ${repoContext.summary.lastCommit ? new Date(repoContext.summary.lastCommit).toLocaleDateString() : 'N/A'}
- Current Branch: ${repoContext.summary.currentBranch}
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

REPOSITORY FILES (Sample):
${repoContext.files.join(', ')}

Please answer the user's question based on this comprehensive repository analysis. You can provide specific statistics, percentages, trends, and insights based on the complete data above. Be detailed and accurate in your responses.`;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
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