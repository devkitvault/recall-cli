import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'

const ACTION_COLORS: Record<string, string> = {
    approval_requested: 'yellow',
    approval_granted: 'green',
    require_approval_on: 'cyan',
    require_approval_off: 'dim',
    command_run: 'white',
    member_joined: 'green',
    member_removed: 'red',
}

export const auditCommand = new Command('audit')
    .description('Show org audit log (Team plan)')
    .option('-l, --limit <n>', 'Number of entries', '30')
    .action(async (opts) => {
        const token = await requireAuth()
        const spinner = ora('Fetching audit log...').start()

        try {
            const { user } = await ApiClient.get('/auth/me', token)
            const orgRes = await ApiClient.get('/orgs/me', token)
            const org = orgRes.org

            const { audit } = await ApiClient.get(
                `/orgs/${org.id}/audit?limit=${opts.limit}`,
                token
            )
            spinner.stop()

            if (!audit.length) {
                console.log(chalk.dim('\n  No audit events yet.\n'))
                return
            }

            console.log(chalk.bold(`\n  Audit log — ${org.name}\n`))

            for (const log of audit) {
                const time = new Date(log.createdAt).toLocaleString()
                const color = ACTION_COLORS[log.action] ?? 'white'
                const action = (chalk as any)[color]?.(log.action) ?? log.action
                const username = chalk.cyan(log.username)
                const details = log.details ? chalk.dim(` — ${log.details}`) : ''

                console.log(`  ${chalk.dim(time)}  ${username}  ${action}${details}`)
            }

            console.log()
        } catch (err) {
            spinner.stop()
            if (err instanceof ApiError && err.status === 403) {
                console.log(chalk.yellow('\n  Audit log requires a Team plan.'))
                console.log(chalk.dim('  Run: recall upgrade\n'))
            } else {
                console.error(chalk.red('\n  Failed to fetch audit log\n'))
            }
        }
    })