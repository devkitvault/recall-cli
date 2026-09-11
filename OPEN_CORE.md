# Public CLI extract

The open-source CLI lives in `./recall-cli/` (gitignored here).

- Source of truth for day-to-day development remains `packages/cli` + publish via `packages/npm-cli`.
- When you are ready to go public: move `recall-cli` out of this monorepo (or push its nested git remote), create `devkitvault/recall-cli` on GitHub as **public**, then keep the two trees in sync (or switch publish to the public repo only).

Do not open the full monorepo. Keep `packages/api`, `admin`, billing, and secrets private.
