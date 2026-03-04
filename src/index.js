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

        const unapprovedCount = unapprovedFiles.length;
        const description = unapprovedCount > 0
            ? `Missing approval for ${unapprovedCount} file${unapprovedCount === 1 ? '' : 's'}.`
            : 'All files approved by code owners.';
        const state = unapprovedCount > 0 ? 'failure' : 'success';

        core.info(`Reporting status: ${state} - ${description}`);

        await octokit.rest.repos.createCommitStatus({
            owner,
            repo,
            sha: context.payload.pull_request.head.sha,
            state: state,
            context: 'better-codeowners',
            description: description,
            target_url: `https://github.com/${owner}/${repo}/actions/runs/${context.runId}`
        });

        if (unapprovedCount > 0) {
            let message = 'The following files require approval from at least one code owner:\n';
            unapprovedFiles.forEach(f => {
                message += `- ${f.filename} (Owners: ${f.owners.join(', ') || 'None'})\n`;
            });
            core.setFailed(message);
        } else {
            core.info('Validation successful.');
        }

    } catch (error) {
        core.error(`Action failed with error: ${error.message}`);

        try {
            const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
            const context = github.context;
            if (token && context.payload.pull_request) {
                const octokit = github.getOctokit(token);
                await octokit.rest.repos.createCommitStatus({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    sha: context.payload.pull_request.head.sha,
                    state: 'error',
                    context: 'better-codeowners',
                    description: 'The check encountered a technical error.',
                    target_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
                });
            }
        } catch (statusError) {
            core.error(`Failed to report error status: ${statusError.message}`);
        }

        core.setFailed(error.message);
    }
}

run();
