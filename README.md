# Better Code Owners

A GitHub Action that implements Gerrit-style decentralized code ownership.

## How it Works

1.  Place `OWNERS` files anywhere in your repository's directory structure.
2.  Each `OWNERS` file should contain a list of GitHub usernames (one per line).
3.  The Action validates that every file changed in a Pull Request has been approved by at least one owner.
4.  Owners are resolved by looking at the `OWNERS` file in the file's directory and all parent directories up to the root.
5.  **Self-Approval**: If the PR author is an owner of a file, that file is considered approved by them.

## Setup

### 1. Create a Workflow File

Add `.github/workflows/code-owners.yml` to your repository:

```yaml
name: Code Owners Check

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted, dismissed]

jobs:
  validate-owners:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Better Code Owners
        uses: darryljohnson/better-codeowners@v1
```

### 2. Configure Branch Protection

To make this check mandatory:
1. Go to **Settings > Branches** in your GitHub repository.
2. Add or Edit a **Branch protection rule**.
3. Enable **Require status checks to pass before merging**.
4. Search for `validate-owners` (or the name of your job) and add it to the required checks.

## OWNERS file format

```text
# This is a comment
octocat
@hubot
```
Both `username` and `@username` formats are supported.
