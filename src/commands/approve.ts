import chalk from 'chalk'
import { execSync } from 'child_process'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'

const approveRequest = new Command('request')
    .argument('<command-name>', 'Org command name to request approval for')
    .description('Request approval to run an org command')
    .action(async (commandName: string) => {
        const token = await requireAuth()
        const spinner = ora('Creating approval request...').start()

        try {
            const orgRes = await ApiClient.get('/orgs/me', token)
            const org = orgRes.org
            const { commands } = await ApiClient.get(`/orgs/${org.id}/commands`, token)
            const cmd = commands.find((c: any) => c.name === commandName)

            if (!cmd) {
                spinner.fail(chalk.red(`Command "${commandName}" not found in org vault`))
                return
            }

            const result = await ApiClient.post(
                `/orgs/${org.id}/commands/${cmd.id}/request-approval`,
                {},
                token
            )

            spinner.stop()
            console.log(chalk.bold('\n  Approval request created\n'))
            console.log(`  ${chalk.dim('Command:')} ${chalk.white(cmd.command)}`)
            console.log()
            console.log(chalk.dim('  Share this with an org admin to approve:'))
            console.log(`  ${chalk.cyan(result.approveCommand)}`)
            console.log()
        } catch (err) {
            spinner.stop()
            if (err instanceof ApiError) {
                console.error(chalk.red(`\n  ${err.message}\n`))
            }
        }
    })

const approveGrant = new Command('grant')
    .argument('<token>', 'Approval token')
    .description('Approve a pending request')
    .option('-r, --run', 'Run the command immediately after approving')
    .action(async (token: string, opts) => {
        const authToken = await requireAuth()
        const spinner = ora('Processing approval...').start()

        try {
            const result = await ApiClient.post(
                `/orgs/approve/${token}`,
                {},
                authToken
            )

            spinner.succeed(chalk.green('Approved!'))
            console.log()
            console.log(`  ${chalk.dim('Command:')} ${chalk.white(result.command)}`)
            console.log()

            if (opts.run) {
                console.log(chalk.dim(`  Running: ${result.command}\n`))
                execSync(result.command, { stdio: 'inherit' })
            } else {
                console.log(chalk.dim('  Run it with: recall org run ' + result.name))
            }
            console.log()
        } catch (err) {
            spinner.stop()
            if (err instanceof ApiError) {
                console.error(chalk.red(`\n  ${err.message}\n`))
            }
        }
    })

const approveList = new Command('list')
    .description('List pending approval requests in your org')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching approvals...').start()

        try {
            const orgRes = await ApiClient.get('/orgs/me', token)
            const org = orgRes.org
            const { approvals } = await ApiClient.get(`/orgs/${org.id}/approvals`, token)
            spinner.stop()

            if (!approvals.length) {
                console.log(chalk.dim('\n  No pending approval requests.\n'))
                return
            }

            console.log(chalk.bold(`\n  Pending approvals — ${org.name}\n`))

            for (const a of approvals) {
                const time = new Date(a.createdAt).toLocaleString()
                console.log(
                    `  ${chalk.yellow('●')}  ` +
                    `${chalk.dim(time)}  ` +
                    chalk.dim(`command: ${a.commandId}`)
                )
                console.log(
                    `     Approve with: ${chalk.cyan('recall approve grant ' + a.token)}`
                )
                console.log()
            }
        } catch (err) {
            spinner.stop()
            if (err instanceof ApiError) {
                console.error(chalk.red(`\n  ${err.message}\n`))
            }
        }
    })

export const approveCommand = new Command('approve')
    .description('Manage command approval requests (Team plan)')
    .addCommand(approveRequest)
    .addCommand(approveGrant)
    .addCommand(approveList)