import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'
import { listLocalCommands, VAULT_FILE } from '../lib/local-vault'

export const listCommand = new Command('list')
    .description('List commands in your local vault')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('-g, --group <group>', 'Filter by group (Pro cloud — not used locally)')
    .option('-s, --search <q>', 'Search by keyword')
    .option('-p, --pinned', 'Show pinned only')
    .action(async (opts) => {
        if (opts.group) {
            console.log(chalk.dim('  Local vault has no groups. Showing all local commands.\n'))
        }

        const result = listLocalCommands({
            tag: opts.tag,
            search: opts.search,
            pinned: opts.pinned,
        })

        if (!result.length) {
            console.log(chalk.dim('\n  No commands in local vault.'))
            console.log(chalk.dim(`  Save one: recall save "echo hi" -n hi`))
            console.log(chalk.dim(`  File: ${VAULT_FILE}\n`))
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
        console.log(chalk.dim(`\n  ${result.length} local · ${VAULT_FILE}\n`))
    })
