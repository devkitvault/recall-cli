import { Command } from 'commander'
import { forgotCommand } from './forgot'
import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { registerCommand } from './register'
import { resetCommand } from './reset'

export const authCommand = new Command('auth')
    .description('Manage authentication')
    .addCommand(registerCommand)
    .addCommand(loginCommand)
    .addCommand(logoutCommand)
    .addCommand(forgotCommand)
    .addCommand(resetCommand)