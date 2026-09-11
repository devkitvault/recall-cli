import chalk from 'chalk'
import { execSync } from 'child_process'
import { Command } from 'commander'
import inquirer from 'inquirer'
import { findLocalByName } from '../lib/local-vault'

export const runCommand = new Command('run')
    .description('Run a saved local command by name')
    .argument('<name>', 'Command name')
    .option('-d, --dry-run', 'Print command without running it')
    .option('-c, --confirm', 'Ask for confirmation before running')
    .action(async (name: string, opts) => {
        const cmd = findLocalByName(name)
        if (!cmd) {
            console.log(chalk.red(`\n  Command "${name}" not found in local vault.\n`))
            console.log(chalk.dim('  List: recall list'))
            console.log(chalk.dim('  Sync from cloud (Pro): recall sync\n'))
            process.exit(1)
        }

        console.log(chalk.dim(`\n  $ ${cmd.command}\n`))

        if (opts.dryRun) return

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

        execSync(cmd.command, { stdio: 'inherit' })
    })
