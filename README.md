# @devkitvault/recall

I kept losing useful shell commands. So I built a small vault for the ones I actually reuse.

**recall** saves commands locally, lets you search and run them by name, and optionally syncs when you want the same vault on another machine.

- **Free:** local vault only — no account, nothing uploads (`~/.recall/commands.json`)
- **Pro / Team:** `recall sync` + Ask (prints a suggestion; never runs it)

Product: [recall.devkitvault.com](https://recall.devkitvault.com) · Docs: [docs](https://recall.devkitvault.com/docs)

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

## Quick start (Free — local)

No account needed.

```sh
recall save "docker compose up -d" -n up -t docker
recall save --last -n useful -t docker
recall import history -n 20
recall list
recall search docker
recall run up
```

`recall import history` reads your shell history file (zsh / bash / PowerShell) and lets you pick what to keep. It does not sit in the background recording keystrokes.

`recall save --last` (or `-L`) takes the last history line. Not supported in Windows `cmd.exe`. On bash, if it’s empty: `history -a && recall save --last`.

```sh
recall playbook save deploy "docker compose up -d" "pnpm migrate"
recall playbook run deploy --dry-run
```

`recall playbook run` executes steps. Ask never does.

## Ask (Pro / Team)

```sh
recall auth login
recall "find the 10 biggest files in this directory"
rec "that docker command from last week"
```

Ask only prints. You run the command yourself.

No-args `recall` opens an Ask session (`Recall >`). `/save [name]` stores the last suggestion. `/exit` leaves.

## Sync (Pro / Team)

```sh
recall auth login
recall sync          # pull then push
recall sync --pull   # cloud → local
recall sync --push   # local-only → cloud
recall sync --status
recall whoami
```

## Native binary (optional)

- **macOS / Linux:** `curl -fsSL https://devkitvault.com/recall/install.sh | sh`
- **Windows:** `irm https://devkitvault.com/recall/install.ps1 | iex`

See [install docs](https://recall.devkitvault.com/docs/install).

## Update

```sh
npm update -g @devkitvault/recall
```

## Troubleshooting

```sh
recall doctor
recall whoami
```

Issues: [github.com/devkitvault/recall-cli/issues](https://github.com/devkitvault/recall-cli/issues)

## Links

| | |
| --------- | ----------------------------------------------------------------------------------------- |
| Website | [recall.devkitvault.com](https://recall.devkitvault.com) |
| Docs | [recall.devkitvault.com/docs](https://recall.devkitvault.com/docs) |
| Source | [github.com/devkitvault/recall-cli](https://github.com/devkitvault/recall-cli) |
| npm | [@devkitvault/recall](https://www.npmjs.com/package/@devkitvault/recall) |
| VS Code | [Marketplace](https://marketplace.visualstudio.com/items?itemName=devkitvault.recall-cmd) |

## License

MIT — see [LICENSE](./LICENSE). © [devkitvault](https://devkitvault.com)
