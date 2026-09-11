import chalk from 'chalk'
import Table from 'cli-table3'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'

function planError(err: any): boolean {
    if (err instanceof ApiError && err.status === 403) {
        console.log(chalk.yellow('\n  Groups require a Pro plan.'))
        console.log(chalk.dim(`  Upgrade at ${chalk.white('https://devkitvault.com/recall/upgrade')}`))
        console.log(chalk.dim('  Or run: recall upgrade\n'))
        return true
    }
    return false
}

const groupCreate = new Command('create')
    .argument('<name>', 'Group name')
    .description('Create a new command group')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora(`Creating group "${name}"...`).start()
        try {
            await ApiClient.post('/groups', { name }, token)
            spinner.succeed(chalk.green(`Group "${name}" created`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                if (err instanceof ApiError && err.status === 409) {
                    console.error(chalk.red(`\n  Group "${name}" already exists\n`))
                } else {
                    console.error(chalk.red('\n  Failed to create group\n'))
                }
            }
        }
    })

const groupList = new Command('list')
    .description('List all your groups')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching groups...').start()
        try {
            const { groups } = await ApiClient.get('/groups', token)
            spinner.stop()

            if (!groups.length) {
                console.log(chalk.dim('\n  No groups yet. Run: recall group create <name>\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Commands')],
                style: { head: [], border: ['grey'] },
                colWidths: [30, 12],
            })

            for (const g of groups) {
                table.push([g.name, g.commandCount])
            }

            console.log(table.toString())
        } catch (err) {
            spinner.stop()
            planError(err)
        }
    })

const groupShow = new Command('show')
    .argument('<name>', 'Group name')
    .description('List commands in a group')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora(`Fetching group "${name}"...`).start()
        try {
            const group = await ApiClient.get(
                `/groups/by-name/${encodeURIComponent(name)}`,
                token
            )
            const { commands } = await ApiClient.get(
                `/groups/${group.id}/commands`,
                token
            )
            spinner.stop()

            if (!commands.length) {
                console.log(chalk.dim(`\n  No commands in "${name}" yet.\n`))
                return
            }

            console.log(chalk.bold(`\n  ${name}\n`))

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
            if (!planError(err)) {
                console.error(chalk.red(`\n  Group "${name}" not found\n`))
            }
        }
    })

const groupAdd = new Command('add')
    .argument('<command-name>', 'Command name')
    .argument('<group-name>', 'Group name')
    .description('Add a command to a group')
    .action(async (commandName: string, groupName: string) => {
        const token = await requireAuth()
        const spinner = ora('Adding to group...').start()
        try {
            const cmd = await ApiClient.get(
                `/commands/by-name/${encodeURIComponent(commandName)}`,
                token
            )
            const group = await ApiClient.get(
                `/groups/by-name/${encodeURIComponent(groupName)}`,
                token
            )
            await ApiClient.patch(`/commands/${cmd.id}/group`, { groupId: group.id }, token)
            spinner.succeed(chalk.green(`Added "${commandName}" to group "${groupName}"`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to add command to group\n'))
            }
        }
    })

const groupRemove = new Command('remove')
    .argument('<command-name>', 'Command name')
    .description('Remove a command from its group')
    .action(async (commandName: string) => {
        const token = await requireAuth()
        const spinner = ora('Removing from group...').start()
        try {
            const cmd = await ApiClient.get(
                `/commands/by-name/${encodeURIComponent(commandName)}`,
                token
            )
            await ApiClient.delete(`/commands/${cmd.id}/group`, token)
            spinner.succeed(chalk.green(`Removed "${commandName}" from its group`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to remove command from group\n'))
            }
        }
    })

const groupDelete = new Command('delete')
    .argument('<name>', 'Group name')
    .description('Delete a group (commands are kept)')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora(`Looking up "${name}"...`).start()
        try {
            const group = await ApiClient.get(
                `/groups/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.stop()

            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: chalk.red(`Delete group "${name}"? Commands will be kept.`),
                default: false,
            }])

            if (!confirm) {
                console.log(chalk.dim('\n  Cancelled.\n'))
                return
            }

            const deleteSpinner = ora('Deleting...').start()
            await ApiClient.delete(`/groups/${group.id}`, token)
            deleteSpinner.succeed(chalk.green(`Deleted group "${name}"`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red(`\n  Group "${name}" not found\n`))
            }
        }
    })

const groupRename = new Command('rename')
    .argument('<old-name>', 'Current group name')
    .argument('<new-name>', 'New group name')
    .description('Rename a group')
    .action(async (oldName: string, newName: string) => {
        const token = await requireAuth()
        const spinner = ora('Renaming...').start()
        try {
            const group = await ApiClient.get(
                `/groups/by-name/${encodeURIComponent(oldName)}`,
                token
            )
            await ApiClient.patch(`/groups/${group.id}`, { name: newName }, token)
            spinner.succeed(chalk.green(`Renamed "${oldName}" to "${newName}"`))
        } catch (err) {
            spinner.stop()
            if (!planError(err)) {
                console.error(chalk.red('\n  Failed to rename group\n'))
            }
        }
    })

export const groupCommand = new Command('group')
    .description('Manage command groups (Pro plan)')
    .addCommand(groupCreate)
    .addCommand(groupList)
    .addCommand(groupShow)
    .addCommand(groupAdd)
    .addCommand(groupRemove)
    .addCommand(groupDelete)
    .addCommand(groupRename)