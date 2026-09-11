import chalk from 'chalk'
import { Command } from 'commander'
import open from 'open'

export const feedbackCommand = new Command('feedback')
    .description('Send feedback or report a bug')
    .option('-b, --bug', 'Report a bug')
    .option('-i, --idea', 'Suggest a feature')
    .action(async (opts) => {
        let url = 'https://devkitvault.com/recall/feedback'

        if (opts.bug) url += '?type=bug'
        if (opts.idea) url += '?type=idea'

        console.log()
        console.log(chalk.bold('  Opening feedback page...'))
        console.log(chalk.dim(`  ${url}`))
        console.log()

        await open(url)
    })