import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const VAULT_DIR = path.join(
    process.env.RECALL_HOME?.trim() || os.homedir(),
    '.recall',
)
export const VAULT_FILE = path.join(VAULT_DIR, 'commands.json')

export interface LocalCommand {
    id: string
    command: string
    name?: string
    tags?: string[]
    pinned?: boolean
    createdAt: string
    updatedAt: string
    /** Cloud UUID when this row has been synced to the API vault */
    cloudId?: string
}

interface VaultFile {
    version: 1
    updatedAt: string
    syncedAt?: string | null
    commands: LocalCommand[]
}

function nowIso(): string {
    return new Date().toISOString()
}

function ensureDir(): void {
    fs.mkdirSync(VAULT_DIR, { recursive: true })
}

function normalizeCommand(
    raw: Record<string, unknown>,
    legacySyncCache: boolean,
): LocalCommand {
    const command = String(raw.command ?? '')
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined
    const tags = Array.isArray(raw.tags)
        ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : undefined
    const pinned = Boolean(raw.pinned)
    const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : nowIso()
    const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt

    let cloudId: string | undefined
    if (typeof raw.cloudId === 'string' && raw.cloudId) {
        cloudId = raw.cloudId
    } else if (legacySyncCache && typeof raw.id === 'string' && raw.id) {
        // Old cache used API ids as `id`
        cloudId = raw.id
    }

    const id =
        !legacySyncCache && typeof raw.id === 'string' && raw.id
            ? raw.id
            : randomUUID()

    return {
        id,
        command,
        name,
        tags: tags?.length ? tags : undefined,
        pinned: pinned || undefined,
        createdAt,
        updatedAt,
        cloudId,
    }
}

function emptyVault(): VaultFile {
    return {
        version: 1,
        updatedAt: nowIso(),
        syncedAt: null,
        commands: [],
    }
}

export function readVault(): VaultFile {
    try {
        if (!fs.existsSync(VAULT_FILE)) return emptyVault()
        const parsed = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8')) as Record<string, unknown>
        const rawCommands = Array.isArray(parsed.commands) ? parsed.commands : []
        const legacySyncCache = parsed.version !== 1
        const commands = rawCommands
            .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
            .map((c) => normalizeCommand(c, legacySyncCache))
            .filter((c) => c.command.trim().length > 0)

        return {
            version: 1,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
            syncedAt: typeof parsed.syncedAt === 'string' ? parsed.syncedAt : null,
            commands,
        }
    } catch {
        return emptyVault()
    }
}

export function writeVault(vault: VaultFile): void {
    ensureDir()
    const payload: VaultFile = {
        version: 1,
        updatedAt: nowIso(),
        syncedAt: vault.syncedAt ?? null,
        commands: vault.commands,
    }
    fs.writeFileSync(VAULT_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 })
}

export function listLocalCommands(filters?: {
    tag?: string
    search?: string
    pinned?: boolean
}): LocalCommand[] {
    let rows = readVault().commands

    if (filters?.tag) {
        const tag = filters.tag.toLowerCase()
        rows = rows.filter((c) => (c.tags ?? []).some((t) => t.toLowerCase() === tag))
    }
    if (filters?.search) {
        const q = filters.search.toLowerCase()
        rows = rows.filter(
            (c) =>
                c.command.toLowerCase().includes(q) ||
                (c.name?.toLowerCase().includes(q) ?? false) ||
                (c.tags ?? []).some((t) => t.toLowerCase().includes(q)),
        )
    }
    if (filters?.pinned) {
        rows = rows.filter((c) => c.pinned)
    }

    return rows.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.updatedAt.localeCompare(a.updatedAt)
    })
}

export function findLocalByName(name: string): LocalCommand | undefined {
    const needle = name.toLowerCase()
    return readVault().commands.find((c) => c.name?.toLowerCase() === needle)
}

export function saveLocalCommand(input: {
    command: string
    name?: string
    tags?: string[]
}): LocalCommand {
    const vault = readVault()
    const stamp = nowIso()
    const name = input.name?.trim() || undefined

    if (name) {
        const existing = vault.commands.find((c) => c.name?.toLowerCase() === name.toLowerCase())
        if (existing) {
            existing.command = input.command
            existing.tags = input.tags?.length ? input.tags : undefined
            existing.updatedAt = stamp
            // Local edit invalidates cloud link until next push maps again
            writeVault(vault)
            return existing
        }
    }

    const saved: LocalCommand = {
        id: randomUUID(),
        command: input.command,
        name,
        tags: input.tags?.length ? input.tags : undefined,
        createdAt: stamp,
        updatedAt: stamp,
    }
    vault.commands.push(saved)
    writeVault(vault)
    return saved
}

export function deleteLocalByName(name: string): LocalCommand | undefined {
    const vault = readVault()
    const idx = vault.commands.findIndex((c) => c.name?.toLowerCase() === name.toLowerCase())
    if (idx < 0) return undefined
    const [removed] = vault.commands.splice(idx, 1)
    writeVault(vault)
    return removed
}

export function setLocalPinned(name: string, pinned: boolean): LocalCommand | undefined {
    const vault = readVault()
    const cmd = vault.commands.find((c) => c.name?.toLowerCase() === name.toLowerCase())
    if (!cmd) return undefined
    cmd.pinned = pinned || undefined
    cmd.updatedAt = nowIso()
    writeVault(vault)
    return cmd
}

export function markVaultSynced(at = nowIso()): void {
    const vault = readVault()
    vault.syncedAt = at
    writeVault(vault)
}

export function replaceLocalFromCloud(
    cloudCommands: Array<{
        id: string
        command: string
        name?: string | null
        tags?: string[] | null
        pinned?: boolean | null
        createdAt?: string
        updatedAt?: string
    }>,
): LocalCommand[] {
    const stamp = nowIso()
    const mapped: LocalCommand[] = cloudCommands.map((c) => ({
        id: randomUUID(),
        cloudId: c.id,
        command: c.command,
        name: c.name ?? undefined,
        tags: c.tags?.length ? c.tags : undefined,
        pinned: c.pinned || undefined,
        createdAt: c.createdAt ?? stamp,
        updatedAt: c.updatedAt ?? stamp,
    }))

    writeVault({
        version: 1,
        updatedAt: stamp,
        syncedAt: stamp,
        commands: mapped,
    })
    return mapped
}

/** Merge cloud into local by name (cloud wins on conflict); keep local-only rows. */
export function mergeCloudIntoLocal(
    cloudCommands: Array<{
        id: string
        command: string
        name?: string | null
        tags?: string[] | null
        pinned?: boolean | null
        createdAt?: string
        updatedAt?: string
    }>,
): { local: LocalCommand[]; added: number; updated: number } {
    const vault = readVault()
    const stamp = nowIso()
    let added = 0
    let updated = 0

    for (const cloud of cloudCommands) {
        const name = cloud.name?.trim()
        const byCloudId = vault.commands.find((c) => c.cloudId === cloud.id)
        const byName = name
            ? vault.commands.find((c) => c.name?.toLowerCase() === name.toLowerCase())
            : undefined
        const target = byCloudId ?? byName

        if (target) {
            target.cloudId = cloud.id
            target.command = cloud.command
            target.name = name || target.name
            target.tags = cloud.tags?.length ? cloud.tags : undefined
            target.pinned = cloud.pinned || undefined
            target.updatedAt = stamp
            updated++
        } else {
            vault.commands.push({
                id: randomUUID(),
                cloudId: cloud.id,
                command: cloud.command,
                name: name || undefined,
                tags: cloud.tags?.length ? cloud.tags : undefined,
                pinned: cloud.pinned || undefined,
                createdAt: cloud.createdAt ?? stamp,
                updatedAt: stamp,
            })
            added++
        }
    }

    vault.syncedAt = stamp
    writeVault(vault)
    return { local: vault.commands, added, updated }
}

export function localCommandsNeedingPush(): LocalCommand[] {
    return readVault().commands.filter((c) => !c.cloudId)
}

export function attachCloudId(localId: string, cloudId: string): void {
    const vault = readVault()
    const cmd = vault.commands.find((c) => c.id === localId)
    if (!cmd) return
    cmd.cloudId = cloudId
    cmd.updatedAt = nowIso()
    writeVault(vault)
}
