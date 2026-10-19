export type Remaining = { compact: number; context: number | null; fiveHour: number | null }

declare module 'claude-code' {
  interface PluginState {
    'usage-ring': { tick: number; threshold: number | null; branch: string | null }
  }
}
