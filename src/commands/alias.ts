import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const aliasSet = new Command('set')
    .argument('<alias>', 'Short alias')
    .argument('<name>', 'Command name to alias')
    .description('Create a short alias for a command')
    .action(async (alias: string, name: string) => {
        const token = await requireAuth()
        const spinner = ora(`Setting alias "${alias}" → "${name}"...`).start()

        try {
            const cmd = await ApiClient.get(
                `/commands/by-name/${encodeURIComponent(name)}`,
                token
            )
            await ApiClient.post('/aliases', { alias, commandId: cmd.id }, token)
            spinner.succeed(chalk.green(`Alias set: ${chalk.white(alias)} → ${chalk.white(name)}`))
            console.log(chalk.dim(`\n  Run it with: recall run ${alias}\n`))
        } catch {
            spinner.fail(chalk.red(`Command "${name}" not found`))
        }
    })

const aliasList = new Command('list')
    .description('List all your aliases')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching aliases...').start()

        try {
            const { aliases } = await ApiClient.get('/aliases', token)
            spinner.stop()

            if (!aliases.length) {
                console.log(chalk.dim('\n  No aliases yet. Run: recall alias set <alias> <name>\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Alias'), chalk.cyan('Command name'), chalk.cyan('Command')],
                style: { head: [], border: ['grey'] },
                colWidths: [16, 20, 46],
                wordWrap: true,
            })

            for (const a of aliases) {
                const cmdName = a.command?.name ?? '—'
                const cmdCommand = a.command?.command ?? '—'
                const truncated = cmdCommand.length > 44
                    ? cmdCommand.slice(0, 44) + '…'
                    : cmdCommand

                table.push([
                    chalk.white(a.alias),
                    cmdName,
                    truncated,
                ])
            }

            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Failed to fetch aliases'))
        }
    })

const aliasDelete = new Command('delete')
    .argument('<alias>', 'Alias to delete')
    .description('Delete an alias')
    .action(async (alias: string) => {
        const token = await requireAuth()
        const spinner = ora(`Deleting alias "${alias}"...`).start()

        try {
            await ApiClient.delete(`/aliases/${encodeURIComponent(alias)}`, token)
            spinner.succeed(chalk.green(`Deleted alias "${alias}"`))
        } catch {
            spinner.fail(chalk.red(`Alias "${alias}" not found`))
        }
    })

export const aliasCommand = new Command('alias')
    .description('Manage command aliases')
    .addCommand(aliasSet)
    .addCommand(aliasList)
    .addCommand(aliasDelete)