@AGENTS.md

## Claude Code

- One task per session.
- When a task is finished, delegate to the `verifier` subagent (`.claude/agents/verifier.md`) and paste its report. Do not call a task done without its `VERDICT: PASS`.
