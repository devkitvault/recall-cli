import readline from 'node:readline'
import chalk from 'chalk'
import { requireAuth } from '../lib/auth'
import { track } from '../lib/events'
import { isExitCommand, trimTurns, type SessionTurn } from '../lib/turns'
import { promptSaveMeta, resolveAsk, saveSuggestion, type ResolveResponse } from './ask'

function printReplHelp(): void {
    console.log(chalk.dim('  Ask is for terminal commands only. It prints a command and does not run it.'))
    console.log(chalk.dim('  /save [name]  save the last suggestion (asks for tags)'))
    console.log(chalk.dim('  /clear        forget this session'))
    console.log(chalk.dim('  /exit         leave'))
}

export async function runRepl(): Promise<void> {
    const token = await requireAuth()
    await track('repl_started')

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Recall > ',
    })

    let turns: SessionTurn[] = []
    let last: ResolveResponse | null = null
    let turnIndex = 0
    let busy = false
    let open = true

    console.log(chalk.dim('  Ask is for terminal commands only. Prints only. /help for commands.'))
    rl.prompt()

    async function handleLine(raw: string): Promise<void> {
        const line = raw.trim()
        if (!line) return
        if (isExitCommand(line)) {
            rl.close()
            return
        }
        if (line === '/help') {
            printReplHelp()
            return
        }
        if (line === '/clear') {
            turns = []
            last = null
            console.log(chalk.dim('  session cleared'))
            return
        }
        if (line === '/save' || line.startsWith('/save ')) {
            if (!last) {
                console.log(chalk.dim('  nothing to save'))
                return
            }
            const named = line === '/save' ? undefined : line.slice(6).trim()
            try {
                const { name, tags } = await promptSaveMeta(named)
                await saveSuggestion(token, last.command, name, last.source, last.risk, tags)
            } catch {
                console.error(chalk.red('\n  Failed to save.\n'))
            }
            return
        }
        if (line.startsWith('/')) {
            console.log(chalk.dim('  unknown command. /help'))
            return
        }

        const result = await resolveAsk({
            query: line,
            token,
            turns: trimTurns(turns),
        })
        if (!result) return

        last = result
        turns = trimTurns([...turns, { query: line, command: result.command }])
        turnIndex += 1
        await track('repl_turns', { source: result.source, n: turnIndex })
        if (result.source === 'vault') {
            await track('ai_accepted', { source: result.source, risk: result.risk, saved: false })
        }
    }

    rl.on('line', (raw) => {
        if (busy) return
        busy = true
        rl.pause()
        void handleLine(raw)
            .catch(() => {
                console.error(chalk.red('\n  Failed to resolve that request.\n'))
            })
            .finally(() => {
                busy = false
                if (open) {
                    rl.resume()
                    rl.prompt()
                }
            })
    })

    rl.on('SIGINT', () => {
        rl.close()
    })

    await new Promise<void>((resolve) => {
        rl.on('close', () => {
            open = false
            console.log()
            resolve()
        })
    })
}
