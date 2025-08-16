import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const REPOS_DIR = path.join(process.cwd(), "cloned-repos");

export async function GET() {
  try {
    let repositories = [];
    
    try {
      const items = await fs.readdir(REPOS_DIR);
      
      for (const item of items) {
        const itemPath = path.join(REPOS_DIR, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          repositories.push({
            id: item,
            name: item,
            path: itemPath,
            clonedAt: stats.ctime.toISOString(),
          });
        }
      }
    } catch (error) {
      console.log("No repositories directory found yet");
    }

    repositories.sort((a, b) => new Date(b.clonedAt).getTime() - new Date(a.clonedAt).getTime());

    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Error listing repositories:", error);
    return NextResponse.json(
      { error: "Failed to list repositories" },
      { status: 500 }
    );
  }
}