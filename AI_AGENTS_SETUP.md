# AI Agents Setup — New OS Migration Guide

This document contains everything needed to replicate the AI agent configuration on a new machine/OS.

---

## 1. Tools Overview

| Tool | Purpose | Config Location |
|------|---------|-----------------|
| **OpenCode** | Primary AI coding CLI | `~/.config/opencode/opencode.jsonc` |
| **Claude Code** | Anthropic's AI CLI | `~/.claude/settings.local.json` |
| **Codex** | OpenAI's AI CLI | `.codex/config.toml` (per-project) |
| **Superpowers** | OpenCode plugin (skills pack) | Installed via `opencode.jsonc` |
| **Graphify** | Codebase knowledge graph | `~/.local/share/uv/tools/graphifyy/` |
| **Impeccable** | UI design/iteration tool | `.impeccable/` (per-project) |

---

## 2. OpenCode Setup

### 2.1 Install OpenCode

Follow the official install instructions at https://opencode.ai

### 2.2 Global Config

Create `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git"
  ]
}
```

This installs the **superpowers** plugin which provides ~30+ skills (brainstorming, systematic-debugging, writing-plans, test-driven-development, etc.).

### 2.3 Project-Level Skills

The project has 14 custom skills in `.opencode/skills/`:

| Skill | Purpose |
|-------|---------|
| `brainstorming` | Turn ideas into designs before coding |
| `finishing-a-development-branch` | Verify tests, present merge options |
| `frontend-design` | Visual design guidance |
| `grill-me` | Interview to sharpen plans |
| `handoff` | Project/module handover |
| `react-best-practices` | React/Next.js performance |
| `skill-creator` | Create/modify skills |
| `stop-slop` | Remove AI writing patterns |
| `subagent-driven-development` | Parallel task execution |
| `systematic-debugging` | Root cause before fixes |
| `test-driven-development` | TDD workflow |
| `verification-before-completion` | Verify before claiming done |
| `webapp-testing` | Playwright testing |
| `writing-plans` | Create implementation plans |

These are committed to the repo in `.opencode/skills/` — they travel with the project.

---

## 3. Claude Code Setup

### 3.1 Install Claude Code

Follow instructions at https://docs.anthropic.com/en/docs/claude-code

### 3.2 Project Config

Create `.claude/settings.local.json` in the project root:

```json
{
  "theme": "dark",
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.moonshot.ai/v1/",
    "ANTHROPIC_API_KEY": "<YOUR_API_KEY>",
    "MODEL": "kimi-k2.7-code"
  },
  "permissions": {
    "allow": [
      "Bash($PYTHON *)",
      "Bash(/home/sakib/.local/share/uv/tools/graphifyy/bin/python -c ' *)",
      "Bash(/home/sakib/.local/share/uv/tools/graphifyy/bin/python *)"
    ]
  }
}
```

> **Note:** Replace `<YOUR_API_KEY>` with your actual key. Update paths if your username differs.

### 3.3 Global Skills

43 skills installed at `~/.claude/skills/`. Key ones:

**Cloudflare/Workers:**
- `agents-sdk`, `cloudflare`, `cloudflare-email-service`, `cloudflare-one`, `cloudflare-one-migrations`, `durable-objects`, `sandbox-sdk`, `workers-best-practices`, `wrangler`, `turnstile-spin`

**UI/Design:**
- `impeccable`, `frontend-design`, `web-design-guidelines`, `web-perf`

**Knowledge/Analysis:**
- `graphify`, `understand`, `understand-chat`, `understand-dashboard`, `understand-diff`, `understand-domain`, `understand-explain`, `understand-figma`, `understand-knowledge`, `understand-onboard`

**Dev Workflow:**
- `composio`, `cavecrew`, `firecrawl`, `mcp-builder`, `skill-creator`, `skill-generalizer`, `skill-miner`, `skill-personalizer`, `stop-slop`, `vercel-optimize`, `webapp-testing`

To reinstall these, you'll need to set up each skill individually (they're not all from a single source).

---

## 4. Codex Setup

### 4.1 Install Codex

Follow instructions at https://github.com/openai/codex

### 4.2 Project Config

Create `.codex/config.toml` in the project root:

```toml
[shell_environment_policy]
inherit = "core"

[shell_environment_policy.set]
ANTHROPIC_BASE_URL = "https://api.moonshot.ai/v1/"
ANTHROPIC_API_KEY = "<YOUR_API_KEY>"
MODEL = "kimi-k2.7-code"
```

---

## 5. CommandCode Setup

Create `.commandcode/settings.json` in the project root. This file contains extensive shell permission allowlists for the graphify workflow, impeccable scripts, and general development commands. Copy from the existing project or regenerate as needed.

---

## 6. Graphify (Knowledge Graph Tool)

### 6.1 Install

```bash
# Requires Python + uv
uv tool install graphifyy
```

Or install from the source if it's a custom/private package.

### 6.2 Verify

```bash
which graphifyy
# Should output: /home/<user>/.local/share/uv/tools/graphifyy/bin/graphifyy
```

---

## 7. Git Hooks (Husky)

Already committed to repo. On new machine after `pnpm install`:

```bash
pnpm install
# Husky auto-installs hooks via "prepare" script
```

**Hooks:**
- `pre-commit`: runs `pnpm run lint`
- `commit-msg`: runs `pnpm exec commitlint --edit $1`

**Commitlint config** (`commitlint.config.js`):
```js
export default { extends: ['@commitlint/config-conventional'] };
```

Uses conventional commits (feat:, fix:, chore:, etc.).

---

## 8. Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_HOST` / `REDIS_PORT` — Redis connection
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — Random 16+ char strings
- `JWT_ACCESS_TTL_SECONDS` / `JWT_REFRESH_TTL_SECONDS` — Token expiry

---

## 9. Project Dependencies

```bash
# Requires Node.js >= 18 and pnpm 9.x
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install
```

---

## 10. Superpowers SDD Files

The `.superpowers/sdd/` directory contains Spec-Driven Development progress files for past features. These are committed to the repo and travel with it.

---

## 11. Quick Setup Script (Manual Steps)

```bash
# 1. Clone the repo
git clone <repo-url> && cd workspace-app

# 2. Install dependencies
corepack enable && corepack prepare pnpm@9.0.0 --activate
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your values

# 4. Install OpenCode (if not installed)
# Follow https://opencode.ai install instructions

# 5. Create OpenCode global config
mkdir -p ~/.config/opencode
cat > ~/.config/opencode/opencode.jsonc << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git"
  ]
}
EOF

# 6. Create Claude Code project config
cat > .claude/settings.local.json << 'EOF'
{
  "theme": "dark",
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.moonshot.ai/v1/",
    "ANTHROPIC_API_KEY": "<YOUR_KEY>",
    "MODEL": "kimi-k2.7-code"
  },
  "permissions": {
    "allow": [
      "Bash($PYTHON *)",
      "Bash(/home/sakib/.local/share/uv/tools/graphifyy/bin/python -c ' *)",
      "Bash(/home/sakib/.local/share/uv/tools/graphifyy/bin/python *)"
    ]
  }
}
EOF

# 7. Create Codex project config
cat > .codex/config.toml << 'EOF'
[shell_environment_policy]
inherit = "core"

[shell_environment_policy.set]
ANTHROPIC_BASE_URL = "https://api.moonshot.ai/v1/"
ANTHROPIC_API_KEY = "<YOUR_KEY>"
MODEL = "kimi-k2.7-code"
EOF

# 8. Install Graphify (if needed)
uv tool install graphifyy

# 9. Verify hooks work
git commit --allow-empty -m "test: verify hooks" && git reset HEAD~1
```

---

## 12. Files NOT in Repo (Create on New OS)

These files are gitignored and must be recreated:

| File | Source |
|------|--------|
| `.env` | Copy from `.env.example`, fill in secrets |
| `.claude/settings.local.json` | See section 3.2 |
| `.codex/config.toml` | See section 4.2 |
| `~/.config/opencode/opencode.jsonc` | See section 2.2 |
| `~/.claude/skills/*` | Reinstall individually |

## 13. Files IN Repo (Travel with Project)

These are committed and will be present after `git clone`:

- `.opencode/skills/*` — 14 project skills
- `.superpowers/sdd/*` — SDD progress files
- `.husky/*` — Git hooks
- `commitlint.config.js`
- `.gitignore`
- `.env.example`
- `.commandcode/settings.json`

---

## 14. Rules & Behavioral Constraints

The AI agents in this project follow a strict set of rules from multiple sources. These are NOT optional — they define how the agent behaves.

### 14.1 Core System Rules (Always Active)

**Tone & Style:**
- Be concise, direct, and to the point
- Answer in under 4 lines unless detail is requested
- No emojis unless explicitly requested
- No unnecessary preamble/postamble ("The answer is...", "Here is what I will do...")
- One word answers are best when possible

**Code References:**
- Reference specific code with `file_path:line_number`
- Never generate/guess URLs unless for programming help

**Tool Usage:**
- Never run non-trivial bash commands without explaining what/why
- Create todos for multi-step tasks (3+ steps)
- Never commit unless explicitly asked
- Run lint/typecheck after code changes
- Minimize output tokens while maintaining helpfulness

**Code Style:**
- Do NOT add comments unless asked
- Follow existing codebase conventions
- Never assume libraries are available — check first
- Follow security best practices (never log secrets/keys)

### 14.2 Superpowers Skill Rules (Plugin)

**Skill Invocation (MANDATORY):**
- Invoke relevant skills BEFORE any response or action — including clarifying questions
- If you think there's even a 1% chance a skill applies, you MUST invoke it
- This is not negotiable. You cannot rationalize your way out of it.
- Announce "Using [skill] to [purpose]" and follow the skill exactly
- If a skill has a checklist, create a todo per item

**Skill Priority:**
- Process skills come first (brainstorming, systematic-debugging), then implementation skills
- "Let's build X" → brainstorming first, then implementation
- "Fix this bug" → systematic-debugging first, then domain skills

**User Instructions Override Everything:**
- User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, direct requests) take precedence over skills
- Skills override default behavior
- Only skip skill workflows when the human partner explicitly tells you to

**Rationalization Red Flags — STOP if you think:**
- "This is just a simple question" — Questions are tasks. Check for skills.
- "I need more context first" — Skill check comes BEFORE clarifying questions.
- "Let me explore the codebase first" — Skills tell you HOW to explore.
- "This doesn't need a formal skill" — If a skill exists, use it.
- "The skill is overkill" — Simple things become complex. Use it.
- "I'll just do this one thing first" — Check BEFORE doing anything.

### 14.3 Systematic Debugging Rules

**Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

**Four Phases (mandatory, in order):**
1. **Root Cause Investigation** — Read errors, reproduce, check changes, gather evidence
2. **Pattern Analysis** — Find working examples, compare against references, identify differences
3. **Hypothesis and Testing** — Form single hypothesis, test minimally, verify before continuing
4. **Implementation** — Create failing test, implement single fix, verify

**Red Flags — Return to Phase 1:**
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- "One more fix attempt" (after 2+ failures)
- Proposing solutions before tracing data flow

**If 3+ fixes failed:** STOP. Question the architecture. Discuss with human partner.

### 14.4 Test-Driven Development Rules

**Iron Law:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

**Red-Green-Refactor (mandatory cycle):**
1. **RED** — Write one minimal failing test
2. **Verify RED** — Watch it fail (MANDATORY, never skip)
3. **GREEN** — Write minimal code to pass
4. **Verify GREEN** — Watch it pass (MANDATORY)
5. **REFACTOR** — Clean up while keeping tests green

**Code before test?** Delete it. Start over. No exceptions:
- Don't keep as "reference"
- Don't "adapt" while writing tests
- Don't look at it. Delete means delete.

**Good Tests:**
- One behavior per test
- Clear name describing behavior
- Real code (mocks only if unavoidable)

### 14.5 Verification Before Completion Rules

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

**Gate Function (before ANY success claim):**
1. IDENTIFY what command proves the claim
2. RUN the FULL command (fresh, complete)
3. READ full output, check exit code, count failures
4. VERIFY output confirms the claim
5. ONLY THEN make the claim

**Never use:** "should", "probably", "seems to"
**Never claim success without running verification in this message**

### 14.6 Writing Plans Rules

**When to Use:** When you have a spec/requirements for a multi-step task, BEFORE touching code

**Requirements:**
- Save plans to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- Every plan must start with the required header (Goal, Architecture, Tech Stack, Global Constraints)
- Each step is one action (2-5 minutes)
- No placeholders (TBD, TODO, "implement later", "similar to Task N")
- Every step must contain actual content an engineer needs

**Task Structure:**
- Files: Create/Modify/Test paths
- Interfaces: Consumes/Produces signatures
- Steps with actual code blocks, run commands, expected outputs

### 14.7 Subagent-Driven Development Rules

**Core Process:**
- Fresh subagent per task (no context pollution)
- Task review (spec + quality) after each task
- Broad whole-branch review at the end
- Continuous execution — don't pause to check in between tasks
- Only stop for: BLOCKED status, genuine ambiguity, or all tasks complete

### 14.8 Contributor Rules (Superpowers Repo)

If contributing to the superpowers repo itself:
- 94% PR rejection rate — read guidelines first
- Must read PR template and fill every section
- Must search for existing PRs (open AND closed)
- Must verify this is a real problem (not theoretical)
- Must identify model, harness, version, and plugins in PR
- Must show human partner complete diff before submission
- All PRs must target `dev` branch, not `main`
- No third-party dependencies, no bulk PRs, no fabricated content
