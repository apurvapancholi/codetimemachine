import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { repositoryStore, type GitHubRepo } from "@/lib/repository-store";

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Handle different GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/)?$/,
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { repoUrl } = await request.json();

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL. Please provide a valid GitHub repository URL." },
        { status: 400 }
      );
    }

    const { owner, repo } = parsed;
    const fullName = `${owner}/${repo}`;
    const repoId = `${owner}-${repo}`;

    // Check if repository is already added
    const existingRepo = repositoryStore.findByFullName(fullName);
    if (existingRepo) {
      return NextResponse.json({
        success: true,
        folderName: repoId,
        message: `Repository "${fullName}" already added`,
        alreadyExists: true,
        repoInfo: {
          owner,
          repo,
          fullName
        }
      });
    }

    // Verify repository exists and is accessible
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN, // Optional: for higher rate limits
    });

    try {
      const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      // Add repository to our storage
      const newRepo: GitHubRepo = {
        owner,
        repo,
        fullName,
        url: repoUrl,
        addedAt: new Date().toISOString()
      };
      repositoryStore.add(newRepo);

      return NextResponse.json({
        success: true,
        folderName: repoId,
        message: `Repository "${fullName}" added successfully`,
        alreadyExists: false,
        repoInfo: {
          owner,
          repo,
          fullName,
          description: repoData.description,
          stargazers_count: repoData.stargazers_count,
          language: repoData.language
        }
      });
    } catch (githubError: unknown) {
      console.error("GitHub API error:", githubError);
      return NextResponse.json(
        { error: "Repository not found or not accessible. Please check the URL and ensure the repository is public." },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Clone error:", error);
    return NextResponse.json(
      { error: "Failed to add repository. Please try again." },
      { status: 500 }
    );
  }
}

