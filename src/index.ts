#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { aliasCommand } from './commands/alias'
import { approveCommand } from './commands/approve'
import { askCommand } from './commands/ask'
import { auditCommand } from './commands/audit'
import { authCommand } from './commands/auth/index'
import { completionCommand } from './commands/completion'
import { configCommand } from './commands/config'
import { deleteCommand } from './commands/delete'
import { doctorCommand } from './commands/doctor'
import { envCommand } from './commands/env'
import { exportCommand } from './commands/export'
import { feedbackCommand } from './commands/feedback'
import { groupCommand } from './commands/group'
import { historyCommand } from './commands/history'
import { importCommand } from './commands/import'
import { listCommand } from './commands/list'
import { orgCommand } from './commands/org'
import { pinCommand } from './commands/pin'
import { playbookCommand } from './commands/playbook'
import { runRepl } from './commands/repl'
import { runCommand } from './commands/run'
import { saveCommand } from './commands/save'
import { searchCommand } from './commands/search'
import { shareCommand } from './commands/share'
import { snippetCommand } from './commands/snippet'
import { supportCommand } from './commands/support'
import { syncCommand } from './commands/sync'
import { templateCommand } from './commands/template'
import { updateCommand } from './commands/update'
import { upgradeCommand } from './commands/upgrade'
import { whoamiCommand } from './commands/whoami'

import { APP_VERSION } from './lib/config'
import { trackInstalledOnce } from './lib/events'

const KNOWN = new Set([
    'auth', 'save', 'list', 'run', 'delete', 'search', 'update',
    'export', 'import', 'whoami', 'upgrade', 'sync', 'group', 'org',
    'config', 'pin', 'alias', 'history', 'share', 'snippet', 'env',
    'audit', 'approve', 'template', 'doctor', 'completion', 'feedback',
    'support', 'ask', 'playbook', 'help',
])

const rawArgs = process.argv.slice(2)
if (
    rawArgs.length > 0
    && !rawArgs[0].startsWith('-')
    && !KNOWN.has(rawArgs[0])
) {
    process.argv = [process.argv[0], process.argv[1], 'ask', ...rawArgs]
}

const program = new Command()

program
    .name('recall')
    .description(chalk.cyan('Your terminal remembers how you work'))
    .version(APP_VERSION)

program.addCommand(askCommand)
program.addCommand(authCommand)
program.addCommand(saveCommand)
program.addCommand(listCommand)
program.addCommand(runCommand)
program.addCommand(deleteCommand)
program.addCommand(searchCommand)
program.addCommand(updateCommand)
program.addCommand(exportCommand)
program.addCommand(importCommand)
program.addCommand(whoamiCommand)
program.addCommand(upgradeCommand)
program.addCommand(syncCommand)
program.addCommand(groupCommand)
program.addCommand(orgCommand)
program.addCommand(configCommand)
program.addCommand(pinCommand)
program.addCommand(aliasCommand)
program.addCommand(historyCommand)
program.addCommand(shareCommand)
program.addCommand(snippetCommand)
program.addCommand(envCommand)
program.addCommand(auditCommand)
program.addCommand(approveCommand)
program.addCommand(templateCommand)
program.addCommand(playbookCommand)
program.addCommand(doctorCommand)
program.addCommand(completionCommand)

program.addCommand(feedbackCommand)
program.addCommand(supportCommand)

async function main(): Promise<void> {
    void trackInstalledOnce()
    const raw = process.argv.slice(2)
    if (raw.length === 0) {
        await runRepl()
        return
    }
    await program.parseAsync()
}

main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(chalk.red(`\n  ${message}\n`))
    process.exit(1)
})
