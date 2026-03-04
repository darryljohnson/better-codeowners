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

        const prAuthor = context.payload.pull_request.user.login;
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

        core.info(`PR Author: ${prAuthor}`);
        core.info(`Approved Reviewers: ${Array.from(approvedReviewers).join(', ')}`);

        const unapprovedFiles = [];
        const repoRoot = process.cwd();

        for (const file of files) {
            const owners = resolveOwners(file.filename, repoRoot);
            core.info(`File: ${file.filename}, Owners: ${owners.join(', ')}`);

            const isApproved = owners.some(owner =>
                owner === prAuthor || approvedReviewers.has(owner)
            );

            if (!isApproved) {
                unapprovedFiles.push({
                    filename: file.filename,
                    owners
                });
            }
        }

        if (unapprovedFiles.length > 0) {
            let message = 'The following files require approval from at least one code owner:\n';
            unapprovedFiles.forEach(f => {
                message += `- ${f.filename} (Owners: ${f.owners.join(', ') || 'None'})\n`;
            });

            await octokit.rest.repos.createCommitStatus({
                owner,
                repo,
                sha: context.payload.pull_request.head.sha,
                state: 'failure',
                context: 'better-codeowners',
                description: `Missing approval for ${unapprovedFiles.length} file.`,
                target_url: `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`
            });

            core.setFailed(message);
        } else {
            core.info('All files approved by code owners.');
            await octokit.rest.repos.createCommitStatus({
                owner,
                repo,
                sha: context.payload.pull_request.head.sha,
                state: 'success',
                context: 'better-codeowners',
                description: 'All files approved by code owners.',
                target_url: `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`
            });
        }

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
