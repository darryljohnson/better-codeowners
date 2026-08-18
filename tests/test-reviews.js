import { getReviewerDecisions } from '../src/review-helper.js';

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ Assertion Failed: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ ${message}`);
    }
}

function runTests() {
    console.log('--- Running PR Review Decision Tests ---');

    // Case 1: Simple approval
    {
        const reviews = [
            { user: { login: 'darryljohnson' }, state: 'APPROVED', submitted_at: '2026-03-01T10:00:00Z' }
        ];
        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);
        assert(approvedReviewers.has('darryljohnson'), 'Case 1: User with APPROVED state is recognized as approved');
        assert(!requestedChangesReviewers.has('darryljohnson'), 'Case 1: User is not in requested changes');
    }

    // Case 2: Approval followed by a non-blocking COMMENTED review
    {
        const reviews = [
            { user: { login: 'darryljohnson' }, state: 'APPROVED', submitted_at: '2026-03-01T10:00:00Z' },
            { user: { login: 'darryljohnson' }, state: 'COMMENTED', submitted_at: '2026-03-01T10:05:00Z' }
        ];
        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);
        assert(approvedReviewers.has('darryljohnson'), 'Case 2: Approval stands even after submitting non-blocking comments');
        assert(!requestedChangesReviewers.has('darryljohnson'), 'Case 2: User is not in requested changes');
    }

    // Case 3: Approval followed by CHANGES_REQUESTED (retraction)
    {
        const reviews = [
            { user: { login: 'darryljohnson' }, state: 'APPROVED', submitted_at: '2026-03-01T10:00:00Z' },
            { user: { login: 'darryljohnson' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-03-01T10:10:00Z' }
        ];
        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);
        assert(!approvedReviewers.has('darryljohnson'), 'Case 3: User is no longer approved after requesting changes');
        assert(requestedChangesReviewers.has('darryljohnson'), 'Case 3: User is marked as changes requested');
    }

    // Case 4: CHANGES_REQUESTED followed by a comment
    {
        const reviews = [
            { user: { login: 'darryljohnson' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-03-01T10:00:00Z' },
            { user: { login: 'darryljohnson' }, state: 'COMMENTED', submitted_at: '2026-03-01T10:05:00Z' }
        ];
        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);
        assert(!approvedReviewers.has('darryljohnson'), 'Case 4: User is not approved');
        assert(requestedChangesReviewers.has('darryljohnson'), 'Case 4: User remains in changes requested after comment');
    }

    // Case 5: CHANGES_REQUESTED followed by approval
    {
        const reviews = [
            { user: { login: 'darryljohnson' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-03-01T10:00:00Z' },
            { user: { login: 'darryljohnson' }, state: 'APPROVED', submitted_at: '2026-03-01T10:10:00Z' }
        ];
        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);
        assert(approvedReviewers.has('darryljohnson'), 'Case 5: User is approved after re-review');
        assert(!requestedChangesReviewers.has('darryljohnson'), 'Case 5: User is no longer in changes requested');
    }

    // Case 6: Approval followed by dismissal
    {
        const reviews = [
            { user: { login: 'darryljohnson' }, state: 'APPROVED', submitted_at: '2026-03-01T10:00:00Z' },
            { user: { login: 'darryljohnson' }, state: 'DISMISSED', submitted_at: '2026-03-01T10:10:00Z' }
        ];
        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);
        assert(!approvedReviewers.has('darryljohnson'), 'Case 6: User is not approved after dismissal');
        assert(!requestedChangesReviewers.has('darryljohnson'), 'Case 6: User is not in changes requested after dismissal');
    }

    // Case 7: Case insensitivity
    {
        const reviews = [
            { user: { login: 'DarrylJohnson' }, state: 'APPROVED', submitted_at: '2026-03-01T10:00:00Z' }
        ];
        const { approvedReviewers } = getReviewerDecisions(reviews);
        assert(approvedReviewers.has('darryljohnson'), 'Case 7: Mixed-case login normalized to lowercase');
    }

    console.log('\nAll review decision tests passed!');
}

runTests();
