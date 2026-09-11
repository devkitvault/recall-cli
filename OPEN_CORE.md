# Public CLI extract

Open-source face of `@devkitvault/recall`.

- **GitHub:** https://github.com/devkitvault/recall-cli
- **Private product monorepo:** https://github.com/mahmoudhussiendev/recall (API, web, admin, billing — never public)

## Product flow (LOCKED)

- Free / no account: local vault only — **no Ask**
- Pro / Team: sync + Ask (print-only)

## Sync from private monorepo

1. Develop in `packages/cli` (local vault: `src/lib/local-vault.ts`; Pro sync: `src/commands/sync.ts`)
2. Publish from `packages/npm-cli` when shipping npm
3. Mirror `packages/cli/src` here, commit, push to `devkitvault/recall-cli`

Free = fully local (`~/.recall/commands.json`). Pro = `recall sync` + Ask.
