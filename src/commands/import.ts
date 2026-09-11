import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs'
import ora from 'ora'
import path from 'path'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

interface CommandEntry {
    command: string
    name?: string
    tags?: string[]
}

function parseJSON(content: string): CommandEntry[] {
    const data = JSON.parse(content)
    if (!Array.isArray(data)) throw new Error('JSON must be an array of commands')
    return data.map((item: any) => ({
        command: item.command,
        name: item.name,
        tags: item.tags ?? [],
    }))
}

function parseSh(content: string): CommandEntry[] {
    const lines = content.split('\n')
    const entries: CommandEntry[] = []

    let currentName: string | undefined
    let currentTags: string[] = []

    for (const raw of lines) {
        const line = raw.trim()

        // skip empty lines and shebang
        if (!line || line.startsWith('#!')) continue

        if (line.startsWith('# tags:')) {
            currentTags = line
                .replace('# tags:', '')
                .split(',')
                .map(t => t.trim())
                .filter(Boolean)
            continue
        }

        if (line.startsWith('#')) {
            currentName = line.replace('#', '').trim()
            continue
        }

        // it's a command
        entries.push({
            command: line,
            name: currentName,
            tags: currentTags,
        })

        // reset
        currentName = undefined
        currentTags = []
    }

    return entries
}

export const importCommand = new Command('import')
    .description('Import commands from a JSON or shell script file')
    .argument('<file>', 'Path to the file to import')
    .option('-s, --skip-duplicates', 'Skip commands that already exist by name')
    .action(async (file: string, opts) => {
        const token = await requireAuth()
        const filePath = path.resolve(file)

        if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`\n  File not found: ${filePath}\n`))
            process.exit(1)
        }

        const content = fs.readFileSync(filePath, 'utf-8')
        const ext = path.extname(filePath).toLowerCase()

        let entries: CommandEntry[] = []

        try {
            if (ext === '.json') {
                entries = parseJSON(content)
            } else if (ext === '.sh' || ext === '.bash') {
                entries = parseSh(content)
            } else {
                // try JSON first, then sh
                try {
                    entries = parseJSON(content)
                } catch {
                    entries = parseSh(content)
                }
            }
        } catch (err: any) {
            console.error(chalk.red(`\n  Failed to parse file: ${err.message}\n`))
            process.exit(1)
        }

        if (!entries.length) {
            console.log(chalk.dim('\n  No commands found in file.\n'))
            return
        }

        console.log(chalk.dim(`\n  Found ${entries.length} command${entries.length === 1 ? '' : 's'} to import\n`))

        let imported = 0
        let skipped = 0
        let failed = 0

        for (const entry of entries) {
            const spinner = ora(`Importing: ${chalk.white(entry.name ?? entry.command.slice(0, 40))}`).start()

            try {
                await ApiClient.post('/commands', {
                    command: entry.command,
                    name: entry.name,
                    tags: entry.tags,
                }, token)

                spinner.succeed(chalk.green(`Imported: ${entry.name ?? entry.command.slice(0, 40)}`))
                imported++
            } catch (err: any) {
                if (opts.skipDuplicates && err.status === 409) {
                    spinner.warn(chalk.yellow(`Skipped: ${entry.name ?? entry.command.slice(0, 40)}`))
                    skipped++
                } else {
                    spinner.fail(chalk.red(`Failed: ${entry.name ?? entry.command.slice(0, 40)}`))
                    failed++
                }
            }
        }

        console.log()
        console.log(`  ${chalk.green(`${imported} imported`)}  ${chalk.yellow(`${skipped} skipped`)}  ${chalk.red(`${failed} failed`)}`)
        console.log()
    })