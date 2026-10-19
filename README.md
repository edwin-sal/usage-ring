# usage-ring

A Claude Code mod that shows three rings above the prompt:

- **5h limit**: how much of your 5-hour usage limit is left (green to red)
- **Context**: how much of the context window is left (green to red)
- **Compact**: how much room is left before auto-compaction (blue to red)

It also shows the current git branch on the right, or "not in repo".

The terminal shows each ring as a glyph and a percentage. The desktop app shows each ring as a circle.

## Install

Type this at the prompt of a terminal `claude` session:

```
/plugin install usage-ring --marketplace edwin-sal/usage-ring
```

1. At "Add marketplace?", type `y`.
2. Pick a scope. Push Enter for the user scope (all your sessions).

The rings show in that session at once. A user-scope install also loads in the desktop app's Code tab.

## Develop

```bash
claude --plugin-dir ./usage-ring
claude plugin validate ./usage-ring
claude plugin test ./usage-ring
```

`.claude-plugin/types/` is written by Claude Code when the mod loads. It is not committed.
