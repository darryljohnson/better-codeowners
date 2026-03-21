import { resolveOwners } from '../src/owners-parser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testRepro() {
    console.log('--- Testing Bug Fix ---');

    // Simulate Base Branch Content
    const baseOwnersContent = 'admin';
    // Simulate PR Branch Content (Attacker adds themselves)
    const prOwnersContent = 'admin\nattacker';

    // This is what the FIXED version does: it fetches from the base branch
    const fetchFileBase = async (path) => {
        if (path === 'OWNERS') return baseOwnersContent;
        return null;
    };

    // This is what the BUGGY version did: it fetched from the PR branch (from disk)
    const fetchFilePR = async (path) => {
        if (path === 'OWNERS') return prOwnersContent;
        return null;
    };

    console.log('Case 1: Fetching from Base Branch (Fixed behavior)');
    const ownersFixed = await resolveOwners('somefile.txt', '.', fetchFileBase);
    console.log('Owners:', ownersFixed);

    if (!ownersFixed.includes('attacker')) {
        console.log('✅ Success: The attacker was NOT added to the OWNERS list when using the base branch.');
    } else {
        console.error('❌ Failure: The attacker was still able to add themselves.');
    }

    console.log('\nCase 2: Fetching from PR Branch (Old buggy behavior)');
    const ownersBuggy = await resolveOwners('somefile.txt', '.', fetchFilePR);
    console.log('Owners:', ownersBuggy);

    if (ownersBuggy.includes('attacker')) {
        console.log('✅ Confirmed: The old behavior was indeed buggy (allowed attacker).');
    }
}

testRepro();
