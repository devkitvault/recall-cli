import chalk from 'chalk'
import { Command } from 'commander'
import { ApiClient } from '../lib/api'
import { getToken } from '../lib/auth'
import { APP_VERSION, getConfig } from '../lib/config'

const CHECK = chalk.green('✔')
const FAIL = chalk.red('✖')
const WARN = chalk.yellow('!')

async function check(label: string, fn: () => Promise<{ ok: boolean; info: string }>) {
    try {
        const result = await fn()
        const icon = result.ok ? CHECK : FAIL
        console.log(`  ${icon}  ${label.padEnd(28)} ${result.ok ? chalk.dim(result.info) : chalk.red(result.info)}`)
        return result.ok
    } catch (err: any) {
        console.log(`  ${FAIL}  ${label.padEnd(28)} ${chalk.red(err.message ?? 'failed')}`)
        return false
    }
}

export const doctorCommand = new Command('doctor')
    .description('Check your recall setup and connectivity')
    .action(async () => {
        console.log(chalk.bold('\n  recall doctor\n'))

        const config = getConfig()
        const version = APP_VERSION

        let allOk = true

        // 1. Config file
        const configOk = await check('Config file', async () => ({
            ok: true,
            info: `API URL: ${config.apiUrl}`,
        }))
        if (!configOk) allOk = false

        // 2. API reachable
        const apiOk = await check('API reachable', async () => {
            const res = await fetch(`${config.apiUrl}/health`)
            const data = await res.json()
            return {
                ok: data.status === 'ok',
                info: `${config.apiUrl}/health`,
            }
        })
        if (!apiOk) allOk = false

        // 3. Token exists
        const token = await getToken()
        const tokenOk = await check('Auth token', async () => ({
            ok: !!token,
            info: token ? 'Found in keychain' : 'Not found — run: recall auth login',
        }))
        if (!tokenOk) allOk = false

        // 4. Token valid
        if (token) {
            const authOk = await check('Token valid', async () => {
                const { user } = await ApiClient.get('/auth/me', token)
                return {
                    ok: true,
                    info: `${user.username} — ${user.plan} plan`,
                }
            })
            if (!authOk) allOk = false

            // 5. Plan info
            await check('Plan', async () => {
                const { user, stats } = await ApiClient.get('/auth/me', token)
                return {
                    ok: true,
                    info: `${user.plan} — ${stats.commandCount} commands saved`,
                }
            })
        }

        // 6. Version
        await check('CLI version', async () => ({
            ok: true,
            info: `v${version}`,
        }))

        // 7. Environment
        await check('Environment', async () => {
            const isLocal = config.apiUrl.includes('127.0.0.1') ||
                config.apiUrl.includes('localhost')
            return {
                ok: true,
                info: isLocal ? 'local' : 'production',
            }
        })

        console.log()

        if (allOk) {
            console.log(chalk.green('  Everything looks good!\n'))
        } else {
            console.log(chalk.yellow('  Some checks failed. See above for details.\n'))
            console.log(chalk.dim('  Common fixes:'))
            console.log(chalk.dim('  · Not logged in?    run: recall auth login'))
            console.log(chalk.dim('  · API not running?  cd packages/api && pnpm dev'))
            console.log(chalk.dim('  · Wrong API URL?    run: recall config switch'))
            console.log()
        }
    })