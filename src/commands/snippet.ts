import chalk from 'chalk'
import { execSync } from 'child_process'
import Table from 'cli-table3'
import { Command } from 'commander'
import fs from 'fs'
import inquirer from 'inquirer'
import ora from 'ora'
import path from 'path'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const snippetSave = new Command('save')
    .argument('<name>', 'Snippet name')
    .option('-f, --file <path>', 'Load content from file')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .description('Save a multi-line script as a snippet')
    .action(async (name: string, opts) => {
        const token = await requireAuth()

        let content: string

        if (opts.file) {
            const filePath = path.resolve(opts.file)
            if (!fs.existsSync(filePath)) {
                console.error(chalk.red(`\n  File not found: ${filePath}\n`))
                process.exit(1)
            }
            content = fs.readFileSync(filePath, 'utf-8')
        } else {
            const { text } = await inquirer.prompt([{
                type: 'editor',
                name: 'text',
                message: 'Write your snippet (opens editor):',
            }])
            content = text
        }

        const spinner = ora('Saving snippet...').start()
        try {
            await ApiClient.post('/snippets', {
                name,
                content,
                tags: opts.tags?.split(',').map((t: string) => t.trim()) ?? [],
            }, token)
            spinner.succeed(chalk.green(`Saved snippet "${name}"`))
        } catch (err: any) {
            spinner.fail(chalk.red(err.message ?? 'Failed to save snippet'))
        }
    })

const snippetList = new Command('list')
    .description('List all your snippets')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching snippets...').start()
        try {
            const { snippets } = await ApiClient.get('/snippets', token)
            spinner.stop()

            if (!snippets.length) {
                console.log(chalk.dim('\n  No snippets yet. Run: recall snippet save <name>\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Tags'), chalk.cyan('Created')],
                style: { head: [], border: ['grey'] },
                colWidths: [24, 24, 16],
            })

            for (const s of snippets) {
                table.push([
                    chalk.white(s.name),
                    (s.tags ?? []).join(', ') || chalk.dim('—'),
                    new Date(s.createdAt).toLocaleDateString(),
                ])
            }

            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Failed to fetch snippets'))
        }
    })

const snippetShow = new Command('show')
    .argument('<name>', 'Snippet name')
    .description('Show snippet content')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()
        try {
            const snippet = await ApiClient.get(
                `/snippets/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.stop()

            console.log(chalk.bold(`\n  ${snippet.name}\n`))
            console.log(chalk.dim('─'.repeat(50)))
            console.log(snippet.content)
            console.log(chalk.dim('─'.repeat(50)))
            console.log()
        } catch {
            spinner.fail(chalk.red(`Snippet "${name}" not found`))
        }
    })

const snippetRun = new Command('run')
    .argument('<name>', 'Snippet name')
    .option('-d, --dry-run', 'Print without running')
    .description('Run a snippet')
    .action(async (name: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Fetching snippet...').start()
        try {
            const snippet = await ApiClient.get(
                `/snippets/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.stop()

            console.log(chalk.dim(`\n  Running snippet: ${chalk.white(snippet.name)}\n`))

            if (!opts.dryRun) {
                execSync(snippet.content, { stdio: 'inherit', shell: 'bash' })
            } else {
                console.log(snippet.content)
            }
        } catch {
            spinner.fail(chalk.red(`Snippet "${name}" not found`))
        }
    })

const snippetDelete = new Command('delete')
    .argument('<name>', 'Snippet name')
    .description('Delete a snippet')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Looking up...').start()
        try {
            const snippet = await ApiClient.get(
                `/snippets/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.text = 'Deleting...'
            await ApiClient.delete(`/snippets/${snippet.id}`, token)
            spinner.succeed(chalk.green(`Deleted snippet "${name}"`))
        } catch {
            spinner.fail(chalk.red(`Snippet "${name}" not found`))
        }
    })

export const snippetCommand = new Command('snippet')
    .description('Save and run multi-line shell scripts')
    .addCommand(snippetSave)
    .addCommand(snippetList)
    .addCommand(snippetShow)
    .addCommand(snippetRun)
    .addCommand(snippetDelete)