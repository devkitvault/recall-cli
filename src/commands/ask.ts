import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import { ApiClient, ApiError } from '../lib/api'
import { requireAuth } from '../lib/auth'
import { track } from '../lib/events'
import { detectProject } from '../lib/project'
import { detectRuntime } from '../lib/runtime'
import { sourceLabel } from '../lib/source-label'
import { delayedSpinner } from '../lib/spinner'
import { formatSavedMessage, parseTags } from '../lib/tags'
import type { SessionTurn } from '../lib/turns'

export interface ResolveResponse {
    command: string
    explanation: string
    shell: string
    risk: 'SAFE' | 'CAUTION' | 'DANGEROUS'
    alternatives: string[]
    source: 'cache' | 'vault' | 'llm' | 'project'
    remaining: number | null
}

function riskColor(risk: ResolveResponse['risk']): string {
    if (risk === 'DANGEROUS') return chalk.red(risk)
    if (risk === 'CAUTION') return chalk.yellow(risk)
    return chalk.green(risk)
}

export function printSuggestion(result: ResolveResponse): void {
    console.log()
    for (const line of result.command.split('\n')) {
        console.log(`  ${chalk.white(line)}`)
    }
    if (result.explanation) {
        console.log(`  ${chalk.dim(result.explanation)}`)
    }
    console.log()
    console.log(`  ${chalk.dim('shell:')} ${result.shell}    ${chalk.dim('risk:')} ${riskColor(result.risk)}    ${chalk.dim('source:')} ${sourceLabel(result.source)}`)
    if (result.source === 'vault') {
        const playbook = result.explanation?.includes('playbooks')
        console.log(chalk.dim(playbook ? '  from your playbooks' : '  from your vault'))
    }
    if (result.source === 'project') {
        console.log(chalk.dim('  from this repo'))
    }
    if (result.remaining !== null) {
        console.log(`  ${chalk.dim(`ai left this month: ${result.remaining}`)}`)
    }
    if (result.alternatives?.length) {
        console.log()
        for (const alt of result.alternatives) {
            console.log(`  ${chalk.dim('alt')} ${alt}`)
        }
    }
    console.log()
    console.log(chalk.dim('  Ask mode does not run commands. Copy or save this yourself.'))
    console.log()
}

export function printAskError(err: unknown): void {
    if (err instanceof ApiError && err.status === 403 && err.body?.upgrade) {
        console.log(chalk.yellow(`\n  ${err.message}`))
        console.log(chalk.dim(`  Upgrade at ${chalk.white(err.body.upgrade)}\n`))
        return
    }
    if (err instanceof ApiError) {
        console.error(chalk.red(`\n  ${err.message}\n`))
        return
    }
    console.error(chalk.red('\n  Failed to resolve that request.\n'))
}

export async function promptSaveMeta(existingName?: string): Promise<{
    name: string | undefined
    tags: string[] | undefined
}> {
    const questions: Array<{ type: 'input'; name: string; message: string }> = []
    if (!existingName?.trim()) {
        questions.push({
            type: 'input',
            name: 'name',
            message: 'Name (optional):',
        })
    }
    questions.push({
        type: 'input',
        name: 'tags',
        message: 'Tags (optional):',
    })
    const answers = await inquirer.prompt(questions)
    return {
        name: existingName?.trim() || (answers.name as string | undefined),
        tags: parseTags(answers.tags as string | undefined),
    }
}

export async function saveSuggestion(
    token: string,
    command: string,
    name: string | undefined,
    source: ResolveResponse['source'],
    risk: ResolveResponse['risk'],
    tags?: string[],
): Promise<void> {
    await ApiClient.post('/commands', {
        command,
        name: name?.trim() || undefined,
        tags,
    }, token)
    await track('ai_accepted', { source, risk, saved: true })
    console.log(chalk.green(`\n  ${formatSavedMessage(name, tags)}\n`))
}

export async function resolveAsk(opts: {
    query: string
    token: string
    turns?: SessionTurn[]
}): Promise<ResolveResponse | null> {
    const runtime = detectRuntime()
    const spinner = delayedSpinner('Looking up...')
    try {
        const body: Record<string, unknown> = {
            query: opts.query,
            os: runtime.os,
            shell: runtime.shell,
            projectMeta: detectProject(),
            mode: 'ask',
        }
        if (opts.turns?.length) body.turns = opts.turns
        const result = await ApiClient.post('/ai/resolve', body, opts.token) as ResolveResponse
        spinner.stop()
        printSuggestion(result)
        return result
    } catch (err) {
        spinner.stop()
        printAskError(err)
        return null
    }
}

export async function runAsk(query: string): Promise<void> {
    const token = await requireAuth()
    const result = await resolveAsk({ query, token })
    if (!result) return

    if (result.source === 'vault') {
        await track('ai_accepted', { source: result.source, risk: result.risk, saved: false })
        return
    }

    const { save } = await inquirer.prompt([{
        type: 'confirm',
        name: 'save',
        message: 'Save this command?',
        default: false,
    }])

    if (!save) return

    const { name, tags } = await promptSaveMeta()

    try {
        await saveSuggestion(token, result.command, name, result.source, result.risk, tags)
    } catch (err) {
        printAskError(err)
    }
}

export const askCommand = new Command('ask')
    .description('Suggest a terminal command. Ask is for terminal commands only and does not run them.')
    .argument('<query...>', 'What you want to do')
    .action(async (parts: string[]) => {
        await runAsk(parts.join(' '))
    })
