import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Remaining } from '../types'

// Bumped after each turn so the band redraws; the figures themselves are read live while drawing.
const tick = atom({ plugin: 'usage-ring', key: 'tick' } as const, 0)
// Token count at which auto-compaction runs; null until measured or when it is off.
const threshold = atom({ plugin: 'usage-ring', key: 'threshold' } as const, null as number | null)

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

// 100% left -> hue 120 (green); 0% left -> hue 0 (red); linear in between.
const colorFor = (left: number) => `hsl(${Math.round(left * 1.2)}, 80%, 45%)`

const ringSvg = (left: number, color: string) => {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">` +
    `<circle cx="22" cy="22" r="${r}" fill="none" stroke="#888" stroke-opacity="0.25" stroke-width="4"/>` +
    `<circle cx="22" cy="22" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" ` +
    `stroke-dasharray="${(left / 100) * c} ${c}" transform="rotate(-90 22 22)"/>` +
    `<text x="22" y="27.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="800" fill="#fff">${left}</text>` +
    `</svg>`
  )
}

// 100% left -> blue; 0% left -> red; straight RGB blend, so it passes through purple.
const blueToRed = (left: number) => {
  const t = left / 100
  const from = [59, 130, 246]
  const to = [239, 68, 68]
  const [r, g, b] = from.map((f, i) => Math.round(to[i]! + (f - to[i]!) * t))

  return `rgb(${r}, ${g}, ${b})`
}

const greenToRed = (left: number) => colorFor(left)

const glyph = (left: number) => (left > 87 ? '●' : left > 62 ? '◕' : left > 37 ? '◑' : left > 12 ? '◔' : '○')

// '' until first read; null when the session is not in a git repository.
const branch = atom({ plugin: 'usage-ring', key: 'branch' } as const, '' as string | null)

async function readBranch($: EngineInterface): Promise<string | null> {
  if ((await $.session.repo()) === null) {
    return null
  }
  const named = await $.process.run(['git', 'symbolic-ref', '--short', '-q', 'HEAD'])
  if (named.exitCode === 0 && named.stdout.trim() !== '') {
    return named.stdout.trim()
  }
  // Detached HEAD: show the short commit instead.
  const short = await $.process.run(['git', 'rev-parse', '--short', 'HEAD'])

  return short.exitCode === 0 ? short.stdout.trim() : null
}

async function refreshBranch($: EngineInterface) {
  try {
    const name = await readBranch($)
    await update($, branch, () => name)
  } catch {
    // git missing or unreadable: keep the last label rather than fail the caller
  }
}

async function readThreshold($: EngineInterface): Promise<number | null> {
  const { context } = await $.session.usage({ breakdown: 'summary' })

  return context.breakdown?.autoCompactThreshold ?? context.breakdown?.rawMaxTokens ?? null
}

async function measure($: EngineInterface, compactAt: number | null): Promise<Remaining> {
  const usage = await $.session.usage()
  const five = usage.rateLimits.find(l => l.kind === 'five_hour')

  const used = usage.context.tokens ?? 0
  const limit = compactAt ?? usage.context.window

  return {
    compact: clamp(100 - (used / limit) * 100),
    context: usage.context.percent === undefined ? 100 : clamp(100 - usage.context.percent),
    fiveHour: five ? clamp(100 - five.percentUsed) : null,
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const at = await readThreshold($)
    await update($, threshold, () => at)
    await refreshBranch($)

    return next(e)
  })

  // A Bash call may have switched branches.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    await refreshBranch($)

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const at = await readThreshold($)
    await update($, threshold, () => at)
    await refreshBranch($)
    await update($, tick, n => n + 1)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }
    const { Box, Text, Svg } = $.ui.resolve(e)
    await read($, tick)
    const branchName = await read($, branch)
    const value = await measure($, await read($, threshold))
    const rings: [string, number | null, (left: number) => string][] = [
      ['5h limit', value.fiveHour, greenToRed],
      ['Context', value.context, greenToRed],
      ['Compact', value.compact, blueToRed],
    ]

    return (
      <Box alignItems="center" width="100%">
        <Box gap={3} flexShrink={0}>
        {rings.map(([label, left, tint]) =>
          left === null ? (
            <Text dimColor>{label}: n/a</Text>
          ) : e.surface === 'terminal' ? (
            <Text color={tint(left)}>
              {glyph(left)} {label} {left}%
            </Text>
          ) : (
            <Box alignItems="center" gap={1}>
              <Svg source={ringSvg(left, tint(left))} alt={`${label} remaining ${left}%`} width={32} height={32} />
              <Text dimColor>{label}</Text>
            </Box>
          ),
        )}
        </Box>
        {branchName !== '' && (
          <Box flexGrow={1} flexShrink={1} minWidth={0} justifyContent="flex-end" marginLeft={3}>
            <Text dimColor={branchName === null} wrap="truncate-end">
              {branchName === null ? 'not in repo' : `⎇ ${branchName}`}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
