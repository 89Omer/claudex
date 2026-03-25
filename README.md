<div align="center">

```
  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗██╗  ██╗
  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗██╔╝
  ██║     ██║     ███████║██║   ██║██║  ██║█████╗   ╚███╔╝
  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝   ██╔██╗
  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗██╔╝ ██╗
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
```

**A supercharged Claude Code CLI wrapper**

Pick your role. Pick your model. Launch with context. Track your costs.

[![npm version](https://img.shields.io/npm/v/claude-x?color=cyan)](https://www.npmjs.com/package/claude-x)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![node](https://img.shields.io/badge/node-18%2B-brightgreen)](https://nodejs.org)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#install)

</div>

---

## What is claudex?

Claude Code is powerful — but it starts every session as a blank slate with no context about what kind of work you're doing.

**claudex fixes that.** It wraps Claude Code with:

- 🎭 **Role system** — Developer, Designer, PM, or Marketing mode with tailored system prompts
- 🤖 **Model picker** — Choose Opus 4.6, Sonnet 4.6, or Haiku 4.5 at launch
- 💰 **Cost tracking** — See exactly what each session costs in USD
- 📊 **Stats dashboard** — Total spend, usage by role and model
- 📋 **Session history** — Every session logged, resumable
- 📝 **Session notes** — Save notes after each session, auto-suggested in future sessions
- ⚡ **Prompt templates** — Fire pre-built prompts for reviews, PRDs, refactors, and more
- 🧠 **Project memory** — Remembers your last role and model per project
- 🩺 **Diagnostics** — Inspect active context and validate your local setup with `doctor` and `context`

You run `claudex`. It sets up context and launches Claude Code for you.

---

## How it works

```
claudex
  │
  ├── You pick: role (Dev / Designer / PM)
  ├── You pick: model (Opus / Sonnet / Haiku)
  ├── claudex writes role system prompt → CLAUDE.md
  └── Claude Code launches with your context active from message one
```

When you exit, claudex shows a session summary and optionally saves notes:

```
  ────────────────────────────────────────────
  claudex — session ended
  ────────────────────────────────────────────

  Role      🧑‍💻 Developer
  Model     Sonnet 4.6
  Duration  14m 32s

  Tokens    12,400 in / 3,200 out
  Cost      $0.085

  All-time  $2.34 across 28 sessions

  ────────────────────────────────────────────

  Save session notes for next time? (Ctrl+D to finish, or press Enter to skip)
  > Fixed the auth middleware, added tests, need to review in next session

  ✓ Notes saved
```

Your notes are stored and automatically suggested when you resume related sessions.

---

## Requirements

- **Node.js 18+**
- **Claude Code** installed (`npm install -g @anthropic-ai/claude-code`)
- **Anthropic account** (free or paid) authenticated via `claude login`

---

## Install

```bash
# Clone the repo
git clone https://github.com/yourusername/claudex
cd claudex

# Install dependencies
npm install

# Link globally — makes `claudex` available anywhere in your terminal
npm link
```

> **Windows:** Run PowerShell as Administrator when running `npm link`

Verify:
```bash
claudex --help
```

---

## Quick Start

```bash
# 1. Run setup wizard (once)
claudex init

# 2. Optional: inspect setup and active context
claudex doctor
claudex context

# 3. Go to your project
cd my-project

# 4. Launch
claudex
```

On a first run in a new project, claudex now prints a short guide explaining what it will do before Claude Code starts: pick a role/model, write context into `CLAUDE.md`, and save project memory for next time.

You'll see role and model pickers. Press Enter to accept defaults, or type a number:

```
  Choose a role:

    1.  🧑‍💻  Developer            Clean, maintainable, production-ready code  ← last used
    2.  🎨  Designer             User experience, accessibility (WCAG)
    3.  📋  Product Manager      User stories, acceptance criteria

  Enter number [1]:

  Choose a model:

    1.  Opus 4.6        Most capable — coding, agents, 1M context, best reasoning
    2.  Sonnet 4.6      Recommended — near-Opus performance, fast, 1M context     ← last used
    3.  Haiku 4.5       Fastest & cheapest — quick tasks, high volume

  Enter number [2]:
```

---

## All Commands

| Command | Description |
|---|---|
| `claudex` | Interactive launcher — pick role + model |
| `claudex doctor` | Check setup, config, supported models, and Claude Code availability |
| `claudex context` | Show the active role/model for this project and where they came from |
| `claudex watch` | Launch with a live stats side panel in `tmux` |
| `claudex init` | First-time setup wizard |
| `claudex models` | List all available models |
| `claudex history` | Table of past sessions with cost + duration |
| `claudex stats` | Full cost dashboard by role and model |
| `claudex resume` | Pick a past Claude Code session to continue |
| `claudex use` | Pick a prompt template, then launch |
| `claudex --help` | Show help |

### Skip pickers with flags

```bash
claudex --role=design --model=opus    # launch directly, no prompts
claudex --role=dev                    # skip role picker only
claudex --model=haiku                 # skip model picker only
```

---

## Roles

### 🧑‍💻 Developer (`--role=dev`)
Default role. Focused on clean, production-ready code.

Covers: design patterns, architecture, performance, security, testing, debugging.

Best for: feature work, code reviews, refactoring, debugging, architecture.

### 🎨 Designer (`--role=design`)
Focused on UI/UX and frontend.

Covers: accessibility (WCAG), design systems, CSS/animations, responsive design, Figma-to-code, visual polish.

Best for: building components, CSS, accessibility audits, animations.

### 📋 Product Manager (`--role=pm`)
Focused on product thinking.

Covers: user stories, PRDs, RICE/MoSCoW prioritization, roadmaps, KPIs, stakeholder comms.

Best for: PRDs, user stories, feature briefs, prioritization, retros.

### 📣 Marketing (`--role=marketing`)
Focused on messaging, growth, and launch execution.

Covers: copywriting, positioning, campaigns, SEO briefs, email sequences, ad creative, and content strategy.

Best for: landing page copy, campaign plans, brand messaging, blog outlines, and marketing assets.

---

## Models

| Model | Shorthand | Best for | Cost |
|---|---|---|---|
| Opus 4.6 | `opus` | Complex reasoning, long tasks, agents | $5 / $25 per 1M tokens |
| Sonnet 4.6 | `sonnet` | Everyday coding, near-Opus quality ⭐ | $3 / $15 per 1M tokens |
| Haiku 4.5 | `haiku` | Quick tasks, high volume, cheapest | $0.80 / $4 per 1M tokens |

```bash
claudex models    # see full list with descriptions
```

---

## Prompt Templates

Run `claudex use` to pick a template before launching. Templates inject a pre-built prompt into your session so Claude starts working immediately.

**Developer templates:** Code Review, Refactor, Debug, Write Tests, Explain Code, Optimize, Write Docs

**Designer templates:** UX Review, Build Component, Make Responsive, Accessibility Audit, Add Animation, Design Tokens

**PM templates:** User Story, Write PRD, Prioritize (RICE), Project Brief, Retro, Define Metrics

**Marketing templates:** Write Copy, Campaign Plan, Brand Positioning, SEO Brief, Email Sequence, Ad Creative, Blog Post

Add your own in `.claudex.json`:
```json
{
  "templates": {
    "dev": {
      "mytemplate": {
        "label": "My Custom Template",
        "prompt": "Do this specific thing to my code:\n\n"
      }
    }
  }
}
```

---

## Cost Tracking & Stats

claudex tracks every session automatically. No setup needed.

```bash
claudex stats
```

```
  claudex stats
  ────────────────────────────────────────────

  Overview

  Total sessions    28
  Total cost        $4.821
  Total tokens      2.1M
  Avg per session   $0.172

  By Role

  🧑‍💻 Developer        ████████░░░░   18 sessions   $3.201
  🎨 Designer          ████░░░░░░░░    7 sessions   $1.124
  📋 Product Manager   ██░░░░░░░░░░    3 sessions   $0.496

  By Model

  Sonnet 4.6           ████████████   22 sessions   $2.940
  Opus 4.6             ████░░░░░░░░    4 sessions   $1.620
  Haiku 4.5            ██░░░░░░░░░░    2 sessions   $0.261
```

```bash
claudex history    # full session log
```

---

## Session History & Resume

```bash
claudex history      # list all sessions
claudex resume       # pick a past session to continue
```

Resume opens a picker showing your recent Claude Code sessions. Select one to pick up exactly where you left off.

---

## Session Notes

After each session ends, claudex offers a quick prompt to save notes:

```
Save session notes for next time? (Ctrl+D to finish, or press Enter to skip)
>
```

Type what you did, blockers, next steps, or anything you want to remember. Press Ctrl+D to save, or Enter to skip.

**Your notes are automatically suggested in future sessions**, helping you jump back in without re-reading context. Great for:
- Tracking blockers to tackle next
- Documenting what was completed
- Leaving yourself breadcrumbs for multi-day tasks
- Building continuity across sessions

---

## Project Memory

claudex remembers your last role and model **per project folder**. Next time you run `claudex` in the same directory, it pre-selects what you used last (shown as `← last used`).

Override anytime by picking a different option.

## Diagnostics & Context

Use these commands when you want the user to understand exactly what claudex is doing:

```bash
claudex doctor
claudex context
```

`claudex doctor` checks:
- whether Claude Code is installed and discoverable
- whether your saved config references supported roles/models
- whether this project has `.claudex.json`, `CLAUDE.md`, and saved project memory
- how many sessions and how much spend claudex has tracked

`claudex context` explains:
- the active role and model for the current project
- whether they came from `CLAUDE.md`, project memory, `.claudex.json`, or global defaults
- what prompt layers are available, including templates and any extra user content in `CLAUDE.md`

---

## Project Config

Create `.claudex.json` in any project to set per-project defaults:

```json
{
  "defaultRole": "design",
  "defaultModel": "claude-opus-4-6",
  "templates": {
    "design": {
      "brandreview": {
        "label": "Brand Review",
        "prompt": "Review this against our brand guidelines:\n\n"
      }
    }
  }
}
```

Commit it to share defaults with your team, or add to `.gitignore` to keep it personal.

## Testing

This repo does not include a formal automated test suite yet. The fastest smoke test is:

```bash
node src/index.js --help
node src/index.js doctor
node src/index.js context
node --check src/index.js
node --check src/utils/doctor.js
node --check src/utils/init.js
```

For manual verification of the interactive flow:

```bash
node src/index.js
node src/index.js use
node src/index.js watch
```

---

## How Role Injection Works

claudex writes your role's system prompt into `CLAUDE.md` in your project:

```markdown
# claudex — Active Role: Designer 🎨
# Model: Sonnet 4.6 (claude-sonnet-4-6)

You are an expert UI/UX designer and frontend developer. Focus on:
- User experience, accessibility (WCAG), and visual hierarchy
...
<!-- claudex:role:design -->
<!-- claudex:model:claude-sonnet-4-6 -->
```

Claude Code reads `CLAUDE.md` automatically on startup. Your role is active from message one.

**Your existing `CLAUDE.md` is safe** — claudex preserves any content you've written below the role block.

---

## Troubleshooting

**`claudex: command not found`**
```bash
# macOS / Linux
sudo npm link

# Windows — run PowerShell as Administrator
npm link

# Or add npm global bin to PATH
# Windows: $env:PATH += ";$env:APPDATA\npm"
# macOS:   export PATH="$(npm root -g)/../bin:$PATH"
```

**`✗ Claude Code not found`**

claudex will offer to install it automatically. Or manually:
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

On Windows, restart PowerShell after installing so PATH updates take effect.

**`✗ Failed to launch 'claude'`**

Claude Code is installed but can't be spawned. Try:
```bash
claude --version          # verify it works
npm install -g @anthropic-ai/claude-code   # reinstall
claude login              # re-authenticate
```

**Model flag not working**

Use `=` not a space: `--model=sonnet` ✓ not `--model sonnet` ✗

---

## Updating

```bash
cd claudex
git pull
npm install
```

No need to re-run `npm link` after pulling updates.

---

## Power Users — Pair with everything-claude-code

claudex handles the **launch layer** — role context, model selection, cost tracking.

For the **inside of your sessions** — skills, hooks, subagents, and slash commands — pair it with [everything-claude-code](https://github.com/affaan-m/everything-claude-code) by [@affaanmustafa](https://github.com/affaan-m).

```
claudex                          → sets role, model, CLAUDE.md, tracks cost
     ↓ launches Claude Code
everything-claude-code plugin    → skills, hooks, subagents, /commands inside sessions
```

They don't overlap. They stack.

**Install everything-claude-code inside a Claude Code session:**

```bash
# Run these inside Claude Code after launching with claudex
/plugin marketplace add affaan-m/everything-claude-code
/plugin install everything-claude-code@everything-claude-code
```

You get claudex's role system on top of a battle-tested skill and agent library. The best of both.

---

## Contributing

PRs welcome. Ideas for v2.1:

- [ ] Custom roles via config
- [ ] Cost budget alerts (`--budget=5`)
- [ ] Export session history to CSV/markdown
- [ ] `claudex ls` — list all project configs
- [ ] Neovim / JetBrains integration

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">
Built on top of <a href="https://github.com/anthropics/claude-code">Claude Code</a> by Anthropic
</div>
