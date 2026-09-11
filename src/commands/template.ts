import chalk from 'chalk'
import { execSync } from 'child_process'
import Table from 'cli-table3'
import { Command } from 'commander'
import inquirer from 'inquirer'
import ora from 'ora'
import { ApiClient } from '../lib/api'
import { requireAuth } from '../lib/auth'

function extractVariables(template: string): string[] {
    const matches = template.match(/\{([^}]+)\}/g) ?? []
    return [...new Set(matches.map((m: string) => m.slice(1, -1)))]
}

const templateSave = new Command('save')
    .argument('<name>', 'Template name')
    .argument('<template>', 'Command template with {variable} placeholders')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .description('Save a command template with variables')
    .action(async (name: string, template: string, opts) => {
        const token = await requireAuth()
        const variables = extractVariables(template)

        if (!variables.length) {
            console.log(chalk.yellow('\n  No variables found in template.'))
            console.log(chalk.dim('  Use {variable} syntax. Example: kubectl logs {pod} -n {namespace}\n'))
            return
        }

        const spinner = ora('Saving template...').start()
        try {
            await ApiClient.post('/templates', {
                name,
                template,
                tags: opts.tags?.split(',').map((t: string) => t.trim()) ?? [],
            }, token)
            spinner.succeed(chalk.green(`Template "${name}" saved`))
            console.log(chalk.dim(`\n  Variables: ${variables.map(v => chalk.cyan(`{${v}}`)).join(', ')}\n`))
        } catch (err: any) {
            spinner.fail(chalk.red(err.message ?? 'Failed to save template'))
        }
    })

const templateList = new Command('list')
    .description('List all your templates')
    .action(async () => {
        const token = await requireAuth()
        const spinner = ora('Fetching templates...').start()
        try {
            const { templates } = await ApiClient.get('/templates', token)
            spinner.stop()

            if (!templates.length) {
                console.log(chalk.dim('\n  No templates yet.'))
                console.log(chalk.dim('  Run: recall template save <name> "<command with {vars}>"\n'))
                return
            }

            const table = new Table({
                head: [chalk.cyan('Name'), chalk.cyan('Template'), chalk.cyan('Variables')],
                style: { head: [], border: ['grey'] },
                colWidths: [20, 36, 24],
                wordWrap: true,
            })

            for (const t of templates) {
                table.push([
                    chalk.white(t.name),
                    t.template.length > 34 ? t.template.slice(0, 34) + '…' : t.template,
                    (t.variables ?? []).map((v: string) => chalk.cyan(`{${v}}`)).join(' ') || chalk.dim('none'),
                ])
            }

            console.log(table.toString())
        } catch {
            spinner.fail(chalk.red('Failed to fetch templates'))
        }
    })

const templateShow = new Command('show')
    .argument('<name>', 'Template name')
    .description('Show template details')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Fetching...').start()
        try {
            const tmpl = await ApiClient.get(
                `/templates/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.stop()

            console.log(chalk.bold(`\n  ${tmpl.name}\n`))
            console.log(`  ${chalk.dim('Template:')}  ${chalk.white(tmpl.template)}`)
            console.log(`  ${chalk.dim('Variables:')} ${(tmpl.variables ?? []).map((v: string) => chalk.cyan(`{${v}}`)).join(', ')
                }`)
            if (tmpl.tags?.length) {
                console.log(`  ${chalk.dim('Tags:')}      ${tmpl.tags.join(', ')}`)
            }
            console.log()
            console.log(chalk.dim(`  Run with: recall template run ${tmpl.name}`))
            console.log()
        } catch {
            spinner.fail(chalk.red(`Template "${name}" not found`))
        }
    })

const templateRun = new Command('run')
    .argument('<name>', 'Template name')
    .option('-d, --dry-run', 'Print without running')
    .description('Run a template — prompts for each variable')
    .action(async (name: string, opts) => {
        const token = await requireAuth()
        const spinner = ora('Fetching template...').start()

        try {
            const tmpl = await ApiClient.get(
                `/templates/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.stop()

            const variables: string[] = tmpl.variables ?? []

            if (!variables.length) {
                console.error(chalk.red('\n  Template has no variables\n'))
                return
            }

            console.log(chalk.bold(`\n  ${tmpl.name}`))
            console.log(chalk.dim(`  ${tmpl.template}\n`))

            // Prompt for each variable
            const answers: Record<string, string> = {}
            for (const variable of variables) {
                const { value } = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: `${chalk.cyan(variable)}:`,
                    validate: (v: string) => v.length > 0 || `${variable} is required`,
                }])
                answers[variable] = value
            }

            // Render the template
            const { rendered } = await ApiClient.post(
                `/templates/${tmpl.id}/render`,
                { vars: answers },
                token
            )

            console.log()
            console.log(chalk.dim('  Rendered command:'))
            console.log(`  ${chalk.white(rendered)}`)
            console.log()

            if (opts.dryRun) return

            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: 'Run this command?',
                default: true,
            }])

            if (!confirm) {
                console.log(chalk.dim('\n  Cancelled.\n'))
                return
            }

            console.log()
            execSync(rendered, { stdio: 'inherit' })

        } catch (err: any) {
            spinner.stop()
            console.error(chalk.red(`\n  ${err.message ?? 'Failed'}\n`))
        }
    })

const templateDelete = new Command('delete')
    .argument('<name>', 'Template name')
    .description('Delete a template')
    .action(async (name: string) => {
        const token = await requireAuth()
        const spinner = ora('Looking up...').start()
        try {
            const tmpl = await ApiClient.get(
                `/templates/by-name/${encodeURIComponent(name)}`,
                token
            )
            spinner.text = 'Deleting...'
            await ApiClient.delete(`/templates/${tmpl.id}`, token)
            spinner.succeed(chalk.green(`Deleted template "${name}"`))
        } catch {
            spinner.fail(chalk.red(`Template "${name}" not found`))
        }
    })

export const templateCommand = new Command('template')
    .description('Save and run command templates with variables')
    .addCommand(templateSave)
    .addCommand(templateList)
    .addCommand(templateShow)
    .addCommand(templateRun)
    .addCommand(templateDelete)