import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../../lib/api'

export const resetCommand = new Command('reset')
    .description('Reset your password using a reset token')
    .argument('<token>', 'Reset token from email')
    .action(async (token: string) => {
        console.log(chalk.bold('\n  Reset your password\n'))

        const { newPassword, confirm } = await inquirer.prompt([
            {
                type: 'password',
                name: 'newPassword',
                message: 'New password:',
                mask: '*',
                validate: (v: string) => v.length >= 8 || 'Password must be at least 8 characters',
            },
            {
                type: 'password',
                name: 'confirm',
                message: 'Confirm new password:',
                mask: '*',
                validate: (v: string, answers: any) =>
                    v === answers.newPassword || 'Passwords do not match',
            },
        ])

        const spinner = ora('Resetting password...').start()

        try {
            await ApiClient.post('/auth/reset-password', { token, newPassword })
            spinner.succeed(chalk.green('Password reset successfully!'))
            console.log(chalk.dim('\n  Run: recall auth login\n'))
        } catch (err: any) {
            spinner.fail(chalk.red('Reset failed'))
            console.error(chalk.dim(`  ${err.message}\n`))
        }
    })