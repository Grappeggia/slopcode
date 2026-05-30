# SlopCode Android TUI

This crate is the Rust-native Android TUI entrypoint for Termux.

The first cut includes the existing Android host implementation so release artifacts keep their current behavior while the renderer moves to a Cargo-managed Rust codebase. New Android TUI work should land in this crate, with `ratatui` and `crossterm` as the target rendering and terminal backend.

Compatibility requirements:

- `bin/slopcode` remains the Android package entrypoint.
- `bin/slopcode-android-host` remains as an alias for existing probes, tests, and manual installs.
- `slopcode doctor android --json` must keep reporting enough fields for installer and E2E diagnostics.
