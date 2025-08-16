import { NextRequest, NextResponse } from "next/server";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs/promises";

const REPOS_DIR = path.join(process.cwd(), "cloned-repos");

export async function POST(request: NextRequest) {
  try {
    const { repoUrl } = await request.json();

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    const repoName = path.basename(repoUrl, ".git");

    // Check if repository is already cloned
    try {
      await fs.mkdir(REPOS_DIR, { recursive: true });
      const existingDirs = await fs.readdir(REPOS_DIR);
      const existingRepo = existingDirs.find(dir => dir.startsWith(repoName + '-'));
      
      if (existingRepo) {
        return NextResponse.json({
          success: true,
          path: path.join(REPOS_DIR, existingRepo),
          folderName: existingRepo,
          message: `Repository "${existingRepo}" already cloned`,
          alreadyExists: true,
        });
      }
    } catch (error) {
      // Continue with cloning if checking fails
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folderName = `${repoName}-${timestamp}`;
    const cloneDir = path.join(REPOS_DIR, folderName);

    const git = simpleGit();
    
    // Clone with full history for complete time machine analysis
    // --no-single-branch ensures we get all branches
    // No depth limit means we get full history
    await git.clone(repoUrl, cloneDir, [
      '--no-single-branch'
    ]);

    return NextResponse.json({
      success: true,
      path: cloneDir,
      folderName: folderName,
      message: `Repository "${folderName}" cloned successfully`,
      alreadyExists: false,
    });
  } catch (error) {
    console.error("Clone error:", error);
    return NextResponse.json(
      { error: "Failed to clone repository. Please check the URL and try again." },
      { status: 500 }
    );
  }
}