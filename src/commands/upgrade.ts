import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import open from 'open'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

const PLANS = {
    free: {
        label: 'Free',
        price: '$0/month',
        features: [
            'Local vault (no account needed)',
            '100 cloud command saves',
            '3 playbooks',
            'Search and filter',
            'Export as JSON or shell script',
            'No AI Ask (Pro)',
        ],
    },
    pro: {
        label: 'Pro',
        price: '$6/month',
        features: [
            '500 AI asks / month',
            'Cross-machine sync',
            'Unlimited playbooks',
            'Unlimited commands',
            'Command groups',
            'Share commands via link',
        ],
    },
    team: {
        label: 'Team',
        price: '$12/month per seat',
        features: [
            'Everything in Pro',
            'Org-level vaults',
            'Role-based access',
            'Audit log',
        ],
    },
}

function printPlan(key: string, current: boolean) {
    const plan = PLANS[key as keyof typeof PLANS]
    const prefix = current ? chalk.green('▶ ') : '  '
    const label = current
        ? chalk.green.bold(`${plan.label} (current)`)
        : chalk.white.bold(plan.label)

    console.log(`${prefix}${label} — ${chalk.dim(plan.price)}`)
    for (const f of plan.features) {
        console.log(`    ${chalk.dim('·')} ${chalk.dim(f)}`)
    }
    console.log()
}

export const upgradeCommand = new Command('upgrade')
    .description('Upgrade your recall plan')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching account info...').start()

        let currentPlan = 'free'

        try {
            const { user } = await ApiClient.get('/auth/me', token)
            currentPlan = user.plan ?? 'free'
            spinner.stop()
        } catch {
            spinner.stop()
        }

        console.log()
        console.log(chalk.bold('  recall plans\n'))

        printPlan('free', currentPlan === 'free')
        printPlan('pro', currentPlan === 'pro')
        printPlan('team', currentPlan === 'team')

        if (currentPlan === 'team') {
            console.log(chalk.green('  You are on the highest plan. Thank you!\n'))
            return
        }

        const upgradeTo = currentPlan === 'free'
            ? [
                { name: 'Upgrade to Pro  — $6/month', value: 'pro' },
                { name: 'Upgrade to Team — $12/month per seat', value: 'team' },
                { name: 'Maybe later', value: 'exit' },
            ]
            : [
                { name: 'Upgrade to Team — $12/month per seat', value: 'team' },
                { name: 'Maybe later', value: 'exit' },
            ]

        const { choice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'choice',
                message: 'Which plan would you like?',
                choices: upgradeTo,
            },
        ])

        if (choice === 'exit') {
            console.log(chalk.dim('\n  No changes made.\n'))
            return
        }

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Open billing page to upgrade to ${PLANS[choice as keyof typeof PLANS].label}?`,
                default: true,
            },
        ])

        if (!confirm) {
            console.log(chalk.dim('\n  No changes made.\n'))
            return
        }

        const billingUrl = `https://devkitvault.com/recall/upgrade?plan=${choice}`
        await open(billingUrl)

        console.log()
        console.log(chalk.green('  Billing page opened in your browser.'))
        console.log(chalk.dim(`  ${billingUrl}`))
        console.log(chalk.dim('\n  After payment your plan will update automatically.\n'))
    })