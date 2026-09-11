import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import open from 'open'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { getToken } from '../lib/auth'

const supportTicket = new Command('ticket')
    .description('Submit a support ticket')
    .action(async () => {
        const token = await getToken()

        if (!token) {
            console.log(chalk.dim('\n  Not logged in — opening support page instead.\n'))
            await open('https://devkitvault.com/recall/support')
            return
        }

        console.log(chalk.bold('\n  Submit a support ticket\n'))

        const { subject, message } = await inquirer.prompt([
            {
                type: 'input',
                name: 'subject',
                message: 'Subject:',
                validate: (v: string) => v.length > 0 || 'Subject is required',
            },
            {
                type: 'editor',
                name: 'message',
                message: 'Describe your issue (opens editor):',
                validate: (v: string) => v.length > 0 || 'Message is required',
            },
        ])

        const spinner = ora('Submitting ticket...').start()

        try {
            await ApiClient.post('/support/tickets', { subject, message }, token)
            spinner.succeed(chalk.green('Ticket submitted!'))
            console.log(chalk.dim('\n  We will reply to your email within 24 hours.\n'))
        } catch {
            spinner.fail(chalk.red('Failed to submit ticket'))
            console.log(chalk.dim('  Try: https://devkitvault.com/recall/support\n'))
        }
    })

const supportList = new Command('list')
    .description('List your support tickets')
    .action(async () => {
        const token = await getToken()

        if (!token) {
            console.error(chalk.red('\n  Not logged in. Run: recall auth login\n'))
            return
        }

        const spinner = ora('Fetching tickets...').start()

        try {
            const { tickets } = await ApiClient.get('/support/tickets', token)
            spinner.stop()

            if (!tickets.length) {
                console.log(chalk.dim('\n  No tickets yet.\n'))
                return
            }

            console.log()
            for (const t of tickets) {
                const statusColor = t.status === 'resolved'
                    ? chalk.green(t.status)
                    : t.status === 'in-progress'
                        ? chalk.yellow(t.status)
                        : chalk.red(t.status)

                console.log(`  ${statusColor}  ${chalk.white(t.subject)}`)
                console.log(`         ${chalk.dim(new Date(t.createdAt).toLocaleDateString())}`)

                if (t.reply) {
                    console.log(`         ${chalk.green('Reply:')} ${chalk.dim(t.reply.slice(0, 60))}...`)
                }
                console.log()
            }
        } catch {
            spinner.fail(chalk.red('Failed to fetch tickets'))
        }
    })

export const supportCommand = new Command('support')
    .description('Get help and submit support tickets')
    .addCommand(supportTicket)
    .addCommand(supportList)
    .action(async () => {
        console.log()
        console.log(chalk.bold('  recall support\n'))
        console.log(`  ${chalk.dim('Documentation:')} https://devkitvault.com/recall/docs`)
        console.log(`  ${chalk.dim('Submit ticket:')} recall support ticket`)
        console.log(`  ${chalk.dim('View tickets:')}  recall support list`)
        console.log(`  ${chalk.dim('Email:')}         support@devkitvault.com`)
        console.log()
    })