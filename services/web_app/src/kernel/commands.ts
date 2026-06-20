/**
 * Commands are the single abstraction for actions: every meaningful operation is
 * a command, and every UI affordance (button, menu item, palette entry, keyboard
 * shortcut) merely invokes a command id.
 */

/**
 * The open "when" context bag (à la VS Code `when` clauses). The kernel enumerates
 * NO keys — owners write them (the session facade sets `hasOpenCodex`, the editor
 * module sets `editor.focused`, a design sets its own states), so the core stays
 * free of feature / design assumptions while commands gate correctly everywhere.
 */
export type CommandContext = Record<string, unknown>

export interface Command {
  id: string
  title: string // human label (also shown in the palette)
  category?: string // 'Editor', 'Codex', 'Search' …
  icon?: string // icon id (a design maps id → glyph)
  defaultKeybinding?: string | string[] // registered with the keymap on add
  /** gate availability by reading context keys (e.g. 'hasOpenCodex') */
  isEnabled?: (ctx: CommandContext) => boolean
  /** hide from a lister when irrelevant; defaults to isEnabled */
  isVisible?: (ctx: CommandContext) => boolean
  run(args?: unknown): void | Promise<void>
}

export interface CommandRegistry {
  register(cmd: Command): () => void // returns unregister
  execute(id: string, args?: unknown): Promise<void>
  get(id: string): Command | undefined
  list(filter?: { category?: string; enabledOnly?: boolean }): Command[]
}

export function createCommandRegistry(getContext: () => CommandContext): CommandRegistry {
  const commands = new Map<string, Command>()

  return {
    register(cmd) {
      commands.set(cmd.id, cmd)
      return () => {
        commands.delete(cmd.id)
      }
    },
    async execute(id, args) {
      const cmd = commands.get(id)
      if (!cmd) throw new Error(`Unknown command: ${id}`)
      if (cmd.isEnabled && !cmd.isEnabled(getContext())) {
        throw new Error(`Command is disabled: ${id}`)
      }
      await cmd.run(args)
    },
    get(id) {
      return commands.get(id)
    },
    list(filter) {
      const ctx = getContext()
      let result = [...commands.values()]
      if (filter?.category) {
        result = result.filter((c) => c.category === filter.category)
      }
      if (filter?.enabledOnly) {
        result = result.filter((c) => {
          const enabled = c.isEnabled?.(ctx) ?? true
          const visible = c.isVisible?.(ctx) ?? enabled // isVisible defaults to isEnabled
          return enabled && visible
        })
      }
      return result
    },
  }
}
