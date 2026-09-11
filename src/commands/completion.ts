import chalk from 'chalk'
import { Command } from 'commander'

const ALL_COMMANDS = [
    'auth', 'save', 'list', 'run', 'delete', 'search', 'update',
    'export', 'import', 'sync', 'whoami', 'upgrade', 'config',
    'pin', 'alias', 'history', 'share', 'snippet', 'env',
    'group', 'org', 'audit', 'approve', 'template', 'doctor',
    'completion', 'ask',
]

const AUTH_CMDS = ['register', 'login', 'logout', 'forgot', 'reset']
const GROUP_CMDS = ['create', 'list', 'show', 'add', 'remove', 'delete', 'rename']
const ORG_CMDS = ['create', 'members', 'invite', 'join', 'role', 'remove', 'leave', 'delete', 'save', 'commands', 'run', 'search']
const ALIAS_CMDS = ['set', 'list', 'delete']
const SHARE_CMDS = ['create', 'list', 'delete']
const SNIPPET_CMDS = ['save', 'list', 'show', 'run', 'delete']
const ENV_CMDS = ['save', 'list', 'show', 'use', 'delete']
const TEMPLATE_CMDS = ['save', 'list', 'show', 'run', 'delete']
const APPROVE_CMDS = ['request', 'grant', 'list']
const CONFIG_CMDS = ['show', 'set', 'switch', 'reset']

function bashCompletion(): string {
    return `# recall bash completion
# Add this to ~/.bashrc or ~/.bash_profile:
# eval "$(recall completion bash)"

_recall_completion() {
  local cur prev words
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  words=("\${COMP_WORDS[@]}")

  local commands="${ALL_COMMANDS.join(' ')}"

  case "\${words[1]}" in
    auth)     COMPREPLY=($(compgen -W "${AUTH_CMDS.join(' ')}" -- "$cur")) ;;
    group)    COMPREPLY=($(compgen -W "${GROUP_CMDS.join(' ')}" -- "$cur")) ;;
    org)      COMPREPLY=($(compgen -W "${ORG_CMDS.join(' ')}" -- "$cur")) ;;
    alias)    COMPREPLY=($(compgen -W "${ALIAS_CMDS.join(' ')}" -- "$cur")) ;;
    share)    COMPREPLY=($(compgen -W "${SHARE_CMDS.join(' ')}" -- "$cur")) ;;
    snippet)  COMPREPLY=($(compgen -W "${SNIPPET_CMDS.join(' ')}" -- "$cur")) ;;
    env)      COMPREPLY=($(compgen -W "${ENV_CMDS.join(' ')}" -- "$cur")) ;;
    template) COMPREPLY=($(compgen -W "${TEMPLATE_CMDS.join(' ')}" -- "$cur")) ;;
    approve)  COMPREPLY=($(compgen -W "${APPROVE_CMDS.join(' ')}" -- "$cur")) ;;
    config)   COMPREPLY=($(compgen -W "${CONFIG_CMDS.join(' ')}" -- "$cur")) ;;
    *)        COMPREPLY=($(compgen -W "$commands" -- "$cur")) ;;
  esac

  return 0
}

complete -F _recall_completion recall`
}

function zshCompletion(): string {
    return `# recall zsh completion
# Add this to ~/.zshrc:
# eval "$(recall completion zsh)"

_recall() {
  local state

  _arguments \\
    '1: :->command' \\
    '*: :->args'

  case $state in
    command)
      local commands=(${ALL_COMMANDS.map(c => `'${c}'`).join(' ')})
      _describe 'command' commands
      ;;
    args)
      case $words[2] in
        auth)     local sub=(${AUTH_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        group)    local sub=(${GROUP_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        org)      local sub=(${ORG_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        alias)    local sub=(${ALIAS_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        share)    local sub=(${SHARE_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        snippet)  local sub=(${SNIPPET_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        env)      local sub=(${ENV_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        template) local sub=(${TEMPLATE_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        approve)  local sub=(${APPROVE_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
        config)   local sub=(${CONFIG_CMDS.map(c => `'${c}'`).join(' ')}) && _describe 'subcommand' sub ;;
      esac
      ;;
  esac
}

compdef _recall recall`
}

function psCompletion(): string {
    return `# recall PowerShell completion
# Add this to your PowerShell profile ($PROFILE):
# recall completion ps | Out-String | Invoke-Expression

Register-ArgumentCompleter -Native -CommandName recall -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commands = @(${ALL_COMMANDS.map(c => `'${c}'`).join(', ')})
  $tokens   = $commandAst.CommandElements

  $subCommands = @{
    'auth'     = @(${AUTH_CMDS.map(c => `'${c}'`).join(', ')})
    'group'    = @(${GROUP_CMDS.map(c => `'${c}'`).join(', ')})
    'org'      = @(${ORG_CMDS.map(c => `'${c}'`).join(', ')})
    'alias'    = @(${ALIAS_CMDS.map(c => `'${c}'`).join(', ')})
    'share'    = @(${SHARE_CMDS.map(c => `'${c}'`).join(', ')})
    'snippet'  = @(${SNIPPET_CMDS.map(c => `'${c}'`).join(', ')})
    'env'      = @(${ENV_CMDS.map(c => `'${c}'`).join(', ')})
    'template' = @(${TEMPLATE_CMDS.map(c => `'${c}'`).join(', ')})
    'approve'  = @(${APPROVE_CMDS.map(c => `'${c}'`).join(', ')})
    'config'   = @(${CONFIG_CMDS.map(c => `'${c}'`).join(', ')})
  }

  if ($tokens.Count -ge 2) {
    $mainCmd = $tokens[1].Value
    if ($subCommands.ContainsKey($mainCmd)) {
      $subCommands[$mainCmd] | Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
      return
    }
  }

  $commands | Where-Object { $_ -like "$wordToComplete*" } |
    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}`
}

export const completionCommand = new Command('completion')
    .description('Generate shell completion script')
    .argument('<shell>', 'Shell type: bash, zsh, or ps')
    .action((shell: string) => {
        switch (shell.toLowerCase()) {
            case 'bash':
                console.log(bashCompletion())
                console.log(chalk.dim('\n# Install: add this to ~/.bashrc'))
                console.log(chalk.dim('# eval "$(recall completion bash)"'))
                break

            case 'zsh':
                console.log(zshCompletion())
                console.log(chalk.dim('\n# Install: add this to ~/.zshrc'))
                console.log(chalk.dim('# eval "$(recall completion zsh)"'))
                break

            case 'ps':
            case 'powershell':
                console.log(psCompletion())
                console.log(chalk.dim('\n# Install: add this to your PowerShell profile'))
                console.log(chalk.dim('# recall completion ps | Out-String | Invoke-Expression'))
                break

            default:
                console.error(chalk.red(`\n  Unknown shell: ${shell}`))
                console.log(chalk.dim('  Supported: bash, zsh, ps\n'))
                process.exit(1)
        }
    })