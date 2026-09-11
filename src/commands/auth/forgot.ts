import chalk from 'chalk'
import { Command } from 'commander'
import ora from 'ora'
import { ApiClient } from '../../lib/api'
import { getConfig } from '../../lib/config'

export const forgotCommand = new Command('forgot')
    .description('Request a password reset token')
    .argument('<email>', 'Your account email')
    .action(async (email: string) => {
        const spinner = ora('Sending reset request...').start()

        try {
            await ApiClient.post('/auth/forgot-password', { email })
            spinner.stop()

            console.log(chalk.green('\n  Reset request sent.\n'))
            console.log(chalk.dim('  Check your email for the reset token.'))
            console.log(chalk.dim('  Then run: recall auth reset <token>\n'))

            // Dev hint — API logs token to console
            const { apiUrl } = getConfig()
            if (apiUrl.includes('127.0.0.1') || apiUrl.includes('localhost')) {
                console.log(chalk.dim('  (Dev mode: check the API terminal for the token)\n'))
            }
        } catch (err: any) {
            spinner.fail(chalk.red('Request failed'))
            console.error(chalk.dim(`  ${err.message}\n`))
        }
    })