import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const pinCommand = new Command('pin')
    .description('Pin or unpin a command to the top of your list')
    .argument('<name>', 'Command name')
    .option('-u, --unpin', 'Unpin instead of pin')
    .action(async (name: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Looking up...').start()

        try {
            const cmd = await ApiClient.get(
                `/commands/by-name/${encodeURIComponent(name)}`,
                token
            )

            const pinned = !opts.unpin
            await ApiClient.patch(`/commands/${cmd.id}/pin`, { pinned }, token)

            spinner.succeed(
                pinned
                    ? chalk.green(`Pinned "${name}" — it will appear at the top of recall list`)
                    : chalk.green(`Unpinned "${name}"`)
            )
        } catch {
            spinner.fail(chalk.red(`Command "${name}" not found`))
        }
    })