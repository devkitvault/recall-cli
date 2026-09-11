import chalk from 'chalk'
import { execSync } from 'child_process'
import Table from 'cli-table3'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

interface Playbook {
    id: string
    name: string
    steps: string[]
    createdAt: string
}

const playbookSave = new Command('save')
    .argument('<name>', 'Playbook name')
    .argument('<steps...>', 'Ordered commands to run')
    .description('Save an ordered workflow')
    .action(async (name: string, steps: string[]) => {
        const token = await requireAuth()
        const cleaned = steps.map((s) => s.trim()).filter(Boolean)
        if (!cleaned.length) {
            console.log(chalk.yellow('\n  At least one step is required.\n'))
            return
        }
        const spinner = ora('Saving playbook...').start()
        try {
            await ApiClient.post('/playbooks', { name, steps: cleaned }, token)
            spinner.succeed(chalk.green(`Playbook "${name}" saved`))
            console.log(chalk.dim(`\n  ${cleaned.length} step${cleaned.length === 1 ? '' : 's'}. Ask never runs them.\n`))
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save playbook'
            spinner.fail(chalk.red(message))
        }
    })

const playbookList = new Command('list')
    .description('List your playbooks')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching playbooks...').start()
        try {
            const { playbooks } = await ApiClient.get('/playbooks', token) as { playbooks: Playbook[] }
            spinner.stop()
            if (!playbooks.length) {
                console.log(chalk.dim('\n  No playbooks yet.'))
                console.log(chalk.dim('  Run: recall playbook save deploy "docker compose up -d" "pnpm migrate"\n'))
                return
            }
            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Steps')],
                style: { head: [], border: ['grey'] },
                colWidths: [24, 48],
                wordWrap: true,
            })
            for (const book of playbooks) {
                table.push([
                    chalk.white(book.name),
                    book.steps.join(' → '),
                ])
            }
            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Failed to fetch playbooks'))
        }
    })

const playbookShow = new Command('show')
    .argument('<name>', 'Playbook name')
    .description('Show playbook steps')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()
        try {
            const book = await ApiClient.get(
                `/playbooks/by-name/${encodeURIComponent(name)}`,
                token,
            ) as Playbook
            spinner.stop()
            console.log(chalk.bold(`\n  ${book.name}\n`))
            book.steps.forEach((step, i) => {
                console.log(`  ${chalk.dim(String(i + 1).padStart(2, '0'))}  ${step}`)
            })
            console.log()
        } catch {
            spinner.fail(chalk.red(`Playbook "${name}" not found`))
        }
    })

const playbookRun = new Command('run')
    .argument('<name>', 'Playbook name')
    .option('-d, --dry-run', 'Print steps without running')
    .description('Run playbook steps in order (this executes)')
    .action(async (name: string, opts: { dryRun?: boolean }) => {
        const token = await requireAuth()
        const spinner = ora('Fetching playbook...').start()
        try {
            const book = await ApiClient.get(
                `/playbooks/by-name/${encodeURIComponent(name)}`,
                token,
            ) as Playbook
            spinner.stop()
            console.log(chalk.dim(`\n  Playbook: ${chalk.white(book.name)}\n`))
            if (opts.dryRun) {
                book.steps.forEach((step, i) => {
                    console.log(`  ${i + 1}. ${step}`)
                })
                console.log()
                return
            }
            await ApiClient.post(`/playbooks/${book.id}/run`, {}, token)
            for (const [i, step] of book.steps.entries()) {
                console.log(chalk.dim(`  step ${i + 1}/${book.steps.length}`))
                execSync(step, { stdio: 'inherit' })
            }
            console.log()
        } catch (err: unknown) {
            spinner.stop()
            const message = err instanceof Error ? err.message : `Playbook "${name}" failed`
            console.error(chalk.red(`\n  ${message}\n`))
        }
    })

const playbookDelete = new Command('delete')
    .argument('<name>', 'Playbook name')
    .description('Delete a playbook')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Looking up...').start()
        try {
            const book = await ApiClient.get(
                `/playbooks/by-name/${encodeURIComponent(name)}`,
                token,
            ) as Playbook
            spinner.text = 'Deleting...'
            await ApiClient.delete(`/playbooks/${book.id}`, token)
            spinner.succeed(chalk.green(`Deleted playbook "${name}"`))
        } catch {
            spinner.fail(chalk.red(`Playbook "${name}" not found`))
        }
    })

export const playbookCommand = new Command('playbook')
    .description('Ordered multi-step workflows')
    .addCommand(playbookSave)
    .addCommand(playbookList)
    .addCommand(playbookShow)
    .addCommand(playbookRun)
    .addCommand(playbookDelete)
