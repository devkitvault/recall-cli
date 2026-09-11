import chalk from 'chalk'
import { execSync } from 'child_process'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const runCommand = new Command('run')
    .description('Run a saved command by name or alias')
    .argument('<name>', 'Command name or alias')
    .option('-d, --dry-run', 'Print command without running it')
    .option('-c, --confirm', 'Ask for confirmation before running')
    .action(async (name: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Looking up...').start()

        try {
            // Try by name first, then alias
            let cmd: any
            try {
                cmd = await ApiClient.get(
                    `/commands/by-name/${encodeURIComponent(name)}`,
                    token
                )
            } catch {
                cmd = await ApiClient.get(
                    `/aliases/${encodeURIComponent(name)}/resolve`,
                    token
                )
            }

            spinner.stop()

            console.log(chalk.dim(`\n  $ ${cmd.command}\n`))

            if (opts.dryRun) return

            // Confirm if --confirm flag or command has confirm flag
            if (opts.confirm) {
                const { ok } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'ok',
                    message: 'Run this command?',
                    default: true,
                }])
                if (!ok) {
                    console.log(chalk.dim('  Cancelled.\n'))
                    return
                }
            }

            // Log the run
            ApiClient.post(`/commands/${cmd.id}/run`, {}, token).catch(() => { })

            execSync(cmd.command, { stdio: 'inherit' })
        } catch {
            spinner.fail(chalk.red(`Command "${name}" not found`))
        }
    })