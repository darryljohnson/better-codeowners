import * as core from '@actions/core';
import * as github from '@actions/github';
import { resolveOwners } from './owners-parser.js';
import { getReviewerDecisions } from './review-helper.js';

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
        const prAuthorLower = prAuthor.toLowerCase();
        const sha = context.payload.pull_request.head.sha;
        const { owner, repo, number: pull_number } = context.issue;

        // 1. Get changed files (paginated)
        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
            owner,
            repo,
            pull_number,
        });

        // 2. Get reviews (paginated)
        const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
            owner,
            repo,
            pull_number,
        });

        const { approvedReviewers, requestedChangesReviewers } = getReviewerDecisions(reviews);

        core.info(`PR Author: ${prAuthor}`);
        core.info(`Approved Reviewers: ${Array.from(approvedReviewers).join(', ')}`);
        core.info(`Requested Changes Reviewers: ${Array.from(requestedChangesReviewers).join(', ')}`);

        const baseRef = context.payload.pull_request.base.ref;
        core.info(`Base Branch: ${baseRef}`);

        const ownersCache = new Map();

        const fetchFile = async (filePath) => {
            if (ownersCache.has(filePath)) {
                return ownersCache.get(filePath);
            }

            try {
                const { data } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: filePath,
                    ref: baseRef,
                });

                if (data && data.content) {
                    const content = Buffer.from(data.content, 'base64').toString('utf8');
                    ownersCache.set(filePath, content);
                    return content;
                }
            } catch (error) {
                if (error.status !== 404) {
                    core.warning(`Error fetching ${filePath} from ${baseRef}: ${error.message}`);
                }
                ownersCache.set(filePath, null);
            }
            return null;
        };

        const unapprovedFiles = [];
        const requestedChangesFiles = [];
        const repoRoot = process.cwd();

        for (const file of files) {
            const owners = await resolveOwners(file.filename, repoRoot, fetchFile);
            core.info(`File: ${file.filename}, Owners: ${owners.join(', ')}`);

            const isApproved = owners.some(owner =>
                owner.toLowerCase() === prAuthorLower || approvedReviewers.has(owner.toLowerCase())
            );

            const hasRequestedChanges = !isApproved && owners.some(owner =>
                requestedChangesReviewers.has(owner.toLowerCase())
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
