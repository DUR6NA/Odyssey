# Odyssey

> A native desktop AI-driven text adventure engine. Choose a universe, craft a character, and shape your own story with any AI model you connect.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#download)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-24C8DB.svg)](https://tauri.app)
[![Latest Release](https://img.shields.io/github/v/release/DUR6NA/Odyssey?label=latest%20release)](https://github.com/DUR6NA/Odyssey/releases/latest)

![Odyssey gameplay](readme%20images/in%20game.png)

---

## Table of Contents
- [Download](#download)
- [Features](#features)
- [Screenshots](#screenshots)
- [Themes](#themes)
- [How It Works](#how-it-works)
- [Connecting an AI Model](#connecting-an-ai-model)
- [Building from Source](#building-from-source)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Download

**The recommended way to install Odyssey is through GitHub Releases.** Prebuilt installers are available for Windows, macOS, and Linux, and are signed artifacts produced by the project's GitHub Actions workflow.

### [Download the latest release &rarr;](https://github.com/DUR6NA/Odyssey/releases/latest)

| Platform | Installer |
| --- | --- |
| Windows | `Odyssey_x.y.z_x64-setup.exe` or `Odyssey_x.y.z_x64_en-US.msi` |
| macOS   | `Odyssey_x.y.z_aarch64.dmg` / `Odyssey_x.y.z_x64.dmg` |
| Linux   | `odyssey_x.y.z_amd64.deb` or `odyssey_x.y.z_amd64.AppImage` |

After installing, launch Odyssey and follow the in-app welcome screen to configure an AI provider.

---

## Features

- **Universal AI backend** — Works with any OpenAI-compatible API: OpenAI, Google Gemini (via compatibility endpoint), xAI, OpenRouter, Ollama, LM Studio, or any self-hosted endpoint. Requests go directly from the app to the provider; nothing is routed through a middleman.
- **Guided setup wizard** — A five-step flow (World &rarr; Player &rarr; Scenario &rarr; Player Image &rarr; Summary) gets you into a new campaign in minutes.
- **Real or custom universes** — Start your adventure in the real world with any date you choose, or choose from a list of pre-made universes.
- **Character presets** — Save reusable characters (stats, appearance, personality, gear) and load them into any new campaign.
- **AI-generated portraits** — Character and scene artwork generated on demand from detailed, editable prompts.
- **Live game state** — Health, Money, Hunger, Thirst, and Energy are tracked every turn and surfaced in the sidebar.
- **Automatic Game Codex** — An NPC Ledger and Location Ledger populate themselves as your story unfolds, giving you a durable reference for every person and place you encounter.
- **Multiple themes** — Dark Mode, Light Mode, Frutiger Aero, Starry Night, and Matrix, plus configurable typography and accessibility options.
- **Save management** — Named saves, plus one-click Import and Export for sharing or backing up campaigns.
- **Native desktop app** — Built on Tauri. Small footprint, fast startup, and no web server or browser required.

---

## Screenshots

### World selection

The campaign begins with a choice between a grounded real-world setting and a fully custom universe.

![Choose Your World](readme%20images/world%20select.png)

### Start date

When playing in the real universe, you can pick any calendar date. The dice roll a random one for you.

![Start date picker](readme%20images/start%20date.png)

### Starting scenario

Describe the opening moment of the story — where the character is, what's happening, and how the adventure kicks off.

![Starting Situation](readme%20images/starting%20scenario.png)

### Character preset picker

Load a previously saved character into the new campaign in a single click, or skip this step to build one from scratch.

![Select a Character Preset](readme%20images/choose%20preset.png)

### AI-generated character portrait

During setup, Odyssey drafts a detailed prompt from your character sheet and generates a portrait. You can regenerate, edit the prompt, or confirm.

![Your Character Image](readme%20images/player%20image.png)

### In-game view

The main play surface: narration on the center, live stats and portrait on the left, in-world clock and the Game Codex on the right.

![In-game view](readme%20images/in%20game.png)

### Player menu & inventory

A full character sheet with identity, physical attributes, appearance, personality, and a live inventory grid.

![Player Menu and Inventory](readme%20images/player%20menu%20and%20inventory.png)

### Game Codex

Every NPC and location the story mentions is recorded automatically in the codex so you can recall context later.

![Game Codex](readme%20images/world%20codex.png)

### Character presets

Build, edit, and manage reusable characters. AI-assisted "Auto" and "Assist" buttons can fill in fields based on what you've already written.

![Character Presets list](readme%20images/presets%20tab.png)

![Character Preset editor](readme%20images/preset%20creator.png)

### Save management

Name, load, export, import, and delete saves from a single screen.

![Select Save](readme%20images/load%20game%2C%20import%20and%20export.png)

### In-app Info & Wiki

A tutorial and reference built into the app, covering how to get an API key, set up providers, and use every major system.

![Info & Wiki](readme%20images/wiki%20page.png)

---

## Themes

Odyssey ships with five visual themes selectable from **Settings &rarr; Appearance**, alongside typography and accessibility options.

![Theme Settings](readme%20images/theme%20settings.png)

A short demo of switching between themes live:

<video src="https://github.com/DUR6NA/Odyssey/raw/main/readme%20images/theme%20demo%20video.webm" controls muted width="700"></video>

---

## How It Works

Odyssey is a client-side adventure engine wrapped in a native Tauri shell.

1. **Setup** — You pick a universe, define a character, write a starting scenario, and generate a portrait.
2. **Turn loop** — Each turn, Odyssey assembles a contextual prompt from your current state (stats, inventory, recent narration, codex entries, and — for built-in universes — retrieved Fandom wiki passages) and sends it to your configured model.
3. **Structured response** — The model's reply is parsed into narration, state updates, codex additions, and optional image-generation prompts.
4. **Persistence** — Saves, presets, and settings live on disk via Tauri's native FS plugin. Your API key stays on your machine.

---

## Connecting an AI Model

After launching Odyssey:

1. Open **Settings &rarr; API Settings**.
2. Choose a provider or select a custom OpenAI-compatible endpoint.
3. Paste your API key and (if needed) the base URL — for example, `http://localhost:11434/v1` for a local Ollama instance.
4. Pick a model from the list and save.

The in-app **Info & Wiki** contains a step-by-step guide for obtaining a free Google AI Studio key if you're new to this.

API keys are stored locally and are only transmitted directly to the provider you configured.

---

## Building from Source

Building from source is primarily for contributors; most users should [download a release](#download) instead.

### Prerequisites

- **Rust** (stable toolchain) — [install via rustup](https://rustup.rs/)
- **Node.js 18+** — required for the Tauri CLI
- **System webview**
  - Windows: WebView2 (preinstalled on Windows 11; auto-installed on Windows 10)
  - macOS: WKWebView (preinstalled)
  - Linux: WebKitGTK (`libwebkit2gtk-4.1-dev`)

Platform-specific details live in the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

### Build

```bash
git clone https://github.com/DUR6NA/Odyssey.git
cd Odyssey

# Install dependencies
npm install

# Run in development (launches the native window with hot reload)
npm run dev

# Produce platform installers
npm run build
```

Installers are written to `src-tauri/target/release/bundle/`.

---

## Project Structure

```
Odyssey/
├── src-tauri/          Rust backend (Tauri 2.x with fs, dialog, shell plugins)
│   ├── src/            Rust entry point
│   ├── icons/          App icons for all platforms
│   └── tauri.conf.json Tauri configuration
├── public/             Frontend application
│   ├── Welcome.html    First-run welcome screen
│   ├── mainmenu.html   Main menu
│   ├── game.html       In-game view
│   ├── presets.html    Character preset management
│   ├── settings.html   Provider, appearance, and prompt settings
│   ├── infowiki.html   In-app Info & Wiki
│   ├── setup.js        Core game logic, world presets, AI orchestration
│   ├── theme.js        Theme definitions
│   ├── ui-components.js Custom inputs and interactive elements
│   ├── tauri-bridge.js Native FS operations (presets, saves, games)
│   ├── titlebar.js     Custom window titlebar
│   ├── menu-music.js   Main menu audio
│   ├── models.json     Built-in model metadata
│   ├── style.css       Global design system
│   ├── assets/         Images, audio, fonts
│   └── jsons/          Built-in templates (player, world, NPC ledger, etc.)
├── readme images/      Assets for this document
├── devdocs.html        Developer documentation
├── CONTRIBUTING.md     Contribution guide
└── package.json
```

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for project architecture, code conventions, the pull request workflow, and how to add new themes or world presets. `devdocs.html` contains extended developer documentation and can be opened directly in a browser or from the repository.

---

## License

Odyssey is licensed under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE) for the full text.
