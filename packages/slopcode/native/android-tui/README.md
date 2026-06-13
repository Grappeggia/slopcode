# SlopCode Android TUI

This crate is the Rust-native Android TUI entrypoint for Termux.

The release binary is a Cargo-managed `ratatui`/`crossterm` application. It talks to the SlopCode daemon over the existing HTTP/SSE APIs, renders the interactive terminal UI directly in Rust, and uses Termux command integrations only when they are available.

Compatibility requirements:

- `bin/slopcode` remains the Android package entrypoint.
- `bin/slopcode-android-host` remains as an alias for existing probes, tests, and manual installs.
- `slopcode doctor android --json` must keep reporting enough fields for installer and E2E diagnostics.
- Android does not use OpenTUI or Bun FFI for interactive rendering.
