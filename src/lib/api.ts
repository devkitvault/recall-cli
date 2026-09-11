import chalk from 'chalk'
import { getConfig } from './config'

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public body: any,
    ) {
        super(message)
    }
}

async function request(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
): Promise<any> {
    const { apiUrl } = getConfig()

    if (!apiUrl.startsWith('https') && !apiUrl.includes('127.0.0.1') && !apiUrl.includes('localhost')) {
        console.warn(chalk.yellow('  Warning: connecting over HTTP. Use HTTPS in production.'))
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${apiUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
        if (res.status === 401) {
            const message = data.message === 'Invalid credentials'
                ? 'Invalid credentials'
                : 'Session expired. Run: recall auth login'
            throw new ApiError(message, 401, data)
        }
        throw new ApiError(data.message ?? 'Request failed', res.status, data)
    }

    return data
}

export const ApiClient = {
    get: (path: string, token?: string) => request('GET', path, undefined, token),
    post: (path: string, body: unknown, token?: string) => request('POST', path, body, token),
    patch: (path: string, body: unknown, token?: string) => request('PATCH', path, body, token),
    delete: (path: string, token?: string) => request('DELETE', path, undefined, token),
}