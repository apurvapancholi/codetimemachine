// Shared repository store for GitHub repositories
// In production, this would be replaced with a database

export interface GitHubRepo {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  addedAt: string;
}

// In-memory storage - in production, use a database
const repositories: GitHubRepo[] = [];

export const repositoryStore = {
  // Get all repositories
  getAll(): GitHubRepo[] {
    return [...repositories];
  },

  // Add a new repository
  add(repo: GitHubRepo): void {
    const existing = repositories.find(r => r.fullName === repo.fullName);
    if (!existing) {
      repositories.push(repo);
    }
  },

  // Find a repository by full name
  findByFullName(fullName: string): GitHubRepo | undefined {
    return repositories.find(r => r.fullName === fullName);
  },

  // Find a repository by ID (owner-repo format)
  findById(id: string): GitHubRepo | undefined {
    const parts = id.split('-');
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts.slice(1).join('-');
      const fullName = `${owner}/${repo}`;
      return this.findByFullName(fullName);
    }
    return undefined;
  },

  // Remove a repository
  remove(fullName: string): boolean {
    const index = repositories.findIndex(r => r.fullName === fullName);
    if (index >= 0) {
      repositories.splice(index, 1);
      return true;
    }
    return false;
  }
};