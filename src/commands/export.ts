import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs'
import ora from 'ora'
import path from 'path'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

export const exportCommand = new Command('export')
    .description('Export your saved commands')
    .option('-f, --format <format>', 'Export format: json or sh', 'json')
    .option('-o, --output <file>', 'Output file path')
    .action(async (opts) => {
        const token = await requireAuth()
        const spinner = ora('Fetching commands...').start()

        try {
            const { commands } = await ApiClient.get('/commands', token)
            spinner.stop()

            if (!commands.length) {
                console.log(chalk.dim('\n  No commands to export.\n'))
                return
            }

            const format = opts.format.toLowerCase()

            if (format !== 'json' && format !== 'sh') {
                console.error(chalk.red('\n  Invalid format. Use: json or sh\n'))
                process.exit(1)
            }

            let output = ''

            if (format === 'json') {
                output = JSON.stringify(commands, null, 2)
            } else {
                // Shell script format
                const lines = [
                    '#!/bin/sh',
                    '# recall export — generated ' + new Date().toISOString(),
                    '# Run any of these commands by copy-pasting or sourcing this file',
                    '',
                ]

                for (const cmd of commands) {
                    if (cmd.name) lines.push(`# ${cmd.name}`)
                    if (cmd.tags?.length) lines.push(`# tags: ${cmd.tags.join(', ')}`)
                    lines.push(cmd.command)
                    lines.push('')
                }

                output = lines.join('\n')
            }

            // Write to file or stdout
            if (opts.output) {
                const filePath = path.resolve(opts.output)
                fs.writeFileSync(filePath, output, 'utf-8')
                console.log(chalk.green(`\n  Exported ${commands.length} commands to ${filePath}\n`))
            } else {
                console.log(output)
            }

        } catch {
            spinner.fail(chalk.red('Export failed'))
        }
    })