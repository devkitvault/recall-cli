import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'
import { findLocalByName, listLocalCommands, saveLocalCommand, VAULT_FILE } from '../lib/local-vault'
import { parseTags } from '../lib/tags'
import { LastCommandError, readHistoryCommands } from '../lib/shell-history'

interface CommandEntry {
    command: string
    name?: string
    tags?: string[]
}

function parseJSON(content: string): CommandEntry[] {
    const data = JSON.parse(content)
    if (!Array.isArray(data)) throw new Error('JSON must be an array of commands')
    return data.map((item: Record<string, unknown>) => ({
        command: String(item.command ?? ''),
        name: typeof item.name === 'string' ? item.name : undefined,
        tags: Array.isArray(item.tags)
            ? item.tags.filter((t): t is string => typeof t === 'string')
            : undefined,
    })).filter((e) => e.command.trim())
}

function parseSh(content: string): CommandEntry[] {
    const lines = content.split('\n')
    const entries: CommandEntry[] = []

    let currentName: string | undefined
    let currentTags: string[] = []

    for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith('#!')) continue

        if (line.startsWith('# tags:')) {
            currentTags = line
                .replace('# tags:', '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            continue
        }

        if (line.startsWith('#')) {
            currentName = line.replace('#', '').trim()
            continue
        }

        entries.push({
            command: line,
            name: currentName,
            tags: currentTags.length ? currentTags : undefined,
        })
        currentName = undefined
        currentTags = []
    }

    return entries
}

function commandAlreadyLocal(command: string, name?: string): boolean {
    if (name && findLocalByName(name)) return true
    return listLocalCommands().some((c) => c.command === command)
}

function suggestName(command: string, used: Set<string>): string {
    const base = command
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 32) || 'cmd'
    let name = base
    let n = 2
    while (used.has(name) || findLocalByName(name)) {
        name = `${base.slice(0, 28)}-${n}`
        n++
    }
    used.add(name)
    return name
}

async function importEntries(
    entries: CommandEntry[],
    opts: { skipDuplicates?: boolean; nameThem?: boolean },
): Promise<{ imported: number; skipped: number }> {
    let imported = 0
    let skipped = 0
    const usedNames = new Set<string>()

    for (const entry of entries) {
        if (opts.skipDuplicates && commandAlreadyLocal(entry.command, entry.name)) {
            skipped++
            continue
        }
        const name = entry.name
            ?? (opts.nameThem ? suggestName(entry.command, usedNames) : undefined)
        if (name) usedNames.add(name)
        saveLocalCommand({
            command: entry.command,
            name,
            tags: entry.tags,
        })
        imported++
    }

    return { imported, skipped }
}

async function importFromFile(file: string, opts: { skipDuplicates?: boolean }) {
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
            try {
                entries = parseJSON(content)
            } catch {
                entries = parseSh(content)
            }
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(chalk.red(`\n  Failed to parse file: ${message}\n`))
        process.exit(1)
    }

    if (!entries.length) {
        console.log(chalk.dim('\n  No commands found in file.\n'))
        return
    }

    console.log(chalk.dim(`\n  Found ${entries.length} command${entries.length === 1 ? '' : 's'} in file\n`))
    const { imported, skipped } = await importEntries(entries, {
        skipDuplicates: opts.skipDuplicates,
        nameThem: false,
    })
    console.log(`  ${chalk.green(`${imported} imported`)}  ${chalk.yellow(`${skipped} skipped`)}`)
    console.log(chalk.dim(`  Vault: ${VAULT_FILE}\n`))
}

export const importCommand = new Command('import')
    .description('Import commands into your local vault')
    .argument('[file]', 'JSON or shell script to import (or use: recall import history)')
    .option('-s, --skip-duplicates', 'Skip commands that already exist locally', true)
    .addHelpText(
        'after',
        `
Examples:
  $ recall import history
  $ recall import history -n 20 -y
  $ recall import ./backup.json
`,
    )
    .action(async (file: string | undefined, opts) => {
        if (!file) {
            console.log(chalk.dim('\n  Usage:'))
            console.log(chalk.dim('    recall import history     # from shell history (curated)'))
            console.log(chalk.dim('    recall import <file>      # from JSON or .sh\n'))
            process.exit(1)
        }
        await importFromFile(file, opts)
    })

importCommand
    .command('history')
    .description('Import curated commands from shell history into the local vault (not live capture)')
    .option('-n, --limit <count>', 'Max unique recent commands to consider', '40')
    .option('-y, --yes', 'Import all candidates without prompting')
    .option('-i, --interactive', 'Choose which commands to import (default unless --yes)')
    .option('--dry-run', 'Show candidates only; do not write')
    .option('-t, --tags <tags>', 'Tags applied to imported commands')
    .option('--min-length <n>', 'Skip commands shorter than this', '3')
    .option('--no-names', 'Do not auto-generate names')
    .option('--no-skip-duplicates', 'Import even if the same command text already exists')
    .action(async (opts) => {
        const limit = Math.max(1, parseInt(String(opts.limit), 10) || 40)
        const minLength = Math.max(1, parseInt(String(opts.minLength), 10) || 3)
        const tags = parseTags(opts.tags)

        let commands: string[]
        let source: string
        let shell: string
        try {
            const result = readHistoryCommands({ limit, minLength })
            commands = result.commands
            source = result.source
            shell = result.shell
        } catch (err) {
            if (err instanceof LastCommandError) {
                console.log(chalk.red(`\n  ${err.message}\n`))
                process.exit(1)
            }
            throw err
        }

        console.log()
        console.log(chalk.dim(`  Shell: ${shell} · ${source}`))
        console.log(chalk.dim(`  ${commands.length} unique candidate${commands.length === 1 ? '' : 's'} (newest first)\n`))

        let selected = commands

        const interactive = !opts.yes && (opts.interactive || !opts.dryRun)
        if (opts.yes) {
            selected = commands
        } else if (interactive && !opts.dryRun) {
            const { picked } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'picked',
                    message: 'Select commands to save locally',
                    pageSize: 16,
                    choices: commands.map((c) => ({
                        name: c.length > 80 ? `${c.slice(0, 77)}…` : c,
                        value: c,
                        checked: false,
                    })),
                },
            ])
            selected = picked as string[]
            if (!selected.length) {
                console.log(chalk.dim('\n  Nothing selected.\n'))
                return
            }
        }

        if (opts.dryRun) {
            for (const [i, c] of selected.entries()) {
                console.log(`  ${chalk.dim(String(i + 1).padStart(2))}. ${c}`)
            }
            console.log(chalk.dim(`\n  Dry run — nothing written. Drop --dry-run to import.\n`))
            return
        }

        const entries: CommandEntry[] = selected.map((command) => ({ command, tags }))
        const { imported, skipped } = await importEntries(entries, {
            skipDuplicates: opts.skipDuplicates !== false,
            nameThem: opts.names !== false,
        })

        console.log()
        console.log(`  ${chalk.green(`${imported} imported`)}  ${chalk.yellow(`${skipped} skipped`)}`)
        console.log(chalk.dim(`  Vault: ${VAULT_FILE}`))
        console.log(chalk.dim('  Sync to cloud (Pro): recall sync\n'))
    })
