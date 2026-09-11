import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const envSave = new Command('save')
    .argument('<name>', 'Environment set name')
    .description('Save a set of environment variables')
    .action(async (name: string) => {
        const token = await requireAuth()

        console.log(chalk.bold(`\n  Save env set: ${name}\n`))
        console.log(chalk.dim('  Enter variables one by one. Leave name empty to finish.\n'))

        const vars: Record<string, string> = {}

        while (true) {
            const { key } = await inquirer.prompt([{
                type: 'input',
                name: 'key',
                message: 'Variable name (empty to finish):',
            }])

            if (!key.trim()) break

            const { value } = await inquirer.prompt([{
                type: 'input',
                name: 'value',
                message: `Value for ${key}:`,
            }])

            vars[key] = value
        }

        if (!Object.keys(vars).length) {
            console.log(chalk.dim('\n  No variables entered. Cancelled.\n'))
            return
        }

        const spinner = ora('Saving...').start()
        try {
            await ApiClient.post('/env', { name, vars }, token)
            spinner.succeed(chalk.green(`Saved env set "${name}" with ${Object.keys(vars).length} variables`))
        } catch (err: any) {
            spinner.fail(chalk.red(err.message ?? 'Failed to save'))
        }
    })

const envList = new Command('list')
    .description('List all your env sets')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()
        try {
            const { envSets } = await ApiClient.get('/env', token)
            spinner.stop()

            if (!envSets.length) {
                console.log(chalk.dim('\n  No env sets yet. Run: recall env save <name>\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Created')],
                style: { head: [], border: ['grey'] },
                colWidths: [30, 20],
            })

            for (const e of envSets) {
                table.push([chalk.white(e.name), new Date(e.createdAt).toLocaleDateString()])
            }

            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Failed to fetch env sets'))
        }
    })

const envShow = new Command('show')
    .argument('<name>', 'Env set name')
    .description('Show all variables in an env set')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()
        try {
            const envSet = await ApiClient.get(`/env/${encodeURIComponent(name)}`, token)
            spinner.stop()

            console.log(chalk.bold(`\n  ${envSet.name}\n`))

            for (const [key, value] of Object.entries(envSet.vars)) {
                console.log(`  ${chalk.cyan(key)}=${chalk.white(String(value))}`)
            }
            console.log()
        } catch {
            spinner.fail(chalk.red(`Env set "${name}" not found`))
        }
    })

const envUse = new Command('use')
    .argument('<name>', 'Env set name')
    .description('Print export commands to load env set into your shell')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()
        try {
            const envSet = await ApiClient.get(`/env/${encodeURIComponent(name)}`, token)
            spinner.stop()

            console.log(chalk.dim(`\n  # Run this to load "${name}" into your shell:`))
            console.log(chalk.dim('  # eval $(recall env use ' + name + ')\n'))

            for (const [key, value] of Object.entries(envSet.vars)) {
                console.log(`export ${key}="${value}"`)
            }
            console.log()
        } catch {
            spinner.fail(chalk.red(`Env set "${name}" not found`))
        }
    })

const envDelete = new Command('delete')
    .argument('<name>', 'Env set name')
    .description('Delete an env set')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Deleting...').start()
        try {
            await ApiClient.delete(`/env/${encodeURIComponent(name)}`, token)
            spinner.succeed(chalk.green(`Deleted env set "${name}"`))
        } catch {
            spinner.fail(chalk.red(`Env set "${name}" not found`))
        }
    })

export const envCommand = new Command('env')
    .description('Save and use environment variable sets')
    .addCommand(envSave)
    .addCommand(envList)
    .addCommand(envShow)
    .addCommand(envUse)
    .addCommand(envDelete)