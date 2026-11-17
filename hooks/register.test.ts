import { expect, test } from 'claude-code/testing'

test('draws a ring per window with the remaining percentage', async ($, on) => {
  on('session.usage', async () => ({
    value: {
    startedAt: 0,
    context: { window: 1000, tokens: 250, percent: 25, breakdown: { autoCompactThreshold: 500 } },
    rateLimits: [{ kind: 'five_hour', percentUsed: 60 }],
  } }))

  // Another mod's row in the band, like a button
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['Fix grammar'] }))
  const mounted = await $.ui.mount({
    plugin: 'usage-ring',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { hasSurvey: false } as never,
  })
  const tree = JSON.stringify(await mounted.drawn())
  expect(tree).toContain('Context remaining 75%')
  expect(tree).toContain('Compact remaining 75%')
  expect(tree).toContain('5h limit remaining 40%')
  // The rings keep what other mods draw in the band
  expect(tree).toContain('Fix grammar')
})
