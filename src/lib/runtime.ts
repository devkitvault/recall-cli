export interface RuntimeInfo {
    os: 'windows' | 'macos' | 'linux'
    shell: string
}

export function detectRuntime(): RuntimeInfo {
    const os = process.platform === 'win32'
        ? 'windows'
        : process.platform === 'darwin'
            ? 'macos'
            : 'linux'

    if (os === 'windows') {
        const shellEnv = (process.env.SHELL ?? '').toLowerCase()
        if (shellEnv.includes('zsh')) return { os, shell: 'zsh' }
        if (shellEnv.includes('bash')) return { os, shell: 'bash' }
        if (process.env.PSModulePath) return { os, shell: 'powershell' }
        const comspec = (process.env.ComSpec ?? '').toLowerCase()
        if (comspec.includes('cmd')) return { os, shell: 'cmd' }
        return { os, shell: 'powershell' }
    }

    const s = process.env.SHELL ?? '/bin/bash'
    if (s.includes('zsh')) return { os, shell: 'zsh' }
    if (s.includes('fish')) return { os, shell: 'fish' }
    if (s.includes('pwsh') || s.includes('powershell')) return { os, shell: 'powershell' }
    return { os, shell: 'bash' }
}
