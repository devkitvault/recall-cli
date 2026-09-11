import chalk from 'chalk'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../../lib/api'
import { setToken } from '../../lib/auth'
import { saveConfig } from '../../lib/config'

async function loginWithCredentials(): Promise<void> {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'username',
            message: 'Username:',
            validate: (v) => v.length > 0 || 'Required',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: (v) => v.length > 0 || 'Required',
        },
    ])

    const spinner = ora('Authenticating...').start()

    try {
        const { token, username } = await ApiClient.post('/auth/login', {
            username: answers.username,
            password: answers.password,
        })

        await setToken(token)
        saveConfig({ username })
        spinner.succeed(chalk.green('Authenticated successfully!'))
        console.log(chalk.dim(`\n  Logged in as ${chalk.white(username)}\n`))
        const { track } = await import('../../lib/events')
        await track('cli_login', { method: 'credentials' })
    } catch (err: any) {
        spinner.fail(chalk.red('Authentication failed'))
        console.error(chalk.dim(`  ${err.message}\n`))
        process.exit(1)
    }
}

async function loginWithBrowser(): Promise<void> {
    const http = require('http')
    const crypto = require('crypto')
    const open = (await import('open')).default

    const state = crypto.randomBytes(16).toString('hex')
    const spinner = ora('Opening browser...').start()

    const closeHeaders = { Connection: 'close' as const }

    const { token, username } = await new Promise<{ token: string; username: string }>((resolve, reject) => {
        let settled = false
        const timeoutMs = 5 * 60 * 1000

        const server = http.createServer((req: any, res: any) => {
            const url = new URL(req.url, 'http://localhost:9876')
            if (url.pathname !== '/callback') {
                res.writeHead(404, closeHeaders)
                res.end()
                return
            }

            const returnedState = url.searchParams.get('state')
            const returnedToken = url.searchParams.get('token')
            const returnedUser = url.searchParams.get('username') ?? ''

            if (returnedState !== state || !returnedToken) {
                if (!settled) {
                    settled = true
                    clearTimeout(timeoutId)
                }
                res.writeHead(400, closeHeaders)
                res.end('Invalid callback.')
                const srv = server as import('http').Server & { closeAllConnections?: () => void }
                srv.closeAllConnections?.()
                server.close(() => reject(new Error('Invalid state')))
                return
            }

            if (!settled) {
                settled = true
                clearTimeout(timeoutId)
            }

            // Loopback callback: tell the browser to close the socket so server.close() can finish promptly.
            res.writeHead(200, { 'Content-Type': 'text/html', ...closeHeaders })
            res.end(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;background:#080b0f;color:#e2e8f0;">
    <h2 style="color:#4ade80;margin-bottom:12px;">✓ Authenticated!</h2>
    <p style="color:#6b7e94;font-family:monospace;">You can close this tab and return to your terminal.</p>
  </body>
</html>`)

            const srv = server as import('http').Server & { closeAllConnections?: () => void }
            srv.closeAllConnections?.()
            server.close(() => resolve({ token: returnedToken, username: returnedUser }))
        })

        const timeoutId = setTimeout(() => {
            if (settled) return
            settled = true
            const to = server as import('http').Server & { closeAllConnections?: () => void }
            to.closeAllConnections?.()
            server.close(() => reject(new Error('Timed out after 5 minutes')))
        }, timeoutMs)

        server.listen(9876, () => {
            const authUrl = `https://recall.devkitvault.com/cli-login?state=${state}&redirect=http://localhost:9876/callback`
            open(authUrl)
            spinner.text = 'Waiting for browser authentication...'
        })
    })

    await setToken(token)
    saveConfig({ username })
    spinner.succeed(chalk.green('Authenticated successfully!'))
    console.log(chalk.dim(`\n  Logged in as ${chalk.white(username)}\n`))
    const { track } = await import('../../lib/events')
    await track('cli_login', { method: 'browser' })
}

export const loginCommand = new Command('login')
    .description('Log in to recall')
    .action(async () => {
        console.log(chalk.bold('\n  recall auth\n'))

        const { method } = await inquirer.prompt([
            {
                type: 'list',
                name: 'method',
                message: 'How would you like to log in?',
                choices: [
                    { name: 'Login with credentials  (username + password)', value: 'credentials' },
                    { name: 'Login with browser       (opens recall.devkitvault.com, then localhost)', value: 'browser' },
                ],
            },
        ])

        if (method === 'credentials') {
            await loginWithCredentials()
        } else {
            await loginWithBrowser()
        }
    })