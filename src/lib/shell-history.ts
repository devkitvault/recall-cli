import fs from 'fs'
import os from 'os'
import path from 'path'

export type ShellKind = 'zsh' | 'bash' | 'powershell' | 'cmd' | 'unknown'

/** True if this history line is a recall/rec save invocation (skip so we don't save ourselves). */
export function isSelfSaveCommand(line: string): boolean {
    const t = line.trim()
    return /^(recall|rec)\s+save(\s|$)/.test(t)
}

/** Skip trivial / meta lines when bulk-importing history. */
export function isSkippedHistoryCommand(line: string): boolean {
    const t = line.trim()
    if (!t) return true
    if (isSelfSaveCommand(t)) return true
    if (/^(recall|rec)(\s|$)/.test(t)) return true
    if (t.length < 2) return true
    const first = t.split(/\s+/)[0]?.toLowerCase() ?? ''
    const trivial = new Set([
        'cd', 'ls', 'll', 'la', 'pwd', 'clear', 'cls', 'exit', 'logout',
        'history', 'true', 'false', ':',
    ])
    if (trivial.has(first) && t.split(/\s+/).length <= 2) return true
    return false
}

/** Normalize one history file line into a bare command, or null if not usable. */
export function normalizeHistoryLine(rawLine: string): string | null {
    let raw = rawLine.replace(/\r$/, '')
    if (!raw.trim()) return null
    if (/^#\d+$/.test(raw.trim())) return null
    raw = stripZshExtendedPrefix(raw).trim()
    if (!raw) return null
    return raw
}

export interface ExtractHistoryOptions {
    /** Max unique commands (newest first). Default unlimited. */
    limit?: number
    minLength?: number
}

/**
 * Walk history lines (oldest → newest) and return unique saveable commands, newest first.
 */
export function extractSaveableCommands(
    lines: string[],
    opts: ExtractHistoryOptions = {},
): string[] {
    const minLength = opts.minLength ?? 3
    const seen = new Set<string>()
    const out: string[] = []

    for (let i = lines.length - 1; i >= 0; i--) {
        const cmd = normalizeHistoryLine(lines[i] ?? '')
        if (!cmd) continue
        if (cmd.length < minLength) continue
        if (isSkippedHistoryCommand(cmd)) continue
        if (seen.has(cmd)) continue
        seen.add(cmd)
        out.push(cmd)
        if (opts.limit !== undefined && out.length >= opts.limit) break
    }

    return out
}

export function readHistoryCommands(
    opts: ExtractHistoryOptions & {
        env?: NodeJS.ProcessEnv
        platform?: NodeJS.Platform
        home?: string
    } = {},
): { commands: string[]; source: string; shell: ShellKind } {
    const env = opts.env ?? process.env
    const platform = opts.platform ?? process.platform
    const home = opts.home ?? os.homedir()
    const shell = detectShellKind(env, platform)

    if (shell === 'cmd') {
        throw new LastCommandError(
            'import history is not supported in cmd.exe. Use PowerShell, Git Bash, or WSL.',
            'unsupported',
        )
    }
    if (shell === 'unknown') {
        throw new LastCommandError(
            'Could not detect your shell. Use zsh, bash, or PowerShell.',
            'unsupported',
        )
    }

    const files = historyFileCandidates(shell, env, home)
    for (const file of files) {
        try {
            if (!fs.existsSync(file)) continue
            const text = fs.readFileSync(file, 'utf8')
            const commands = extractSaveableCommands(text.split('\n'), {
                limit: opts.limit,
                minLength: opts.minLength,
            })
            if (commands.length) {
                return { commands, source: file, shell }
            }
        } catch {
            // try next
        }
    }

    const tip =
        shell === 'bash'
            ? ' If history looks empty, try: history -a && recall import history'
            : ''
    throw new LastCommandError(
        `No importable commands found in shell history.${tip}`,
        'not_found',
    )
}


/** Strip zsh extended-history prefix `: <unix>:<duration>;`. */
export function stripZshExtendedPrefix(line: string): string {
    const m = line.match(/^:\s*\d+:\d+;(.*)$/)
    return m ? m[1] : line
}

/**
 * Walk history lines newest-first and return the first saveable command.
 * Caller should pass lines in file order (oldest → newest); we scan from the end.
 */
export function findLastSaveableCommand(lines: string[]): string | null {
    for (let i = lines.length - 1; i >= 0; i--) {
        let raw = lines[i]?.replace(/\r$/, '') ?? ''
        if (!raw.trim()) continue

        // bash HISTTIMEFORMAT lines are comments starting with #
        if (/^#\d+$/.test(raw.trim())) continue

        raw = stripZshExtendedPrefix(raw).trim()
        if (!raw) continue
        if (isSelfSaveCommand(raw)) continue

        return raw
    }
    return null
}

export function detectShellKind(
    env: NodeJS.ProcessEnv = process.env,
    platform: NodeJS.Platform = process.platform,
): ShellKind {
    if (platform === 'win32') {
        const shell = (env.SHELL || env.ComSpec || '').toLowerCase()
        if (shell.includes('powershell') || shell.includes('pwsh')) return 'powershell'
        // Windows Terminal / VS Code often set PSModulePath when in PowerShell
        if (env.PSModulePath && !shell.includes('cmd.exe')) {
            if (env.TERM_PROGRAM || env.WT_SESSION || env.VSCODE_INJECTION) {
                // Prefer PowerShell when clearly in a modern host without bash
                if (!shell.includes('bash') && !shell.includes('zsh')) return 'powershell'
            }
        }
        if (shell.includes('bash') || shell.includes('zsh')) {
            return shell.includes('zsh') ? 'zsh' : 'bash'
        }
        if (shell.includes('cmd.exe') || shell.endsWith('\\cmd')) return 'cmd'
        // Default Windows: PowerShell is the intended path; cmd is unsupported
        if (!env.SHELL) return 'powershell'
        return 'cmd'
    }

    const shell = (env.SHELL || '').toLowerCase()
    if (shell.includes('zsh')) return 'zsh'
    if (shell.includes('bash')) return 'bash'
    if (shell.includes('pwsh') || shell.includes('powershell')) return 'powershell'
    return 'unknown'
}

export function historyFileCandidates(
    kind: ShellKind,
    env: NodeJS.ProcessEnv = process.env,
    home: string = os.homedir(),
): string[] {
    if (env.HISTFILE) return [env.HISTFILE]

    switch (kind) {
        case 'zsh':
            return [path.join(home, '.zsh_history')]
        case 'bash':
            return [path.join(home, '.bash_history')]
        case 'powershell': {
            const candidates: string[] = []
            if (env.APPDATA) {
                candidates.push(
                    path.join(
                        env.APPDATA,
                        'Microsoft',
                        'Windows',
                        'PowerShell',
                        'PSReadLine',
                        'ConsoleHost_history.txt',
                    ),
                    path.join(
                        env.APPDATA,
                        'Microsoft',
                        'PowerShell',
                        'PSReadLine',
                        'ConsoleHost_history.txt',
                    ),
                )
            }
            candidates.push(
                path.join(
                    home,
                    '.local',
                    'share',
                    'powershell',
                    'PSReadLine',
                    'ConsoleHost_history.txt',
                ),
                path.join(
                    home,
                    'AppData',
                    'Roaming',
                    'Microsoft',
                    'Windows',
                    'PowerShell',
                    'PSReadLine',
                    'ConsoleHost_history.txt',
                ),
            )
            return candidates
        }
        default:
            return []
    }
}

export function readLastCommandFromHistoryFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null
    const text = fs.readFileSync(filePath, 'utf8')
    const lines = text.split('\n')
    return findLastSaveableCommand(lines)
}

export interface LastCommandResult {
    command: string
    source: string
    shell: ShellKind
}

export class LastCommandError extends Error {
    constructor(
        message: string,
        readonly code: 'unsupported' | 'not_found' | 'empty',
    ) {
        super(message)
        this.name = 'LastCommandError'
    }
}

/**
 * Resolve the last typed shell command from on-disk history.
 * Same-session works when the shell appends history as you go (typical zsh / PSReadLine).
 * Bash may need `history -a` first if the file is stale.
 */
export function getLastShellCommand(
    env: NodeJS.ProcessEnv = process.env,
    platform: NodeJS.Platform = process.platform,
    home: string = os.homedir(),
): LastCommandResult {
    const shell = detectShellKind(env, platform)

    if (shell === 'cmd') {
        throw new LastCommandError(
            'save --last is not supported in cmd.exe. Use PowerShell, Git Bash, or WSL — or paste the command: recall save "your command"',
            'unsupported',
        )
    }

    if (shell === 'unknown') {
        throw new LastCommandError(
            'Could not detect your shell. Use zsh, bash, or PowerShell — or paste the command: recall save "your command"',
            'unsupported',
        )
    }

    const files = historyFileCandidates(shell, env, home)
    for (const file of files) {
        try {
            const command = readLastCommandFromHistoryFile(file)
            if (command) {
                return { command, source: file, shell }
            }
        } catch {
            // try next candidate
        }
    }

    const tip =
        shell === 'bash'
            ? ' If you just ran the command in this session, try: history -a && recall save --last'
            : ''

    throw new LastCommandError(
        `No previous command found in shell history.${tip}`,
        'not_found',
    )
}
