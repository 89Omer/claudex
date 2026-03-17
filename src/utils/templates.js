import { ROLES } from '../roles/index.js'
import { getProjectConfig } from './config.js'

// Built-in templates per role
const BUILTIN_TEMPLATES = {
  dev: {
    review: {
      label: 'Code Review',
      prompt: 'Review the following code for bugs, security issues, performance problems, and best practices. Be specific and actionable:\n\n'
    },
    refactor: {
      label: 'Refactor',
      prompt: 'Refactor the following code to be cleaner, more maintainable, and follow best practices. Explain key changes:\n\n'
    },
    debug: {
      label: 'Debug',
      prompt: 'Help me debug this issue. Analyze the error, identify the root cause, and provide a fix:\n\n'
    },
    test: {
      label: 'Write Tests',
      prompt: 'Write comprehensive tests for the following code. Cover happy paths, edge cases, and error scenarios:\n\n'
    },
    explain: {
      label: 'Explain Code',
      prompt: 'Explain how this code works in plain English. Include the purpose, flow, and any non-obvious parts:\n\n'
    },
    optimize: {
      label: 'Optimize',
      prompt: 'Optimize this code for performance. Identify bottlenecks and suggest improvements with benchmarks where relevant:\n\n'
    },
    docs: {
      label: 'Write Docs',
      prompt: 'Write clear documentation for this code including JSDoc/docstrings, usage examples, and parameter descriptions:\n\n'
    },
  },

  design: {
    review: {
      label: 'UX Review',
      prompt: 'Review this UI/UX for usability issues, accessibility problems (WCAG 2.1), and visual design improvements:\n\n'
    },
    component: {
      label: 'Build Component',
      prompt: 'Design and build a reusable, accessible component for the following use case. Include variants and states:\n\n'
    },
    responsive: {
      label: 'Make Responsive',
      prompt: 'Make this design fully responsive for mobile, tablet, and desktop. Use mobile-first approach:\n\n'
    },
    accessibility: {
      label: 'Accessibility Audit',
      prompt: 'Audit this for accessibility issues against WCAG 2.1 AA standards. List issues by severity and provide fixes:\n\n'
    },
    animation: {
      label: 'Add Animation',
      prompt: 'Add subtle, purposeful animations and micro-interactions to this. Keep them performant and respect prefers-reduced-motion:\n\n'
    },
    tokens: {
      label: 'Design Tokens',
      prompt: 'Extract and define design tokens (colors, spacing, typography, shadows) from this design into a structured system:\n\n'
    },
  },

  pm: {
    story: {
      label: 'User Story',
      prompt: 'Write a user story with clear acceptance criteria for the following feature. Format: As a [user], I want [goal], so that [benefit]:\n\n'
    },
    prd: {
      label: 'Write PRD',
      prompt: 'Write a concise PRD for this feature including: problem statement, goals, user stories, scope, success metrics, and open questions:\n\n'
    },
    prioritize: {
      label: 'Prioritize',
      prompt: 'Help me prioritize these items using RICE scoring (Reach, Impact, Confidence, Effort). Provide scores and reasoning:\n\n'
    },
    brief: {
      label: 'Project Brief',
      prompt: 'Write a project brief covering: background, objective, target users, key features, timeline, and success criteria:\n\n'
    },
    retro: {
      label: 'Retro',
      prompt: 'Help me structure a sprint retrospective. Organize feedback into: went well, improvements, action items:\n\n'
    },
    metrics: {
      label: 'Define Metrics',
      prompt: 'Define KPIs and success metrics for this feature. Include leading and lagging indicators, targets, and measurement methods:\n\n'
    },
  }
}

export function getTemplates(roleId) {
  const builtin = BUILTIN_TEMPLATES[roleId] || {}
  // Merge with any custom templates from project config
  const projectConfig = getProjectConfig()
  const custom = projectConfig?.templates?.[roleId] || {}
  return { ...builtin, ...custom }
}

export function getAllTemplates() {
  return BUILTIN_TEMPLATES
}

export function resolveTemplate(name, roleId) {
  const templates = getTemplates(roleId)
  // Exact match
  if (templates[name]) return { key: name, ...templates[name] }
  // Prefix match
  const key = Object.keys(templates).find(k => k.startsWith(name.toLowerCase()))
  if (key) return { key, ...templates[key] }
  return null
}

export function formatTemplateList(roleId) {
  const templates = getTemplates(roleId)
  return Object.entries(templates).map(([key, t], i) => ({
    index: i + 1,
    key,
    label: t.label,
    preview: t.prompt.slice(0, 60).replace(/\n/g, ' ') + '...'
  }))
}
