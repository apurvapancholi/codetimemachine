import { NextResponse } from "next/server";
import { repositoryStore } from "@/lib/repository-store";

export async function GET() {
  try {
    // Transform to match the expected format for the frontend
    const transformedRepos = repositoryStore.getAll().map(repo => ({
      id: `${repo.owner}-${repo.repo}`,
      name: repo.fullName,
      path: `${repo.owner}/${repo.repo}`, // Virtual path for GitHub repos
      clonedAt: repo.addedAt,
    }));

    // Sort by most recently added
    transformedRepos.sort((a, b) => new Date(b.clonedAt).getTime() - new Date(a.clonedAt).getTime());

    return NextResponse.json({ repositories: transformedRepos });
  } catch (error) {
    console.error("Error listing repositories:", error);
    return NextResponse.json(
      { error: "Failed to list repositories" },
      { status: 500 }
    );
  }
}

