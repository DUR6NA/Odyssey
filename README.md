# Odyssey

> A native desktop Tauri application — AI-driven text adventure engine. Build worlds, create characters, and shape your own story with any AI model you choose.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

## Features
- Dynamic AI Storytelling with any OpenAI-compatible API (direct calls, no server needed)
- Multi-phase game setup wizard
- Built-in universe presets (Harry Potter, Star Wars, LOTR, Narnia, Game of Thrones)
- Persistent character presets and game saves
- AI image generation, RAG wiki integration, and rich visual theming
- **Fully native desktop app** built with Tauri (lightweight, secure, cross-platform)

## Quick Start

```bash
git clone https://github.com/DUR6NA/Odyssey.git
cd Odyssey

# Install dependencies
npm install

# Run in development
npm run dev

# Build native installers
npm run build
```

The built app is a standalone desktop application — no browser or Node server required.

## Prerequisites
- Rust (stable toolchain)
- Node.js (for the Tauri CLI only)
- System webview (WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux)

## Project Structure
- `src-tauri/` — Rust backend with Tauri plugins (fs, dialog, shell)
- `public/` — Clean frontend (HTML, JS, CSS, assets, presets)
- `assets/` — Images and audio (main menu music)
- `tauri-bridge.js` — Handles all file operations (presets, games, saves) using native FS

**Note**: This is the Tauri-only branch. The original Node.js server has been completely removed and replaced with native Tauri APIs.

## Recent Fixes
- Main menu music now plays reliably
- AI API connections (including xAI) use direct endpoints (no more 500 errors)
- Installer uses Odyssey icons, name, and dark theme with white accents
- All local file operations migrated to Tauri FS bridge

## Building Installers
- **Windows**: `.exe` / `.msi` with custom icon
- **macOS**: `.dmg` 
- **Linux**: `.deb` / AppImage

Run `npm run build` on each platform for the best native experience, or use GitHub Actions for cross-compilation.

---

**This is a fully migrated Tauri desktop application.**
All old Node.js and server code has been removed.
