import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../../lib/api'
import { setToken } from '../../lib/auth'
import { saveConfig } from '../../lib/config'

export const registerCommand = new Command('register')
    .description('Create a new recall account')
    .action(async () => {
        console.log(chalk.bold('\n  Create your recall account\n'))

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'Username:',
                validate: (v) => {
                    if (v.length < 3) return 'Username must be at least 3 characters'
                    if (v.length > 30) return 'Username must be under 30 characters'
                    if (!/^[a-zA-Z0-9_-]+$/.test(v)) return 'Only letters, numbers, - and _ allowed'
                    return true
                },
            },
            {
                type: 'input',
                name: 'email',
                message: 'Email:',
                validate: (v) => {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email'
                    return true
                },
            },
            {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*',
                validate: (v) => {
                    if (v.length < 8) return 'Password must be at least 8 characters'
                    return true
                },
            },
            {
                type: 'password',
                name: 'confirm',
                message: 'Confirm password:',
                mask: '*',
                validate: (v, answers) => {
                    if (v !== answers.password) return 'Passwords do not match'
                    return true
                },
            },
        ])

        const spinner = ora('Creating account...').start()

        try {
            const { token, username } = await ApiClient.post('/auth/register', {
                username: answers.username,
                email: answers.email,
                password: answers.password,
            })

            await setToken(token)
            saveConfig({ username })

            spinner.succeed(chalk.green('Account created successfully!'))
            console.log(chalk.dim(`\n  Logged in as ${chalk.white(username)}`))
            console.log(chalk.dim(`  Plan: ${chalk.white('free')}\n`))
        } catch (err: any) {
            spinner.fail(chalk.red('Registration failed'))
            console.error(chalk.dim(`  ${err.message}\n`))
            process.exit(1)
        }
    })