import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import chalk from 'chalk'

const TOKEN_FILE = path.join(os.homedir(), '.recall', 'token')

interface KeytarApi {
    getPassword(service: string, account: string): Promise<string | null>
    setPassword(service: string, account: string, password: string): Promise<void>
    deletePassword(service: string, account: string): Promise<boolean>
}

async function loadKeytar(): Promise<KeytarApi | null> {
    try {
        const loaded = await import('keytar') as KeytarApi & { default?: KeytarApi }
        const api = loaded.default ?? loaded
        if (typeof api.getPassword !== 'function' || typeof api.setPassword !== 'function') {
            return null
        }
        return api
    } catch {
        return null
    }
}

function readTokenFile(): string | null {
    try {
        if (!fs.existsSync(TOKEN_FILE)) return null
        const token = fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
        return token || null
    } catch {
        return null
    }
}

function writeTokenFile(token: string): void {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
    fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 })
}

export async function getToken(): Promise<string | null> {
    const keytar = await loadKeytar()
    if (keytar) {
        try {
            const fromKeytar = await keytar.getPassword('recall', 'token')
            if (fromKeytar) return fromKeytar
        } catch {
            // fall through to file
        }
    }
    return readTokenFile()
}

export async function setToken(token: string): Promise<void> {
    writeTokenFile(token)
    const keytar = await loadKeytar()
    if (!keytar) return
    try {
        await keytar.setPassword('recall', 'token', token)
    } catch {
        // file is already written
    }
}

export async function deleteToken(): Promise<void> {
    try {
        if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE)
    } catch {
        // ignore
    }
    const keytar = await loadKeytar()
    if (!keytar) return
    try {
        await keytar.deletePassword('recall', 'token')
    } catch {
        // ignore
    }
}

export async function requireAuth(): Promise<string> {
    const token = await getToken()
    if (!token) {
        console.error(chalk.red('\n  Not logged in. Run: recall auth login\n'))
        process.exit(1)
    }
    return token
}