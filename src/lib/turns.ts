export interface SessionTurn {
    query: string
    command: string
}

const MAX_TURNS = 4
const MAX_FIELD = 200

export function trimTurns(turns: SessionTurn[]): SessionTurn[] {
    const out: SessionTurn[] = []
    for (const turn of turns) {
        const query = turn.query.trim().slice(0, MAX_FIELD)
        const command = turn.command.trim().slice(0, MAX_FIELD)
        if (!query || !command) continue
        out.push({ query, command })
    }
    return out.slice(-MAX_TURNS)
}

export function isExitCommand(line: string): boolean {
    const t = line.trim().toLowerCase()
    return t === 'exit' || t === 'quit' || t === '/exit' || t === '/quit'
}
