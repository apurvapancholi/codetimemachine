import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { 
  fetchCompleteCommitHistory, 
  analyzeRepositoryData,
  type AnalysisResult,
  type CommitAnalysis
} from "@/lib/github-analysis";

interface FileOwnership {
  file: string;
  authors: { [author: string]: number };
  lastModified: string;
  complexity: number;
}

function parseRepoId(repoId: string): { owner: string; repo: string } | null {
  const parts = repoId.split('-');
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts.slice(1).join('-');
    return { owner, repo };
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const { repoId } = await params;
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
    try {
      await octokit.rest.repos.get({ owner, repo });
    } catch {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Fetch complete commit history
    const commits = await fetchCompleteCommitHistory(octokit, owner, repo);

    // Analyze repository data using shared function
    const analysisData = await analyzeRepositoryData(octokit, owner, repo, commits);
    
    // Note: File ownership analysis would require additional API calls
    // For now, we'll return an empty array
    const fileOwnership: FileOwnership[] = [];
    
    const result = {
      ...analysisData,
      fileOwnership,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze repository" },
      { status: 500 }
    );
  }
}