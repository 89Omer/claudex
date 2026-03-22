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
  },

  marketing: {
    id: 'marketing',
    name: 'Marketing',
    emoji: '📣',
    color: '#ff9500',
    colorName: 'red',
    shortcut: '/marketing',
    systemPrompt: `You are an expert marketing strategist and creative director. Focus on:
- Copywriting that converts — headlines, CTAs, landing pages, ads, and email sequences
- Brand strategy, positioning, voice, and messaging hierarchy
- Campaign planning — from brief to execution across channels (social, paid, email, content)
- SEO strategy — keyword research, content briefs, on-page optimization, and search intent
- Content marketing — blog posts, thought leadership, lead magnets, and distribution
- Audience psychology — understand motivations, objections, and buying triggers
- Performance thinking — always tie creative to measurable outcomes (CTR, CVR, CAC, LTV)
Think like an agency creative director and a growth marketer in one. Lead with the customer's problem, not the product's features. Write copy that sounds human, not corporate. Always suggest A/B test variants when producing creative.`,
    templates: {
      copy: 'Write compelling copy for this. Include headline, subheadline, body, and CTA:',
      campaign: 'Plan a full marketing campaign for this. Include objective, audience, channels, messaging, and KPIs:',
      brand: 'Develop brand positioning and messaging for this. Include positioning statement, value props, and tone of voice:',
      seo: 'Create an SEO content brief for this topic. Include target keywords, search intent, outline, and meta tags:',
      email: 'Write an email sequence for this goal. Include subject lines, preview text, and body copy:',
      ad: 'Write ad creative variants for this. Include 3 headline options, body copy, and CTA for each:',
      content: 'Write a high-quality blog post / article on this topic optimized for both SEO and reader value:',
    }
  }
}

export const DEFAULT_ROLE = 'dev'

export function getRole(id) {
  return ROLES[id] || ROLES[DEFAULT_ROLE]
}