# SlopCode

[![npm version](https://img.shields.io/npm/v/slopcode?style=flat-square)](https://www.npmjs.com/package/slopcode)
[![npm downloads](https://img.shields.io/npm/dm/slopcode?style=flat-square)](https://www.npmjs.com/package/slopcode)

SlopCode is the open source AI slopcoding agent focused on terminal workflows.

## Install

```bash
npm i -g slopcode@latest
```

### Termux on Android

```bash
pkg update
pkg install nodejs git ripgrep neovim tar
npm i -g slopcode@latest --include=optional
```

The Android package includes the Rust-native sidecar TUI runtime for Termux arm64/x64 and does not bundle Bun. It opens on the SlopCode home prompt when pointed at a daemon with `--url`/`--token`; run `slopcode doctor android` to verify the Rust runtime.

## Quickstart

```bash
slopcode
```

Use `Tab` to switch agents, then ask for code changes, debugging, or repo exploration directly from your terminal.

## Features

- Terminal-first AI coding workflow
- Built-in planning and execution agents
- Works with multiple model providers
- Local session history and resumable conversations
- Open source with transparent release channels

## Release Channels

```bash
# Stable
npm i -g slopcode@latest

# Pre-release streams
npm i -g slopcode@dev
npm i -g slopcode@beta
```

## Links

- Docs: https://slopcode.dev/docs
- Download desktop app: https://slopcode.dev/download
- GitHub: https://github.com/teamslop/slopcode
- Report issues: https://github.com/teamslop/slopcode/issues
