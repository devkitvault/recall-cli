import chalk from 'chalk'
import { Command } from 'commander'
import { deleteToken } from '../../lib/auth'

export const logoutCommand = new Command('logout')
    .description('Log out of recall')
    .action(async () => {
        await deleteToken()
        console.log(chalk.green('\n  Logged out successfully.\n'))
    })