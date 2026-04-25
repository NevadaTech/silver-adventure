# Skill Registry — silver-adventure

Generated: 2026-04-24

## User Skills

| Name           | Trigger                                                                                                         | Compact Rules                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| branch-pr      | Creating a PR, opening a PR, preparing changes for review                                                       | Every PR must link an approved issue. Every PR must have exactly one `type:*` label. Automated checks must pass before merge. No blank PRs.                                             |
| issue-creation | Creating a GitHub issue, reporting a bug, requesting a feature                                                  | Use templates (bug or feature request) only. Issues get `status:needs-review` automatically. Maintainer must add `status:approved` before PR. No questions as issues — use Discussions. |
| judgment-day   | "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" | Launch two independent blind judge sub-agents in parallel. Synthesize findings. Apply fixes. Re-judge until both pass or escalate after 2 iterations.                                   |
| skill-creator  | Creating a new skill, adding agent instructions, documenting patterns for AI                                    | Follow Agent Skills spec. Include frontmatter with name, description, trigger. Structure with When/Rules/Workflow sections.                                                             |
| go-testing     | Writing Go tests, using teatest, adding test coverage                                                           | Follow Go testing patterns for Gentleman.Dots. Use teatest for Bubbletea TUI.                                                                                                           |

## Project Conventions

### Convention Files

- `AGENTS.md` — Next.js v16 breaking changes warning; always read `node_modules/next/dist/docs/` before writing code
- `CLAUDE.md` — references AGENTS.md

### Compact Rules (from AGENTS.md)

> **This is NOT the Next.js you know.** Next.js v16 has breaking changes — APIs, conventions, and file structure may differ from training data. ALWAYS read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.

## Code Context Map

| File Pattern    | Relevant Skills                                  |
| --------------- | ------------------------------------------------ |
| `*.ts`, `*.tsx` | (AGENTS.md conventions apply)                    |
| `src/app/**`    | Next.js App Router conventions — read docs first |
| `*.go`          | go-testing                                       |
| PR/branch work  | branch-pr                                        |
| GitHub issues   | issue-creation                                   |
| Code review     | judgment-day                                     |
