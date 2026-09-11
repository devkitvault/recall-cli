import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import { deleteLocalByName, findLocalByName } from '../lib/local-vault'

export const deleteCommand = new Command('delete')
    .description('Delete a command from your local vault')
    .argument('<name>', 'Command name to delete')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name: string, opts) => {
        const cmd = findLocalByName(name)
        if (!cmd) {
            console.log(chalk.red(`\n  Command "${name}" not found in local vault.\n`))
            process.exit(1)
        }

        console.log()
        console.log(`  ${chalk.dim('Name:')}    ${chalk.white(cmd.name ?? '—')}`)
        console.log(`  ${chalk.dim('Command:')} ${chalk.white(cmd.command)}`)
        console.log()

        if (!opts.force) {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: chalk.red(`Delete "${name}" from local vault?`),
                    default: false,
                },
            ])

            if (!confirm) {
                console.log(chalk.dim('\n  Cancelled.\n'))
                return
            }
        }

        deleteLocalByName(name)
        console.log(chalk.green(`  Deleted "${name}" from local vault.\n`))
        console.log(chalk.dim('  Cloud copy (if any) is unchanged until you sync.\n'))
    })
