import fs from 'fs'
import os from 'os'
import path from 'path'

export type ShellKind = 'zsh' | 'bash' | 'powershell' | 'cmd' | 'unknown'

/** True if this history line is a recall/rec save invocation (skip so we don't save ourselves). */
export function isSelfSaveCommand(line: string): boolean {
    const t = line.trim()
    return /^(recall|rec)\s+save(\s|$)/.test(t)
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
