# claudex ⚡

A supercharged Claude Code CLI wrapper. Pick your role, pick your model, then launch straight into a full Claude Code session — with your context already active.

```
  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗██╗  ██╗
  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗██╔╝
  ██║     ██║     ███████║██║   ██║██║  ██║█████╗   ╚███╔╝
  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝   ██╔██╗
  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗██╔╝ ██╗
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
```

---

## What is claudex?

Claude Code is powerful but starts every session as a blank slate. claudex solves that by:

1. Letting you pick a **role** (Developer, Designer, or Product Manager)
2. Letting you pick a **Claude model** (Opus 4.6, Sonnet 4.6, Haiku 4.5)
3. Writing a tailored **system prompt** into `CLAUDE.md` in your project
4. Launching **Claude Code** — identical to running `claude` directly, but with your role context active from message one

You only ever run `claudex`. Claude Code is auto-detected and started for you.

---

## Requirements

- **Node.js 18+**
- **Claude Code** installed and authenticated

### Install Claude Code

**Windows (PowerShell):**
```powershell
npm install -g @anthropic-ai/claude-code
claude login
```

**macOS / Linux:**
```bash
npm install -g @anthropic-ai/claude-code
claude login
```

> claudex will detect Claude Code automatically. If it's not installed, claudex will offer to install it for you when you first run it.

---

## Install claudex

**Windows (PowerShell):**
```powershell
# 1. Extract the downloaded archive
tar -xzf claudex.tar.gz
cd claudex

# 2. Install dependencies
npm install

# 3. Link globally so claudex works anywhere
npm link
```

**macOS / Linux:**
```bash
tar -xzf claudex.tar.gz
cd claudex
npm install
npm link
```

Verify it works:
```bash
claudex --help
```

> **Windows note:** If `npm link` gives a permissions error, run PowerShell as Administrator first.

---

## First-time setup

Run the setup wizard to set your defaults:

```bash
claudex init
```

It will ask you:

| Setting | Options | Default |
|---|---|---|
| Default role | dev / design / pm | dev |
| Default model | opus / sonnet / haiku | sonnet |
| Budget alert | any USD amount | $5.00 |
| Create `.claudex.json`? | y / n | y |

Your choices are saved globally and optionally as `.claudex.json` in your project directory.

---

## Usage

### Interactive mode (recommended)
```bash
claudex
```

Shows a role picker then a model picker. Press Enter to accept the default (shown in brackets), or type a number to choose.

```
  Choose a role:

    1.  🧑‍💻  Developer            Clean, maintainable, production-ready code
    2.  🎨  Designer             User experience, accessibility (WCAG)
    3.  📋  Product Manager      User stories, acceptance criteria

  Enter number [1]:

  Choose a model:

    1.  Opus 4.6        Most capable — coding, agents, 1M context, best reasoning
    2.  Sonnet 4.6      Recommended — near-Opus performance, fast, 1M context  ← default
    3.  Haiku 4.5       Fastest & cheapest — quick tasks, high volume

  Enter number [2]:
```

claudex then injects your role into `CLAUDE.md` and launches Claude Code.

### Skip the pickers with flags
```bash
# Skip both pickers — launch directly
claudex --role=design --model=opus

# Skip role picker only (still asks model)
claudex --role=pm

# Skip model picker only (still asks role)
claudex --model=haiku

# Shorthand model names work
claudex --role=dev --model=sonnet
```

### Quick launch by role
```bash
claudex --role=dev      # Developer + default model
claudex --role=design   # Designer + default model
claudex --role=pm       # Product Manager + default model
```

---

## Roles

### 🧑‍💻 Developer (`--role=dev`)
The default role. Focused on writing clean, production-ready code.

System prompt covers: clean/maintainable code, design patterns, architecture, performance, security, testing, debugging.

Best for: feature development, code reviews, refactoring, debugging, architecture decisions.

### 🎨 Designer (`--role=design`)
Focused on UI/UX and frontend implementation.

System prompt covers: UX/accessibility (WCAG), design systems, CSS/animations, responsive design, Figma-to-code, typography, visual polish.

Best for: building components, CSS work, accessibility audits, design reviews, animations.

### 📋 Product Manager (`--role=pm`)
Focused on product thinking and communication.

System prompt covers: user stories, acceptance criteria, RICE/MoSCoW prioritization, sprint planning, roadmaps, stakeholder communication, KPIs.

Best for: writing PRDs, user stories, feature briefs, prioritization, retros.

---

## Models

| Model | Shorthand | API ID | Best for |
|---|---|---|---|
| Opus 4.6 | `opus` | `claude-opus-4-6` | Complex reasoning, long tasks, best quality |
| Sonnet 4.6 | `sonnet` | `claude-sonnet-4-6` | Everyday coding, near-Opus quality, recommended |
| Haiku 4.5 | `haiku` | `claude-haiku-4-5` | Quick tasks, high-volume, fastest & cheapest |

> Haiku 4.6 has not been released yet — Haiku 4.5 is the current fast/cheap option.

List models anytime:
```bash
claudex models
```

---

## How the role injection works

When you launch claudex, it writes your selected role's system prompt into `CLAUDE.md` in your current working directory:

```markdown
# claudex — Active Role: Designer 🎨
# Model: Sonnet 4.6 (claude-sonnet-4-6)

You are an expert UI/UX designer and frontend developer. Focus on:
- User experience, accessibility (WCAG), and visual hierarchy
...
<!-- claudex:role:design -->
<!-- claudex:model:claude-sonnet-4-6 -->
```

Claude Code reads `CLAUDE.md` automatically on startup as its system context. Your role is active from your very first message.

**Your existing `CLAUDE.md` is safe.** If you already have project notes in `CLAUDE.md`, claudex preserves them below the role block. Switching roles only replaces the claudex-managed section.

---

## Auto-detection of Claude Code

claudex automatically detects the Claude Code command on your system. It tries:

1. `claude`
2. `claude-code`
3. `claude-cli`

On **Windows**, it uses `where.exe` for detection and spawns the `.cmd` version automatically — no manual configuration needed.

If Claude Code is not found, claudex will:
- Show you the install command
- Offer to run the install for you
- Exit cleanly with next steps

---

## Project-level config

Create a `.claudex.json` in any project folder to override your global defaults for that project:

```json
{
  "defaultRole": "design",
  "defaultModel": "claude-opus-4-6"
}
```

claudex merges project config over global config, so per-project settings always win.

---

## Subcommands

| Command | Description |
|---|---|
| `claudex` | Interactive role + model picker, then launch |
| `claudex init` | Run the setup wizard |
| `claudex models` | List all available models with descriptions |
| `claudex --help` | Show usage and all flags |

---

## Tips

**Switch roles between tasks** — exit Claude Code (`/exit` or Ctrl+C), run `claudex --role=pm`, and you're back in with a fresh role context.

**Pin a model per project** by setting `defaultModel` in `.claudex.json`. Useful if one project always needs Opus and another is fine with Haiku.

**Add `.claudex.json` to `.gitignore`** if you don't want teammates picking up your personal defaults, or commit it to share project defaults with your team.

**Role prompt stacks with your own notes.** Add project-specific instructions below the claudex block in `CLAUDE.md` — both will be active.

---

## Troubleshooting

**`claudex: command not found`**

`npm link` didn't register the binary. Try:
```powershell
# Windows — run PowerShell as Administrator
npm link

# macOS / Linux
sudo npm link

# Or add npm global bin to PATH manually
# Windows:
$env:PATH += ";$env:APPDATA\npm"
# macOS / Linux:
export PATH="$(npm root -g)/../bin:$PATH"
```

**`✗ claude not found in PATH` or `✗ Failed to launch 'claude'`**

Claude Code is installed but can't be launched. Try:
```bash
claude --version        # verify it works directly
npm install -g @anthropic-ai/claude-code   # reinstall if needed
claude login            # re-authenticate
```

On Windows, restart PowerShell after installing Claude Code so the PATH updates take effect.

**Model flag not taking effect**

Use `=` not a space: `--model=sonnet` not `--model sonnet`. Or use the full ID: `--model=claude-sonnet-4-6`.

**Existing `CLAUDE.md` got overwritten**

claudex only replaces the section between the claudex banner and the `<!-- claudex:role:... -->` marker. Content below the `---` separator is always preserved.

---

## Updating claudex

Extract the new archive over your existing folder and re-link:

```bash
tar -xzf claudex.tar.gz
cd claudex
npm install
npm link
```
