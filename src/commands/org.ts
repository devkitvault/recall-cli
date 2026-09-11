import chalk from 'chalk'
import { execSync } from 'child_process'
import Table from 'cli-table3'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'

function planError(err: any): boolean {
    if (err instanceof ApiError && err.status === 403) {
        console.log(chalk.yellow('\n  Org vaults require a Team plan.'))
        console.log(chalk.dim(`  Upgrade at ${chalk.white('https://devkitvault.com/recall/upgrade')}`))
        console.log(chalk.dim('  Or run: recall upgrade\n'))
        return true
    }
    return false
}

async function getMyOrg(token: string) {
    const { org } = await ApiClient.get('/orgs/me', token)
    return org
}

// org create
const orgCreate = new Command('create')
    .argument('<name>', 'Organization name')
    .description('Create a new organization')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora(`Creating org "${name}"...`).start()
        try {
            const org = await ApiClient.post('/orgs', { name }, token)
            spinner.succeed(chalk.green(`Org "${org.name}" created`))
            console.log(chalk.dim(`\n  You are the admin.\n`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                if (err instanceof ApiError && err.status === 409) {
                    console.error(chalk.red(`\n  Org "${name}" already exists\n`))
                } else {
                    console.error(chalk.red('\n  Failed to create org\n'))
                }
            }
        }
    })

// org members
const orgMembers = new Command('members')
    .description('List all members in your org')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching members...').start()
        try {
            const org = await getMyOrg(token)
            const { members } = await ApiClient.get(`/orgs/${org.id}/members`, token)
            spinner.stop()

            const table = new Table({
                head: [chalk.cyan('Username'), chalk.cyan('Email'), chalk.cyan('Role'), chalk.cyan('Joined')],
                style: { head: [], border: ['grey'] },
                colWidths: [20, 28, 10, 14],
            })

            for (const m of members) {
                const roleColor = m.role === 'admin'
                    ? chalk.yellow(m.role)
                    : m.role === 'member'
                        ? chalk.white(m.role)
                        : chalk.dim(m.role)

                table.push([
                    m.username,
                    m.email,
                    roleColor,
                    new Date(m.joinedAt).toLocaleDateString(),
                ])
            }

            console.log(table.toString())
        } catch (err) {
            spinner.stop()
            planError(err)
        }
    })

// org invite
const orgInvite = new Command('invite')
    .argument('<email>', 'Email to invite')
    .description('Invite a member to your org')
    .action(async (email: string) => {
        const token = await requireAuth()
        const spinner = ora(`Inviting ${email}...`).start()
        try {
            const org = await getMyOrg(token)
            const result = await ApiClient.post(`/orgs/${org.id}/invite`, { email }, token)
            spinner.succeed(chalk.green(`Invited ${email}`))
            console.log()
            console.log(`  ${chalk.dim('They can join with:')}`)
            console.log(`  ${chalk.white(result.joinCommand)}`)
            console.log()
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to invite member\n'))
            }
        }
    })

// org join
const orgJoin = new Command('join')
    .argument('<token>', 'Invite token')
    .description('Join an org using an invite token')
    .action(async (token: string) => {
        const authToken = await requireAuth()
        const spinner = ora('Joining org...').start()
        try {
            const result = await ApiClient.post('/orgs/join', { token }, authToken)
            spinner.succeed(chalk.green(result.message))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                if (err instanceof ApiError) {
                    console.error(chalk.red(`\n  ${err.message}\n`))
                }
            }
        }
    })

// org role
const orgRole = new Command('role')
    .argument('<username>', 'Member username')
    .argument('<role>', 'Role: admin | member | viewer')
    .description('Set a member role')
    .action(async (username: string, role: string) => {
        const token = await requireAuth()
        const spinner = ora('Updating role...').start()
        try {
            const org = await getMyOrg(token)
            const { members } = await ApiClient.get(`/orgs/${org.id}/members`, token)
            const member = members.find((m: any) => m.username === username)

            if (!member) {
                spinner.fail(chalk.red(`Member "${username}" not found`))
                return
            }

            await ApiClient.patch(`/orgs/${org.id}/members/${member.userId}`, { role }, token)
            spinner.succeed(chalk.green(`Set ${username} role to "${role}"`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to update role\n'))
            }
        }
    })

// org remove
const orgRemove = new Command('remove')
    .argument('<username>', 'Member username to remove')
    .description('Remove a member from your org')
    .action(async (username: string) => {
        const token = await requireAuth()

        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.red(`Remove "${username}" from the org?`),
            default: false,
        }])

        if (!confirm) {
            console.log(chalk.dim('\n  Cancelled.\n'))
            return
        }

        const spinner = ora('Removing member...').start()
        try {
            const org = await getMyOrg(token)
            const { members } = await ApiClient.get(`/orgs/${org.id}/members`, token)
            const member = members.find((m: any) => m.username === username)

            if (!member) {
                spinner.fail(chalk.red(`Member "${username}" not found`))
                return
            }

            await ApiClient.delete(`/orgs/${org.id}/members/${member.userId}`, token)
            spinner.succeed(chalk.green(`Removed "${username}" from org`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to remove member\n'))
            }
        }
    })

// org leave
const orgLeave = new Command('leave')
    .description('Leave your current org')
    .action(async () => {
        const token = await requireAuth()

        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.red('Leave your org?'),
            default: false,
        }])

        if (!confirm) {
            console.log(chalk.dim('\n  Cancelled.\n'))
            return
        }

        const spinner = ora('Leaving org...').start()
        try {
            const org = await getMyOrg(token)
            await ApiClient.delete(`/orgs/${org.id}/leave`, token)
            spinner.succeed(chalk.green('Left the org'))
        } catch (err) {
            spinner.stop()
            if (err instanceof ApiError) {
                console.error(chalk.red(`\n  ${err.message}\n`))
            }
        }
    })

// org delete
const orgDelete = new Command('delete')
    .description('Delete your org (permanent)')
    .action(async () => {
        const token = await requireAuth()

        const { confirm1 } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm1',
            message: chalk.red('Delete your org? This cannot be undone.'),
            default: false,
        }])

        if (!confirm1) {
            console.log(chalk.dim('\n  Cancelled.\n'))
            return
        }

        const { confirm2 } = await inquirer.prompt([{
            type: 'input',
            name: 'confirm2',
            message: 'Type DELETE to confirm:',
        }])

        if (confirm2 !== 'DELETE') {
            console.log(chalk.dim('\n  Cancelled.\n'))
            return
        }

        const spinner = ora('Deleting org...').start()
        try {
            const org = await getMyOrg(token)
            await ApiClient.delete(`/orgs/${org.id}`, token)
            spinner.succeed(chalk.green('Org deleted'))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to delete org\n'))
            }
        }
    })

// org save
const orgSave = new Command('save')
    .argument('<command>', 'Command to save')
    .option('-n, --name <name>', 'Command name')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-a, --approval', 'Require approval before running')
    .description('Save a command to the org vault')
    .action(async (command: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Saving to org vault...').start()
        try {
            const org = await getMyOrg(token)
            const saved = await ApiClient.post(`/orgs/${org.id}/commands`, {
                command,
                name: opts.name,
                tags: opts.tags?.split(',').map((t: string) => t.trim()),
                requireApproval: opts.approval ?? false,
            }, token)
            spinner.succeed(
                chalk.green(`Saved${saved.name ? ` as "${saved.name}"` : ''} to org vault`) +
                (opts.approval ? chalk.yellow(' — requires approval to run') : '')
            )
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to save command\n'))
            }
        }
    })

// org commands
const orgCommands2 = new Command('commands')
    .description('List all commands in the org vault')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching org commands...').start()
        try {
            const org = await getMyOrg(token)
            const { commands } = await ApiClient.get(`/orgs/${org.id}/commands`, token)
            spinner.stop()

            if (!commands.length) {
                console.log(chalk.dim('\n  No commands in org vault yet.\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Command'), chalk.cyan('Tags')],
                style: { head: [], border: ['grey'] },
                colWidths: [20, 46, 18],
                wordWrap: true,
            })

            for (const cmd of commands) {
                table.push([
                    cmd.name ?? chalk.dim('—'),
                    cmd.command.length > 44
                        ? cmd.command.slice(0, 44) + '…'
                        : cmd.command,
                    (cmd.tags ?? []).join(', ') || chalk.dim('—'),
                ])
            }

            console.log(table.toString())
        } catch (err) {
            spinner.stop()
            planError(err)
        }
    })

// org run
const orgRun = new Command('run')
    .argument('<name>', 'Command name')
    .option('-d, --dry-run', 'Print without running')
    .description('Run an org command by name')
    .action(async (name: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Looking up...').start()
        try {
            const org = await getMyOrg(token)
            const { commands } = await ApiClient.get(`/orgs/${org.id}/commands`, token)
            const cmd = commands.find((c: any) => c.name === name)

            if (!cmd) {
                spinner.fail(chalk.red(`Command "${name}" not found in org vault`))
                return
            }

            spinner.stop()

            // Check if approval required
            if (cmd.requireApproval) {
                console.log(chalk.yellow(`\n  This command requires approval before running.\n`))
                console.log(`  ${chalk.dim('Command:')} ${chalk.white(cmd.command)}`)
                console.log()
                console.log(chalk.dim('  Request approval with:'))
                console.log(`  ${chalk.cyan(`recall approve request ${name}`)}`)
                console.log()
                return
            }

            console.log(chalk.dim(`\n  $ ${cmd.command}\n`))

            if (!opts.dryRun) {
                execSync(cmd.command, { stdio: 'inherit' })
            }
        } catch (err) {
            spinner.stop()
            planError(err)
        }
    })

// org search
const orgSearch = new Command('search')
    .argument('<query>', 'Search query')
    .description('Search commands in the org vault')
    .action(async (query: string) => {
        const token = await requireAuth()
        const spinner = ora('Searching...').start()
        try {
            const org = await getMyOrg(token)
            const { commands } = await ApiClient.get(
                `/orgs/${org.id}/commands/search?q=${encodeURIComponent(query)}`,
                token
            )
            spinner.stop()

            if (!commands.length) {
                console.log(chalk.dim(`\n  No results for "${query}"\n`))
                return
            }

            console.log(chalk.dim(`\n  ${commands.length} result(s) for "${chalk.white(query)}"\n`))

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Command'), chalk.cyan('Tags')],
                style: { head: [], border: ['grey'] },
                colWidths: [20, 46, 18],
                wordWrap: true,
            })

            for (const cmd of commands) {
                table.push([
                    cmd.name ?? chalk.dim('—'),
                    cmd.command.length > 44
                        ? cmd.command.slice(0, 44) + '…'
                        : cmd.command,
                    (cmd.tags ?? []).join(', ') || chalk.dim('—'),
                ])
            }

            console.log(table.toString())
        } catch (err) {
            spinner.stop()
            planError(err)
        }
    })

export const orgCommand = new Command('org')
    .description('Manage org vaults (Team plan)')
    .addCommand(orgCreate)
    .addCommand(orgMembers)
    .addCommand(orgInvite)
    .addCommand(orgJoin)
    .addCommand(orgRole)
    .addCommand(orgRemove)
    .addCommand(orgLeave)
    .addCommand(orgDelete)
    .addCommand(orgSave)
    .addCommand(orgCommands2)
    .addCommand(orgRun)
    .addCommand(orgSearch)