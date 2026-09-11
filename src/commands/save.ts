import chalk from 'chalk'
import { Command } from 'commander'
import { getLastShellCommand, LastCommandError } from '../lib/shell-history'
import { parseTags } from '../lib/tags'
import { saveLocalCommand, VAULT_FILE } from '../lib/local-vault'

export const saveCommand = new Command('save')
    .description('Save a command to your local vault (no account required)')
    .argument('[command]', 'The shell command to save (omit when using --last)')
    .option('-L, --last', 'Save the last command from your shell history')
    .option('-n, --name <name>', 'Short memorable name')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-g, --group <group>', 'Group (Pro / cloud — ignored for local save)')
    .addHelpText(
        'after',
        `
Examples:
  $ recall save "docker compose up -d" -n start-stack -t docker
  $ recall save --last
  $ recall save --last -n start-stack -t docker

  Saves to the local vault (~/.recall/commands.json). No login required.
  Sync to the cloud with Pro: recall auth login && recall sync

  --last reads zsh/bash/PowerShell history (not cmd.exe).
  Bash tip: if the command is missing, run: history -a && recall save --last
`,
    )
    .action(async (commandArg: string | undefined, opts) => {
        let command = commandArg?.trim()

        if (opts.last) {
            if (command) {
                console.log(chalk.yellow('  Ignoring the command argument because --last was set.'))
            }
            try {
                const last = getLastShellCommand()
                command = last.command
                console.log(chalk.dim(`  From ${last.shell} history: ${command}`))
            } catch (err) {
                if (err instanceof LastCommandError) {
                    console.log(chalk.red(`\n  ${err.message}\n`))
                    process.exit(1)
                }
                throw err
            }
        }

        if (!command) {
            console.log(chalk.red('\n  Provide a command, or use --last to take it from shell history.\n'))
            console.log(chalk.dim('  Examples:'))
            console.log(chalk.dim('    recall save "docker compose up -d"'))
            console.log(chalk.dim('    recall save --last\n'))
            process.exit(1)
        }

        if (opts.group) {
            console.log(chalk.yellow('  Groups sync with Pro cloud vault. Saved locally without a group.'))
            console.log(chalk.dim('  After upgrading: recall sync\n'))
        }

        const tags = parseTags(opts.tags)
        const saved = saveLocalCommand({
            command,
            name: opts.name,
            tags,
        })

        console.log(
            chalk.green(
                `  Saved locally${saved.name ? ` as "${saved.name}"` : ''}`,
            ),
        )
        console.log(chalk.dim(`  Vault: ${VAULT_FILE}`))
        console.log(chalk.dim('  Sync to cloud (Pro): recall sync\n'))
    })
