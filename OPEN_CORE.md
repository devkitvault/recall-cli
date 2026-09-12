# Open-core (public CLI)

This repo is the open-source face of `@devkitvault/recall`.

## Product flow (LOCKED)

| Tier | Account | Vault | Sync | Ask |
|---|---|---|---|---|
| Free | not required | local only (`~/.recall/`) | no | no |
| Pro / Team | required | cloud + local | yes | yes (print-only) |

Ask never executes. `recall run` / playbooks run only when you invoke them.

## npm

Published as `@devkitvault/recall` from the product monorepo’s npm package. Keep `APP_VERSION` aligned when shipping.

## Day-to-day

1. Develop CLI features in the product monorepo (`packages/cli`)
2. Publish npm when ready
3. Mirror `src/` here and push to `devkitvaultorg/recall-cli`
