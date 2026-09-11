export function parseTags(raw: string | undefined): string[] | undefined {
    const tags = (raw ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    return tags.length ? tags : undefined
}

export function formatSavedMessage(name?: string, tags?: string[]): string {
    const label = name?.trim() || undefined
    const tagPart = tags?.length ? ` [${tags.join(', ')}]` : ''
    if (label) return `Saved as "${label}"${tagPart}.`
    if (tagPart) return `Saved${tagPart}.`
    return 'Saved.'
}
