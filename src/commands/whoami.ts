import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const PLAN_LABELS: Record<string, string> = {
    free: chalk.dim('Free'),
    pro: chalk.cyan('Pro'),
    team: chalk.magenta('Team'),
}

const PLAN_FEATURES: Record<string, string[]> = {
    free: [
        'Unlimited command saves',
        'Search and filter',
        'Export as JSON or shell script',
        'Cross-machine sync',
    ],
    pro: [
        'Everything in Free',
        'Command groups',
        'Share commands via link',
    ],
    team: [
        'Everything in Pro',
        'Org-level vaults',
        'Role-based access',
        'SSO / SAML',
        'Audit log',
    ],
}

export const whoamiCommand = new Command('whoami')
    .description('Show current logged in user and plan info')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching account info...').start()

        try {
            const { user, stats } = await ApiClient.get('/auth/me', token)
            spinner.stop()

            const plan = user.plan ?? 'free'
            const label = PLAN_LABELS[plan] ?? plan
            const features = PLAN_FEATURES[plan] ?? []

            console.log()
            console.log(`  ${chalk.bold(user.username)}`)
            console.log(`  ${chalk.dim(user.email)}`)
            console.log()
            console.log(`  Plan:     ${label}`)
            console.log(`  Commands: ${chalk.white(stats.commandCount)}`)
            console.log(`  Member since: ${chalk.dim(new Date(user.createdAt).toLocaleDateString())}`)
            console.log()
            console.log(chalk.dim('  Plan includes:'))
            for (const feature of features) {
                console.log(chalk.dim(`    · ${feature}`))
            }

            if (plan === 'free') {
                console.log()
                console.log(chalk.dim('  Upgrade to Pro for groups and sharing:'))
                console.log(chalk.dim('  https://devkitvault.com/recall/upgrade'))
            }

            console.log()
        } catch {
            spinner.fail(chalk.red('Failed to fetch account info'))
        }
    })