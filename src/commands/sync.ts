import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'
import {
    attachCloudId,
    localCommandsNeedingPush,
    mergeCloudIntoLocal,
    readVault,
    VAULT_FILE,
} from '../lib/local-vault'

export const syncCommand = new Command('sync')
    .description('Sync local vault ↔ cloud (Pro/Team)')
    .option('-s, --status', 'Show local vault + last sync status')
    .option('--pull', 'Pull cloud → local only')
    .option('--push', 'Push local-only commands → cloud only')
    .action(async (opts) => {
        const vault = readVault()

        if (opts.status) {
            console.log()
            console.log(`  Local commands: ${chalk.white(vault.commands.length)}`)
            console.log(`  Vault file:     ${chalk.dim(VAULT_FILE)}`)
            if (!vault.syncedAt) {
                console.log(chalk.dim('  Never synced to cloud.'))
            } else {
                const ago = Math.round(
                    (Date.now() - new Date(vault.syncedAt).getTime()) / 1000 / 60,
                )
                console.log(`  Last synced:    ${chalk.white(ago < 1 ? 'just now' : `${ago} minutes ago`)}`)
            }
            const pending = localCommandsNeedingPush().length
            if (pending) {
                console.log(`  Not on cloud:   ${chalk.yellow(String(pending))} (recall sync --push)`)
            }
            console.log()
            return
        }

        const doPull = opts.pull || (!opts.pull && !opts.push)
        const doPush = opts.push || (!opts.pull && !opts.push)

        const token = await requireAuth()
        const spinner = ora('Checking plan...').start()

        try {
            const { user } = await ApiClient.get('/auth/me', token)
            const plan = (user.plan ?? 'free') as string
            spinner.stop()
            if (plan !== 'pro' && plan !== 'team') {
                console.log(chalk.yellow('\n  Cloud sync requires Pro or Team.'))
                console.log(chalk.dim('  Local vault still works without sync.'))
                console.log(chalk.dim('  Upgrade: recall upgrade\n'))
                process.exit(1)
            }
        } catch (err) {
            spinner.fail(chalk.red('Could not verify plan'))
            if (err instanceof ApiError && err.status === 401) {
                console.log(chalk.red('\n  Session expired. Run: recall auth login\n'))
            }
            process.exit(1)
        }

        let pulled = 0
        let pushed = 0

        if (doPull) {
            const pullSpinner = ora('Pulling from cloud...').start()
            try {
                const { commands } = await ApiClient.get('/commands', token)
                const { added, updated } = mergeCloudIntoLocal(commands)
                pulled = added + updated
                pullSpinner.succeed(
                    chalk.green(
                        `Pulled cloud vault (${added} new, ${updated} updated)`,
                    ),
                )
            } catch (err) {
                pullSpinner.fail(chalk.red('Pull failed'))
                if (err instanceof ApiError && err.status === 403) {
                    console.log(chalk.yellow('\n  Cloud vault requires Pro.\n'))
                }
                process.exit(1)
            }
        }

        if (doPush) {
            const pending = localCommandsNeedingPush()
            if (!pending.length) {
                console.log(chalk.dim('  Nothing new to push.'))
            } else {
                const pushSpinner = ora(`Pushing ${pending.length} local command(s)...`).start()
                try {
                    for (const cmd of pending) {
                        const saved = await ApiClient.post(
                            '/commands',
                            {
                                command: cmd.command,
                                name: cmd.name,
                                tags: cmd.tags,
                            },
                            token,
                        )
                        if (saved?.id) attachCloudId(cmd.id, saved.id)
                        pushed++
                    }
                    pushSpinner.succeed(chalk.green(`Pushed ${pushed} command${pushed === 1 ? '' : 's'} to cloud`))
                } catch (err) {
                    pushSpinner.fail(chalk.red('Push failed'))
                    if (err instanceof ApiError && err.status === 403) {
                        console.log(chalk.yellow('\n  Cloud save requires Pro. Local vault is unchanged.\n'))
                    }
                    process.exit(1)
                }
            }
        }

        console.log()
        console.log(`  ${chalk.dim('Local vault:')} ${chalk.dim(VAULT_FILE)}`)
        if (doPull || doPush) {
            console.log(chalk.dim(`  pull≈${pulled} · push=${pushed}`))
        }
        console.log()
    })

/** @deprecated kept for any imports — use readVault */
export function getCachedCommands() {
    return readVault().commands
}
