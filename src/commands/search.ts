import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

function highlight(text: string, query: string): string {
    if (!query) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, chalk.yellow.bold('$1'))
}

function fuzzyMatch(text: string, query: string): boolean {
    const t = text.toLowerCase()
    const q = query.toLowerCase()

    // exact substring match
    if (t.includes(q)) return true

    // fuzzy — all chars of query appear in order in text
    let i = 0
    for (const ch of t) {
        if (ch === q[i]) i++
        if (i === q.length) return true
    }
    return false
}

export const searchCommand = new Command('search')
    .description('Search your saved commands')
    .argument('<query>', 'Search query')
    .option('-t, --tag <tag>', 'Filter by tag')
    .action(async (query: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Searching...').start()

        try {
            const params = new URLSearchParams()
            if (opts.tag) params.set('tag', opts.tag)

            const { commands } = await ApiClient.get(`/commands?${params}`, token)
            spinner.stop()

            // Fuzzy filter locally
            const results = commands.filter((cmd: any) => {
                return (
                    fuzzyMatch(cmd.command, query) ||
                    (cmd.name && fuzzyMatch(cmd.name, query)) ||
                    (cmd.tags && cmd.tags.some((t: string) => fuzzyMatch(t, query)))
                )
            })

            if (!results.length) {
                console.log(chalk.dim(`\n  No commands found matching "${query}".\n`))
                return
            }

            console.log(chalk.dim(`\n  ${results.length} result${results.length === 1 ? '' : 's'} for "${chalk.white(query)}"\n`))

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Command'), chalk.cyan('Tags')],
                style: { head: [], border: ['grey'] },
                colWidths: [20, 46, 18],
                wordWrap: true,
            })

            for (const cmd of results) {
                const name = cmd.name ?? '—'
                const command = cmd.command.length > 44
                    ? cmd.command.slice(0, 44) + '…'
                    : cmd.command
                const tags = (cmd.tags ?? []).join(', ') || '—'

                table.push([
                    highlight(name, query),
                    highlight(command, query),
                    highlight(tags, query),
                ])
            }

            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Search failed'))
        }
    })