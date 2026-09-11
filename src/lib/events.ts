import fs from 'fs'
import os from 'os'
import path from 'path'
import { ApiClient } from './api'
import { getToken } from './auth'
import { APP_VERSION } from './config'

const FLAG_FILE = path.join(os.homedir(), '.recall', 'installed')

function markInstalled(): boolean {
    try {
        if (fs.existsSync(FLAG_FILE)) return false
        fs.mkdirSync(path.dirname(FLAG_FILE), { recursive: true })
        fs.writeFileSync(FLAG_FILE, new Date().toISOString(), { mode: 0o600 })
        return true
    } catch {
        return false
    }
}

export async function track(name: string, properties?: Record<string, unknown>): Promise<void> {
    try {
        const token = await getToken()
        await ApiClient.post('/events', { name, properties: properties ?? {} }, token ?? undefined)
    } catch {
        // never block the CLI on analytics
    }
}

export async function trackInstalledOnce(): Promise<void> {
    if (!markInstalled()) return
    await track('cli_installed', { version: APP_VERSION })
}
