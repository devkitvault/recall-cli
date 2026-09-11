import chalk from 'chalk'
import { Command } from 'commander'
import { setLocalPinned } from '../lib/local-vault'

export const pinCommand = new Command('pin')
    .description('Pin or unpin a local command')
    .argument('<name>', 'Command name')
    .option('-u, --unpin', 'Unpin instead of pin')
    .action(async (name: string, opts) => {
        const pinned = !opts.unpin
        const cmd = setLocalPinned(name, pinned)
        if (!cmd) {
            console.log(chalk.red(`\n  Command "${name}" not found in local vault.\n`))
            process.exit(1)
        }
        console.log(
            pinned
                ? chalk.green(`  Pinned "${name}" — it will appear at the top of recall list\n`)
                : chalk.green(`  Unpinned "${name}"\n`),
        )
    })
