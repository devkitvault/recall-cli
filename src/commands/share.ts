import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const shareCreate = new Command('create')
    .argument('<name>', 'Command name to share')
    .option('-e, --expires <days>', 'Expire after N days')
    .description('Generate a shareable link for a command')
    .action(async (name: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Looking up command...').start()

        try {
            const cmd = await ApiClient.get(
                `/commands/by-name/${encodeURIComponent(name)}`,
                token
            )

            spinner.text = 'Creating share link...'
            const result = await ApiClient.post(`/commands/${cmd.id}/share`, {
                expiresIn: opts.expires ? parseInt(opts.expires) : undefined,
            }, token)

            spinner.stop()

            console.log()
            console.log(`  ${chalk.bold('Share link created')}\n`)
            console.log(`  ${chalk.dim('URL:')}     ${chalk.cyan(result.url)}`)
            console.log(`  ${chalk.dim('Command:')} ${chalk.white(cmd.command)}`)
            if (result.expiresAt) {
                console.log(`  ${chalk.dim('Expires:')} ${new Date(result.expiresAt).toLocaleDateString()}`)
            } else {
                console.log(`  ${chalk.dim('Expires:')} never`)
            }
            console.log()
            console.log(chalk.dim('  Anyone with this link can view and copy the command.'))
            console.log()
        } catch {
            spinner.fail(chalk.red(`Command "${name}" not found`))
        }
    })

const shareList = new Command('list')
    .description('List all your shared links')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching shared links...').start()

        try {
            const { shared } = await ApiClient.get('/commands/shared', token)
            spinner.stop()

            if (!shared.length) {
                console.log(chalk.dim('\n  No shared links yet. Run: recall share create <name>\n'))
                return
            }

            console.log()
            for (const s of shared) {
                const url = `https://devkitvault.com/recall/s/${s.slug}`
                const expired = s.expiresAt && new Date() > new Date(s.expiresAt)
                console.log(
                    `  ${expired ? chalk.red('✗') : chalk.green('✓')}  ` +
                    `${chalk.cyan(url)}  ` +
                    chalk.dim(`${s.views ?? 0} views`)
                )
            }
            console.log()
        } catch {
            spinner.fail(chalk.red('Failed to fetch shared links'))
        }
    })

const shareDelete = new Command('delete')
    .argument('<slug>', 'Share link slug to delete')
    .description('Delete a shared link')
    .action(async (slug: string) => {
        const token = await requireAuth()
        const spinner = ora('Deleting...').start()
        try {
            await ApiClient.delete(`/commands/shared/${slug}`, token)
            spinner.succeed(chalk.green('Share link deleted'))
        } catch {
            spinner.fail(chalk.red('Failed to delete share link'))
        }
    })

export const shareCommand = new Command('share')
    .description('Share commands via public links')
    .addCommand(shareCreate)
    .addCommand(shareList)
    .addCommand(shareDelete)