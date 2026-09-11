import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const listCommand = new Command('list')
    .description('List your saved commands')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-g, --group <group>', 'Filter by group (Pro)')
    .option('-s, --search <q>', 'Search by keyword')
    .option('-p, --pinned', 'Show pinned only')
    .action(async (opts) => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()

        try {
            const params = new URLSearchParams()
            if (opts.tag) params.set('tag', opts.tag)
            if (opts.group) params.set('group', opts.group)
            if (opts.search) params.set('search', opts.search)

            const { commands } = await ApiClient.get(`/commands?${params}`, token)
            spinner.stop()

            let result = commands

            // Filter pinned only
            if (opts.pinned) result = result.filter((c: any) => c.pinned)

            // Sort: pinned first, then by createdAt
            result.sort((a: any, b: any) => {
                if (a.pinned && !b.pinned) return -1
                if (!a.pinned && b.pinned) return 1
                return 0
            })

            if (!result.length) {
                console.log(chalk.dim('\n  No commands found.\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Pin'), chalk.cyan('Name'), chalk.cyan('Command'), chalk.cyan('Tags')],
                style: { head: [], border: ['grey'] },
                colWidths: [5, 18, 44, 18],
                wordWrap: true,
            })

            for (const cmd of result) {
                table.push([
                    cmd.pinned ? chalk.yellow('★') : chalk.dim('·'),
                    cmd.name ?? chalk.dim('—'),
                    cmd.command.length > 42
                        ? cmd.command.slice(0, 42) + '…'
                        : cmd.command,
                    (cmd.tags ?? []).join(', ') || chalk.dim('—'),
                ])
            }

            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Failed to fetch commands'))
        }
    })