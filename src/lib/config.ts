import fs from 'fs'
import os from 'os'
import path from 'path'

const CONFIG_DIR = path.join(os.homedir(), '.recall')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
export const APP_VERSION = "2.6.0"

export const ENVIRONMENTS: Record<string, string> = {
    production: 'https://api.devkitvault.com',
    local: 'http://127.0.0.1:3001',
}

export interface Config {
    apiUrl: string
    env: string
    username?: string
}

const DEFAULTS: Config = {
    apiUrl: ENVIRONMENTS.production,
    env: 'production',
}

export function getConfig(): Config {
    if (!fs.existsSync(CONFIG_FILE)) return DEFAULTS
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) }
    } catch {
        return DEFAULTS
    }
}

export function saveConfig(data: Partial<Config>): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    const current = getConfig()
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...data }, null, 2))
}