import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import { ENVIRONMENTS, getConfig, saveConfig } from '../lib/config'

const configShow = new Command('show')
    .description('Show current CLI config')
    .action(() => {
        const config = getConfig()
        console.log()
        console.log(`  ${chalk.dim('Environment:')} ${chalk.cyan(config.env ?? 'custom')}`)
        console.log(`  ${chalk.dim('API URL:')}     ${chalk.white(config.apiUrl)}`)
        console.log(`  ${chalk.dim('Username:')}    ${chalk.white(config.username ?? '—')}`)
        console.log()
    })

const configSet = new Command('set')
    .description('Set a config value')
    .argument('<key>', 'Config key: apiUrl')
    .argument('<value>', 'Config value')
    .action((key: string, value: string) => {
        if (key !== 'apiUrl') {
            console.error(chalk.red(`\n  Unknown config key: ${key}\n`))
            console.log(chalk.dim('  Available keys: apiUrl\n'))
            process.exit(1)
        }
        saveConfig({ [key]: value, env: 'custom' })
        console.log(chalk.green(`\n  Set ${key} = ${value}\n`))
    })

const configSwitch = new Command('switch')
    .description('Switch between environments')
    .action(async () => {
        const config = getConfig()

        const choices = [
            ...Object.entries(ENVIRONMENTS).map(([name, url]) => ({
                name: `${name.padEnd(12)} ${chalk.dim(url)}`,
                value: name,
            })),
            { name: 'custom            (enter URL manually)', value: 'custom' },
        ]

        const { env } = await inquirer.prompt([{
            type: 'list',
            name: 'env',
            message: 'Switch to which environment?',
            choices,
            default: config.env ?? 'production',
        }])

        if (env === 'custom') {
            const { url } = await inquirer.prompt([{
                type: 'input',
                name: 'url',
                message: 'Enter API URL:',
                default: config.apiUrl,
                validate: (v) => v.startsWith('http') || 'Must start with http:// or https://',
            }])
            saveConfig({ apiUrl: url, env: 'custom' })
            console.log(chalk.green(`\n  Switched to custom: ${url}\n`))
        } else {
            saveConfig({ apiUrl: ENVIRONMENTS[env], env })
            console.log(chalk.green(`\n  Switched to ${env}: ${ENVIRONMENTS[env]}\n`))
        }
    })

const configReset = new Command('reset')
    .description('Reset config to defaults')
    .action(async () => {
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Reset all config to defaults?',
            default: false,
        }])

        if (!confirm) {
            console.log(chalk.dim('\n  Cancelled.\n'))
            return
        }

        saveConfig({ apiUrl: ENVIRONMENTS.production, env: 'production', username: undefined })
        console.log(chalk.green('\n  Config reset to production defaults.\n'))
    })

export const configCommand = new Command('config')
    .description('Manage CLI configuration')
    .addCommand(configShow.name('dump'))
    .addCommand(configSet.name('put'))
    .addCommand(configSwitch.name('env'))
    .addCommand(configReset.name('flush'))
