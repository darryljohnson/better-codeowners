# Better Code Owners

A GitHub Action that implements Gerrit-style decentralized code ownership.

## Why Better Code Owners?

GitHub's native `CODEOWNERS` can be rigid and difficult to manage in large repositories. **Better Code Owners** provides a more flexible, developer-friendly alternative:

-   **Decentralized & Scalable**: `OWNERS` files live near the code they protect. Teams have full autonomy over their own directories without needing to touch a central root file.
-   **No "Double Approval" for Owners**: If you own the files you are changing, you shouldn't need another owner to approve your work. This plugin recognizes authors as owners, reducing unnecessary friction.
-   **Hierarchical & Intuitive**: Ownership is inherited from parent directories, making it easy to define global owners at the root while allowing specialized teams to manage sub-folders.
-   **Prevents Review Bottlenecks**: Only one approval from any valid owner is required per file, keeping PRs moving quickly.

## How it Works

1.  Place `OWNERS` files anywhere in your repository's directory structure.
2.  Each `OWNERS` file should contain a list of GitHub usernames (one per line).
3.  The Action validates that every file changed in a Pull Request has been approved by at least one owner.
4.  Owners are resolved by looking at the `OWNERS` file in the file's directory and all parent directories up to the root.
5.  **Self-Approval**: If the PR author is an owner of a file, that file is considered approved by them.

## Setup

### 1. Create a Workflow File

Add `.github/workflows/code-owners.yml` to your repository. **Note:** Ensure you include the `permissions` block so the action can update the PR status correctly.

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
    permissions:
      pull-requests: read
      contents: read
      statuses: write
    steps:
      - uses: actions/checkout@v4
      - name: Better Code Owners
        uses: darryljohnson/better-codeowners@v1
```

### 2. Configure Branch Protection

To avoid confusion with multiple checks appearing (one for each trigger event), this action reports a single unified status named **"better-codeowners"**.

To make this check mandatory:
1. Go to **Settings > Branches** in your GitHub repository.
2. Add or Edit a **Branch protection rule**.
3. Enable **Require status checks to pass before merging**.
4. Search for **"better-codeowners"** (this is the status context reported by the action) and add it to the required checks.

> [!TIP]
> Do **not** use the job name (`validate-owners`) as the required check. Using the "better-codeowners" status ensures a single, consistent check that is updated by both code pushes and reviews.

## OWNERS file format

```text
# This is a comment
octocat
@hubot
```
Both `username` and `@username` formats are supported.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
