# Repository workflow

- Work only on feature branches. Never push changes directly to `main`.
- Name new branches by change type and purpose: `feat/<purpose>`, `fix/<purpose>`, `docs/<purpose>`, or `chore/<purpose>`. Do not use an agent or tool name as a branch prefix.
- Deliver all changes through pull requests targeting `main`.
- Split work into small, independently reviewable changes. Implement the current change, run relevant checks, show the concrete result for review, and wait for approval before committing.
- Keep requested changes uncommitted while the user reviews and tests them locally. An implementation request alone does not authorize commits.
- Keep each approved commit limited to one coherent change. Inspect the staged diff and stage only reviewed files belonging to that change.
- Commit only with the repository user's locally configured Git identity. Never add an agent/tool name, generated-by text, or co-author trailer unless explicitly requested.
- Merge pull requests with a merge commit. Do not squash or rebase PRs.
- Keep commit messages and PR descriptions focused on the change summary. Do not add generic verification sections or command lists unless requested or a material test limitation needs explanation.
- Do not inspect or poll remote CI or deployment status after a push or merge unless explicitly requested. Provide the run or PR link without querying its status.
