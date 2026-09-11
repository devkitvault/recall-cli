# @devkitvault/recall

**recall** is a CLI command vault for your terminal. Save the commands you keep losing, search them, run them by name, and sync when you want cloud backup.

Product site and docs: [recall.devkitvault.com](https://recall.devkitvault.com)

This repository is the **open CLI** published as [`@devkitvault/recall`](https://www.npmjs.com/package/@devkitvault/recall). The cloud API, billing, and dashboard stay private.

## Requirements

- [Node.js](https://nodejs.org/) **18 or newer**

## Install

```sh
npm install -g @devkitvault/recall
```

`rec` is the same binary as `recall`.

```sh
recall --version
recall doctor
```

## Quick start (local vault)

Local save / list / search / run work without an account. Auth is only needed for sync, Ask, and team features on [recall.devkitvault.com](https://recall.devkitvault.com).

```sh
recall save "docker compose up -d" --name docker --tags docker
recall save --last -n useful -t docker
recall list
recall search docker
recall run docker
```

`recall save --last` (or `-L`) reads the last line from zsh / bash / PowerShell history. Not supported in Windows `cmd.exe`. On bash, if the command is missing: `history -a && recall save --last`.

```sh
recall playbook save deploy "docker compose up -d" "pnpm migrate"
recall playbook run deploy --dry-run
```

`recall playbook run` executes steps. Ask never does.

## Auth & sync (optional)

```sh
recall auth login
recall sync
recall whoami
```

## Develop

```sh
npm install
npm run build
npm test
node dist/index.js --help
```

## Publish

Bump `version` in `package.json` first if that version is already on npm. Then:

```sh
npm publish
```

Complete npm 2FA when prompted. Do not use `--ignore-scripts`.

## Links

|         |                                                                                    |
| ------- | ---------------------------------------------------------------------------------- |
| Website | [recall.devkitvault.com](https://recall.devkitvault.com)                           |
| Docs    | [recall.devkitvault.com/docs](https://recall.devkitvault.com/docs)                 |
| npm     | [@devkitvault/recall](https://www.npmjs.com/package/@devkitvault/recall)           |
| VS Code | [Marketplace](https://marketplace.visualstudio.com/items?itemName=devkitvault.recall-cmd) |

## License

MIT — see [LICENSE](./LICENSE). © [devkitvault](https://devkitvault.com)
