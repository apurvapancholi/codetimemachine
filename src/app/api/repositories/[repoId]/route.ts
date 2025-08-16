import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const REPOS_DIR = path.join(process.cwd(), "cloned-repos");

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const { repoId } = await params;
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

    // Delete the repository directory recursively
    await fs.rm(repoPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: `Repository "${repoId}" deleted successfully`,
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete repository" },
      { status: 500 }
    );
  }
}