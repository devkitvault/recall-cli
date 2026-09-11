import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const historyCommand = new Command('history')
    .description('Show your command run history')
    .option('-l, --limit <n>', 'Number of entries to show', '20')
    .action(async (opts) => {
        const token = await requireAuth()
        const spinner = ora('Fetching history...').start()

        try {
            const { history } = await ApiClient.get(
                `/commands/history?limit=${opts.limit}`,
                token
            )
            spinner.stop()

            if (!history.length) {
                console.log(chalk.dim('\n  No history yet. Run some commands first.\n'))
                return
            }

            console.log(chalk.bold(`\n  Last ${history.length} runs\n`))

            for (const entry of history) {
                const time = new Date(entry.ranAt)
                const timeStr = time.toLocaleString()
                const name = entry.command?.name
                    ? chalk.white(entry.command.name)
                    : chalk.dim('unnamed')
                const cmd = chalk.dim(
                    entry.command?.command?.slice(0, 50) +
                    (entry.command?.command?.length > 50 ? '…' : '')
                )

                console.log(`  ${chalk.dim(timeStr)}  ${name}  ${cmd}`)
            }

            console.log()
        } catch {
            spinner.fail(chalk.red('Failed to fetch history'))
        }
    })