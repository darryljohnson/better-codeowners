import { resolveOwners, parseOwnersFile } from '../src/owners-parser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple mock for testing
function test() {
    const tempDir = path.join(__dirname, 'temp_test_repo');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    // Create structure:
    // /OWNERS (alice)
    // /sub/OWNERS (bob)
    // /sub/file.txt
    // /other/file.txt

    fs.writeFileSync(path.join(tempDir, 'OWNERS'), 'alice\n@charlie');
    fs.mkdirSync(path.join(tempDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'sub', 'OWNERS'), 'bob');
    fs.writeFileSync(path.join(tempDir, 'sub', 'file.txt'), 'hello');
    fs.mkdirSync(path.join(tempDir, 'other'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'other', 'file.txt'), 'world');

    console.log('Testing resolveOwners for sub/file.txt...');
    const ownersSub = resolveOwners('sub/file.txt', tempDir);
    console.log('Owners:', ownersSub);
    if (ownersSub.includes('alice') && ownersSub.includes('bob') && ownersSub.includes('charlie')) {
        console.log('✅ Success: Nested owners resolved correctly.');
    } else {
        console.error('❌ Failure: Nested owners resolution failed.');
    }

    console.log('\nTesting resolveOwners for other/file.txt...');
    const ownersOther = resolveOwners('other/file.txt', tempDir);
    console.log('Owners:', ownersOther);
    if (ownersOther.includes('alice') && ownersOther.includes('charlie') && !ownersOther.includes('bob')) {
        console.log('✅ Success: Top-level owners resolved correctly.');
    } else {
        console.error('❌ Failure: Top-level owners resolution failed.');
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
}

test();
