import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs'
import ora from 'ora'
import os from 'os'
import path from 'path'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const CACHE_DIR = path.join(os.homedir(), '.recall')
const CACHE_FILE = path.join(CACHE_DIR, 'commands.json')

function writeCache(commands: any[]): void {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
        syncedAt: new Date().toISOString(),
        commands,
    }, null, 2))
}

function readCache(): { syncedAt: string; commands: any[] } | null {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    } catch {
        return null
    }
}

export function getCachedCommands(): any[] {
    const cache = readCache()
    return cache?.commands ?? []
}

export const syncCommand = new Command('sync')
    .description('Sync commands from server to local cache')
    .option('-s, --status', 'Show last sync status without syncing')
    .action(async (opts) => {
        // Just show status
        if (opts.status) {
            const cache = readCache()
            if (!cache) {
                console.log(chalk.dim('\n  Never synced. Run: recall sync\n'))
                return
            }
            const ago = Math.round(
                (Date.now() - new Date(cache.syncedAt).getTime()) / 1000 / 60
            )
            console.log()
            console.log(`  Last synced: ${chalk.white(ago < 1 ? 'just now' : `${ago} minutes ago`)}`)
            console.log(`  Commands:   ${chalk.white(cache.commands.length)} cached locally`)
            console.log(`  Cache file: ${chalk.dim(CACHE_FILE)}`)
            console.log()
            return
        }

        const token = await requireAuth()
        const spinner = ora('Syncing from server...').start()

        try {
            const { commands } = await ApiClient.get('/commands', token)

            writeCache(commands)

            spinner.succeed(chalk.green(`Synced ${commands.length} command${commands.length === 1 ? '' : 's'}`))

            console.log()
            console.log(`  ${chalk.dim('Cached to:')} ${chalk.dim(CACHE_FILE)}`)

            if (commands.length) {
                console.log()
                console.log(chalk.dim('  Commands available offline:'))
                for (const cmd of commands) {
                    const name = cmd.name ? chalk.white(cmd.name) : chalk.dim('unnamed')
                    console.log(`    · ${name}  ${chalk.dim(cmd.command.slice(0, 50))}`)
                }
            }

            console.log()
        } catch {
            spinner.fail(chalk.red('Sync failed'))
            console.log(chalk.dim('\n  Make sure you are logged in and the API is reachable.\n'))
        }
    })