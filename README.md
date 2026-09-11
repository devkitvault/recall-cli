# @devkitvault/recall

**recall** is a CLI command vault for your terminal. Save the commands you keep losing, search them, run them by name, and sync when you want cloud backup.

Product site and docs: [recall.devkitvault.com](https://recall.devkitvault.com)

Open source: [github.com/devkitvault/recall-cli](https://github.com/devkitvault/recall-cli)

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

Local save / list / search / run work **without an account**. Auth is only needed for **sync**, **Ask** (Pro/Team), and team features.

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

## Ask (Pro / Team)

Natural-language Ask prints a suggestion and never runs it. Requires a Pro or Team plan.

```sh
recall auth login
recall "find the 10 biggest files in this directory"
rec "that docker command from last week"
```

No-args `recall` opens an Ask session (`Recall >`). `/save [name]` stores the last suggestion. `/exit` leaves.

## Auth & sync (Pro / Team)

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

## Prefer a standalone binary?

- **macOS / Linux:** `curl -fsSL https://devkitvault.com/recall/install.sh | sh`
- **Windows:** `irm https://devkitvault.com/recall/install.ps1 | iex`

See [recall.devkitvault.com/docs/install](https://recall.devkitvault.com/docs/install).

## Update

```sh
npm update -g @devkitvault/recall
```

## Troubleshooting

```sh
recall doctor
recall whoami
```

If something still fails, open an issue on [GitHub](https://github.com/devkitvault/recall-cli/issues) or visit [recall.devkitvault.com](https://recall.devkitvault.com).

## Links

|           |                                                                                           |
| --------- | ----------------------------------------------------------------------------------------- |
| Website   | [recall.devkitvault.com](https://recall.devkitvault.com)                                  |
| Docs      | [recall.devkitvault.com/docs](https://recall.devkitvault.com/docs)                        |
| Dashboard | [recall.devkitvault.com](https://recall.devkitvault.com)                                  |
| Source    | [github.com/devkitvault/recall-cli](https://github.com/devkitvault/recall-cli)            |
| VS Code   | [Marketplace](https://marketplace.visualstudio.com/items?itemName=devkitvault.recall-cmd) |
| Issues    | [github.com/devkitvault/recall-cli](https://github.com/devkitvault/recall-cli/issues)     |

## License

MIT — see [LICENSE](./LICENSE). © [devkitvault](https://devkitvault.com)
