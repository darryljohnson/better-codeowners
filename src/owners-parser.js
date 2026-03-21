import path from 'path';

/**
 * Parses an OWNERS file and returns an array of usernames.
 * @param {string} content Content of the OWNERS file.
 * @returns {string[]} Array of usernames.
 */
function parseOwnersFile(content) {
  if (!content) return [];
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.startsWith('@') ? line.substring(1) : line);
}

/**
 * Resolves all owners for a given file path by traversing up the directory tree.
 * @param {string} file Relative path to the file.
 * @param {string} repoRoot Absolute path to the repository root (not used in async mode).
 * @param {Function} fetchFile Function(path) => Promise<string|null>
 * @returns {Promise<string[]>} Combined list of unique owner usernames.
 */
async function resolveOwners(file, repoRoot, fetchFile) {
  const owners = new Set();
  let currentDir = path.dirname(file);

  while (true) {
    const ownersPath = path.join(currentDir, 'OWNERS');
    // Normalize path to use forward slashes for consistency (e.g. for GitHub API)
    const normalizedPath = ownersPath.replace(/\\/g, '/').replace(/^\.\//, '');
    
    const content = await fetchFile(normalizedPath);
    if (content) {
      parseOwnersFile(content).forEach(u => owners.add(u));
    }

    if (currentDir === '.' || currentDir === '/' || currentDir === '') break;
    currentDir = path.dirname(currentDir);
  }

  return Array.from(owners);
}

export {
  parseOwnersFile,
  resolveOwners
};
