import * as core from '@actions/core';
import * as github from '@actions/github';
import { resolveOwners } from './owners-parser.js';
import path from 'path';

async function run() {
    try {
        const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GitHub token not found. Please provide it via input or GITHUB_TOKEN env var.');
        }
        const octokit = github.getOctokit(token);
        const context = github.context;

        if (!context.payload.pull_request) {
            core.setFailed('This action only runs on pull_request events.');
            return;
        }

        const statusContext = core.getInput('status-context') || 'Code Owner Approval';
        const prAuthor = context.payload.pull_request.user.login;
        const sha = context.payload.pull_request.head.sha;
        const { owner, repo, number: pull_number } = context.issue;

        // 1. Get changed files
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner,
            repo,
            pull_number,
        });

        // 2. Get reviews
        const { data: reviews } = await octokit.rest.pulls.listReviews({
            owner,
            repo,
            pull_number,
        });

        const latestReviews = new Map();
        reviews.forEach(review => {
            const user = review.user.login;
            const state = review.state;
            const submittedAt = new Date(review.submitted_at);

            if (!latestReviews.has(user) || submittedAt > latestReviews.get(user).submittedAt) {
                latestReviews.set(user, { state, submittedAt });
            }
        });

        const approvedReviewers = new Set(
            Array.from(latestReviews.entries())
                .filter(([user, info]) => info.state === 'APPROVED')
                .map(([user, info]) => user)
        );

        const requestedChangesReviewers = new Set(
            Array.from(latestReviews.entries())
                .filter(([user, info]) => info.state === 'CHANGES_REQUESTED')
                .map(([user, info]) => user)
        );

        core.info(`PR Author: ${prAuthor}`);
        core.info(`Approved Reviewers: ${Array.from(approvedReviewers).join(', ')}`);
        core.info(`Requested Changes Reviewers: ${Array.from(requestedChangesReviewers).join(', ')}`);

        const unapprovedFiles = [];
        const requestedChangesFiles = [];
        const repoRoot = process.cwd();

        for (const file of files) {
            const owners = resolveOwners(file.filename, repoRoot);
            core.info(`File: ${file.filename}, Owners: ${owners.join(', ')}`);

            const isApproved = owners.some(owner =>
                owner === prAuthor || approvedReviewers.has(owner)
            );

            const hasRequestedChanges = !isApproved && owners.some(owner =>
                requestedChangesReviewers.has(owner)
            );

            if (hasRequestedChanges) {
                requestedChangesFiles.push({
                    filename: file.filename,
                    owners
                });
            } else if (!isApproved) {
                unapprovedFiles.push({
                    filename: file.filename,
                    owners
                });
            }
        }

        let state = 'success';
        let description = 'All files approved by code owners.';

        if (requestedChangesFiles.length > 0) {
            state = 'failure';
            description = 'Changes requested by code owners.';
            let message = 'The following files have changes requested by a code owner:\n';
            requestedChangesFiles.forEach(f => {
                message += `- ${f.filename} (Owners: ${f.owners.join(', ') || 'None'})\n`;
            });
            core.info(message);
        } else if (unapprovedFiles.length > 0) {
            state = 'pending';
            description = 'Pending owner approval for some files.';
            let message = 'The following files require approval from at least one code owner:\n';
            unapprovedFiles.forEach(f => {
                message += `- ${f.filename} (Owners: ${f.owners.join(', ') || 'None'})\n`;
            });
            core.info(message); // Log it so it's visible in Actions
        } else {
            core.info(description);
        }

        await octokit.rest.repos.createCommitStatus({
            owner,
            repo,
            sha,
            state,
            context: statusContext,
            description,
            target_url: `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`
        });

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
