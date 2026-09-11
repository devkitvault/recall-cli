import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const updateCommand = new Command('update')
    .description('Update a saved command name, command, or tags')
    .argument('<name>', 'Current command name')
    .action(async (name: string) => {
        const token = await requireAuth()
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

        // Show current values
        console.log()
        console.log(chalk.dim('  Current values — press Enter to keep, or type to update\n'))

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Name:',
                default: cmd.name ?? '',
            },
            {
                type: 'input',
                name: 'command',
                message: 'Command:',
                default: cmd.command,
                validate: (v) => v.length > 0 || 'Command cannot be empty',
            },
            {
                type: 'input',
                name: 'tags',
                message: 'Tags (comma-separated):',
                default: (cmd.tags ?? []).join(', '),
            },
        ])

        const updateSpinner = ora('Updating...').start()

        try {
            await ApiClient.patch(`/commands/${cmd.id}`, {
                name: answers.name || undefined,
                command: answers.command,
                tags: answers.tags
                    ? answers.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                    : [],
            }, token)

            updateSpinner.succeed(chalk.green(`Updated "${answers.name || name}"`))
        } catch {
            updateSpinner.fail(chalk.red('Failed to update'))
        }
    })