import fs from 'fs';
import path from 'path';

/**
 * Parses an OWNERS file and returns an array of usernames.
 * @param {string} filePath Path to the OWNERS file.
 * @returns {string[]} Array of usernames.
 */
function parseOwnersFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.startsWith('@') ? line.substring(1) : line);
}

/**
 * Resolves all owners for a given file path by traversing up the directory tree.
 * @param {string} file Relative path to the file.
 * @param {string} repoRoot Absolute path to the repository root.
 * @returns {string[]} Combined list of unique owner usernames.
 */
function resolveOwners(file, repoRoot) {
  const owners = new Set();
  let currentDir = path.dirname(file);

  while (true) {
    const ownersPath = path.join(repoRoot, currentDir, 'OWNERS');
    if (fs.existsSync(ownersPath)) {
      parseOwnersFile(ownersPath).forEach(u => owners.add(u));
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
