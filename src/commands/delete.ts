import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const deleteCommand = new Command('delete')
    .description('Delete a saved command by name')
    .argument('<name>', 'Command name to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name: string, opts) => {
        const token = await requireAuth()

        // First look up the command to confirm it exists
        const spinner = ora('Looking up...').start()

        let cmd: any
        try {
            cmd = await ApiClient.get(
                `/commands/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.stop()
        } catch {
            spinner.fail(chalk.red(`Command "${name}" not found`))
            process.exit(1)
        }

        // Show what will be deleted
        console.log()
        console.log(`  ${chalk.dim('Name:')}    ${chalk.white(cmd.name ?? '—')}`)
        console.log(`  ${chalk.dim('Command:')} ${chalk.white(cmd.command)}`)
        console.log()

        // Confirm unless --force
        if (!opts.force) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: chalk.red(`Delete "${name}"?`),
                    default: false,
                },
            ])

            if (!confirm) {
                console.log(chalk.dim('\n  Cancelled.\n'))
                return
            }
        }

        const deleteSpinner = ora('Deleting...').start()

        try {
            await ApiClient.delete(`/commands/${cmd.id}`, token)
            deleteSpinner.succeed(chalk.green(`Deleted "${name}"`))
        } catch {
            deleteSpinner.fail(chalk.red('Failed to delete'))
        }
    })