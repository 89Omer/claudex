import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { getElapsedTime, formatCost, formatTokens, getTokenUsagePercent } from '../utils/session.js'
import { getContextWindow } from '../utils/config.js'

const THEMES = {
  dark: {
    bg: 'bgBlack',
    border: 'gray',
    text: 'white',
    dim: 'gray',
    success: 'green',
    warn: 'yellow',
    danger: 'red',
  },
  light: {
    bg: 'bgWhite',
    border: 'gray',
    text: 'black',
    dim: 'gray',
    success: 'green',
    warn: 'yellow',
    danger: 'red',
  }
}

function TokenBar({ percent, width = 20 }) {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const color = percent > 85 ? 'red' : percent > 65 ? 'yellow' : 'green'
  return <Text color={color}>{bar}</Text>
}

export function StatusBar({ session, role, theme = 'dark' }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const pct = getTokenUsagePercent(session)
  const totalTokens = session.inputTokens + session.outputTokens
  const maxTokens = getContextWindow(session.model)
  const costColor = session.cost > 1 ? 'red' : session.cost > 0.5 ? 'yellow' : 'green'

  return (
    <Box flexDirection="column">
      {/* Top border */}
      <Box>
        <Text color="gray">{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      {/* Main status row */}
      <Box justifyContent="space-between" paddingX={1}>
        {/* Left: role */}
        <Box gap={1}>
          <Text bold color={role.colorName}>
            {role.emoji} {role.name}
          </Text>
          <Text color="gray">│</Text>
          <Text color="gray" dimColor>{session.model}</Text>
        </Box>

        {/* Center: token bar */}
        <Box gap={1} alignItems="center">
          <Text color="gray">ctx</Text>
          <TokenBar percent={pct} width={18} />
          <Text color="gray">
            {formatTokens(totalTokens)}/{formatTokens(maxTokens)}
          </Text>
        </Box>

        {/* Right: cost + time */}
        <Box gap={2}>
          <Box gap={1}>
            <Text color="gray">cost</Text>
            <Text bold color={costColor}>{formatCost(session.cost)}</Text>
          </Box>
          <Text color="gray">│</Text>
          <Box gap={1}>
            <Text color="gray">⏱</Text>
            <Text color="white">{getElapsedTime(session)}</Text>
          </Box>
          <Text color="gray">│</Text>
          <Box gap={1}>
            <Text color="gray">msgs</Text>
            <Text color="white">{session.messages}</Text>
          </Box>
        </Box>
      </Box>

      {/* Bottom border */}
      <Box>
        <Text color="gray">{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>
    </Box>
  )
}

export function HelpBar({ role }) {
  return (
    <Box paddingX={1} gap={3}>
      <Text color="gray" dimColor>
        <Text color="cyan">/dev</Text> <Text color="gray">developer</Text>
        {'  '}
        <Text color="magenta">/design</Text> <Text color="gray">designer</Text>
        {'  '}
        <Text color="yellow">/pm</Text> <Text color="gray">product</Text>
        {'  '}
        <Text color="gray">/use &lt;template&gt;</Text>
        {'  '}
        <Text color="gray">/help</Text>
        {'  '}
        <Text color="gray">/quit</Text>
      </Text>
    </Box>
  )
}
