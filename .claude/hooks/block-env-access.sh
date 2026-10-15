#!/usr/bin/env bash
# PreToolUse hook: blocks shell commands that reference a .env secrets file.
# .env.example stays allowed. Exit code 2 blocks the call and shows stderr to Claude.
cmd=$(jq -r '.tool_input.command // empty')
if printf '%s' "$cmd" | grep -qE '(^|[^A-Za-z0-9_])\.env($|[^A-Za-z0-9_.]|\.(local|development|production|test)([^A-Za-z0-9_]|$))'; then
  echo "Blocked: this project forbids reading .env files (secrets). Use .env.example for the variable names." >&2
  exit 2
fi
exit 0
