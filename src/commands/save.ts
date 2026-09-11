import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'
import { getLastShellCommand, LastCommandError } from '../lib/shell-history'

export const saveCommand = new Command('save')
    .description('Save a command to your vault')
    .argument('[command]', 'The shell command to save (omit when using --last)')
    .option('-L, --last', 'Save the last command from your shell history')
    .option('-n, --name <name>', 'Short memorable name')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-g, --group <group>', 'Save directly to a group (Pro)')
    .addHelpText(
        'after',
        `
Examples:
  $ recall save "docker compose up -d" -n start-stack -t docker
  $ recall save --last
  $ recall save --last -n start-stack -t docker

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

        const token = await requireAuth()

        let groupId: string | undefined

        if (opts.group) {
            const spinner = ora(`Looking up group "${opts.group}"...`).start()
            try {
                const group = await ApiClient.get(
                    `/groups/by-name/${encodeURIComponent(opts.group)}`,
                    token,
                )
                groupId = group.id
                spinner.stop()
            } catch (err) {
                if (err instanceof ApiError && err.status === 403) {
                    spinner.stop()
                    console.log(chalk.yellow('\n  Groups require a Pro plan.'))
                    console.log(chalk.dim('  Run: recall upgrade\n'))
                    process.exit(1)
                }

                if (err instanceof ApiError && err.status === 404) {
                    spinner.text = `Creating group "${opts.group}"...`
                    try {
                        const newGroup = await ApiClient.post('/groups', { name: opts.group }, token)
                        groupId = newGroup.id
                        spinner.succeed(chalk.green(`Created group "${opts.group}"`))
                    } catch {
                        spinner.fail(chalk.red(`Failed to create group "${opts.group}"`))
                        process.exit(1)
                    }
                } else {
                    spinner.fail(chalk.red(`Failed to look up group "${opts.group}"`))
                    process.exit(1)
                }
            }
        }

        const spinner = ora('Saving...').start()

        try {
            const saved = await ApiClient.post(
                '/commands',
                {
                    command,
                    name: opts.name,
                    tags: opts.tags?.split(',').map((t: string) => t.trim()),
                    groupId,
                },
                token,
            )

            spinner.succeed(
                chalk.green(
                    `Saved${saved.name ? ` as "${saved.name}"` : ''}` +
                        (opts.group ? chalk.dim(` → group "${opts.group}"`) : ''),
                ),
            )
        } catch (err) {
            spinner.fail(chalk.red('Failed to save'))
            if (err instanceof ApiError && err.status === 403 && err.body?.upgrade) {
                console.log(chalk.yellow('\n  This feature requires an upgrade.'))
                console.log(chalk.dim(`  Upgrade at ${chalk.white(err.body.upgrade)}\n`))
            }
        }
    })
