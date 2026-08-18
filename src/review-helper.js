/**
 * Computes approved reviewers and requested changes reviewers based on the latest review decisions.
 * Only reviews with state 'APPROVED', 'CHANGES_REQUESTED', or 'DISMISSED' update a reviewer's state.
 * 'COMMENTED' or 'PENDING' reviews are non-blocking and do NOT override an approval or requested change.
 * 
 * @param {Array<{user: {login: string}, state: string, submitted_at: string}>} reviews
 * @returns {{ approvedReviewers: Set<string>, requestedChangesReviewers: Set<string> }}
 */
export function getReviewerDecisions(reviews) {
    const latestReviews = new Map();

    reviews.forEach(review => {
        if (!review || !review.user || !review.state) {
            return;
        }

        // Only state-altering reviews should update the decision
        if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
            return;
        }

        const user = review.user.login.toLowerCase();
        const state = review.state;
        const submittedAt = review.submitted_at ? new Date(review.submitted_at) : new Date(0);

        if (!latestReviews.has(user) || submittedAt > latestReviews.get(user).submittedAt) {
            latestReviews.set(user, { state, submittedAt, login: review.user.login });
        }
    });

    const approvedReviewers = new Set(
        Array.from(latestReviews.entries())
            .filter(([_, info]) => info.state === 'APPROVED')
            .map(([user]) => user)
    );

    const requestedChangesReviewers = new Set(
        Array.from(latestReviews.entries())
            .filter(([_, info]) => info.state === 'CHANGES_REQUESTED')
            .map(([user]) => user)
    );

    return { approvedReviewers, requestedChangesReviewers };
}
