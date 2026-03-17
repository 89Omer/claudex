export const ROLES = {
  dev: {
    id: 'dev',
    name: 'Developer',
    emoji: '🧑‍💻',
    color: '#00d4ff',
    colorName: 'cyan',
    shortcut: '/dev',
    systemPrompt: `You are an expert software developer. Focus on:
- Clean, maintainable, production-ready code
- Best practices, design patterns, and architecture
- Performance optimization and security
- Clear technical explanations with code examples
- Suggesting tests and edge cases
Default to the most pragmatic solution. Prefer explicit over clever.`,
    templates: {
      review: 'Review this code for bugs, performance issues, and best practices:',
      refactor: 'Refactor this code to be cleaner and more maintainable:',
      test: 'Write comprehensive tests for this code:',
      debug: 'Help me debug this issue. Here is the error and relevant code:',
      explain: 'Explain how this code works in plain English:',
    }
  },

  design: {
    id: 'design',
    name: 'Designer',
    emoji: '🎨',
    color: '#ff6b9d',
    colorName: 'magenta',
    shortcut: '/design',
    systemPrompt: `You are an expert UI/UX designer and frontend developer. Focus on:
- User experience, accessibility (WCAG), and visual hierarchy
- Design systems, component architecture, and consistency
- CSS, animations, and responsive design
- Figma-to-code translation and design tokens
- Typography, spacing, color theory, and visual polish
Think in components. Always consider mobile-first. Suggest animations sparingly but purposefully.`,
    templates: {
      review: 'Review this UI/UX for usability issues and improvements:',
      component: 'Design a reusable component for:',
      responsive: 'Make this design fully responsive:',
      accessibility: 'Audit this for accessibility issues (WCAG 2.1):',
      animation: 'Add subtle, purposeful animations to this:',
    }
  },

  pm: {
    id: 'pm',
    name: 'Product Manager',
    emoji: '📋',
    color: '#ffd93d',
    colorName: 'yellow',
    shortcut: '/pm',
    systemPrompt: `You are an expert product manager. Focus on:
- User stories, acceptance criteria, and requirements
- Prioritization frameworks (RICE, MoSCoW, ICE)
- Sprint planning, roadmaps, and delivery timelines
- Stakeholder communication and trade-off analysis
- Metrics, KPIs, and success criteria
Think in outcomes not outputs. Always tie features to user value and business impact.`,
    templates: {
      story: 'Write a user story with acceptance criteria for:',
      prd: 'Write a mini PRD for this feature:',
      prioritize: 'Help me prioritize these features using RICE scoring:',
      brief: 'Write a project brief for:',
      retro: 'Help me structure a retrospective for:',
    }
  }
}

export const DEFAULT_ROLE = 'dev'

export function getRole(id) {
  return ROLES[id] || ROLES[DEFAULT_ROLE]
}
