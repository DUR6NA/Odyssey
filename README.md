# Odyssey

> An AI-driven text adventure engine for desktop, terminal, and Telegram. Choose a universe, craft a character, and shape your own story with any AI model you connect.

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
- [Voice Narration (TTS)](#voice-narration-tts)
- [Retrieval and World Knowledge](#retrieval-and-world-knowledge)
- [Terminal and Telegram Play](#terminal-and-telegram-play)
- [How It Works](#how-it-works)
- [Connecting an AI Model](#connecting-an-ai-model)
- [Building from Source](#building-from-source)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Download

**The recommended way to install Odyssey is through GitHub Releases.** Prebuilt installers are available for Windows, macOS, and Linux.

### [Download the latest release &rarr;](https://github.com/DUR6NA/Odyssey/releases/latest)

| Platform | Installer |
| --- | --- |
| Windows | `Odyssey_x.y.z_x64-setup.exe` or `Odyssey_x.y.z_x64_en-US.msi` |
| macOS   | `Odyssey_x.y.z_aarch64.dmg` / `Odyssey_x.y.z_x64.dmg` |
| Linux   | `odyssey_x.y.z_amd64.deb` or `odyssey_x.y.z_amd64.AppImage` |

After installing, launch Odyssey and follow the in-app welcome screen to configure an AI provider. Text-only play is also available via the [terminal CLI and Telegram bot](#terminal-and-telegram-play).

---

## Features

- **Universal AI backend** — Works with any OpenAI-compatible API: OpenAI, Google Gemini (via compatibility endpoint), xAI, OpenRouter, Ollama, LM Studio, or any self-hosted endpoint. Requests go directly from the app to the provider; nothing is routed through a middleman.
- **Guided setup wizard** — A five-step flow (World &rarr; Player &rarr; Scenario &rarr; Player Image &rarr; Summary) gets you into a new campaign in minutes.
- **Real or custom universes** — Start your adventure in the real world with any date you choose, or choose from a list of pre-made universes.
- **World wiki search and RAG** — Pull relevant live wiki/search context for the active world, and optionally combine it with local game-memory vector RAG.
- **Character presets** — Save reusable characters (stats, appearance, personality, gear) and load them into any new campaign.
- **AI-generated portraits** — Character and scene artwork generated on demand from detailed, editable prompts.
- **Live game state** — Health, Money, Hunger, Thirst, and Energy are tracked every turn and surfaced in the sidebar.
- **Automatic Game Codex** — An NPC Ledger and Location Ledger populate themselves as your story unfolds, giving you a durable reference for every person and place you encounter.
- **Text-only CLI and Telegram bot** — Play Odyssey without images through an ASCII terminal UI (`npm run odyssey:cli`) or a BotFather-created Telegram bot (`npm run odyssey:telegram` / **Settings → Telegram → Start Bot**). Both share the desktop app’s local saves and provider settings.
- **Multiple themes** — Dark Mode, Light Mode, Frutiger Aero, Starry Night, and Matrix, plus configurable typography and accessibility options.
- **Voice narration (TTS)** — Listen to every turn of narration. Plug in any of four providers — a self-hosted [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) server, OpenAI, Google Cloud TTS, or xAI Grok — with a shared control for playback speed (0.5x–2.0x) and per-provider voice selection. Kokoro additionally supports **weighted voice blending**, letting you mix multiple voices into a single custom narrator.
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

### Character preset picker

Load a previously saved character into the new campaign in a single click, or skip this step to build one from scratch.

![Select a Character Preset](readme%20images/choose%20preset.png)

### Starting scenario

Describe the opening moment of the story — where the character is, what's happening, and how the adventure kicks off.

![Starting Situation](readme%20images/starting%20scenario.png)

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

[![Watch the theme demo on YouTube](https://img.youtube.com/vi/NH4qloYArQw/maxresdefault.jpg)](https://youtu.be/NH4qloYArQw)

---

## Voice Narration (TTS)

Odyssey can read every turn of narration aloud through a dedicated **Settings &rarr; Voice / TTS** panel. Pick a provider, paste credentials if needed, choose a voice, and the in-game play button will stream audio for the current turn.

### Supported providers

| Provider | Type | Notes |
| --- | --- | --- |
| **Kokoro-FastAPI** | Self-hosted, free | Point Odyssey at a local [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) server (default `http://127.0.0.1:8880`). The available voice list is fetched live from the server. |
| **OpenAI (or compatible)** | Cloud | Works with OpenAI's `tts-1` / `tts-1-hd` and any OpenAI-compatible audio endpoint. Configurable base URL, API key, model, and voice. |
| **Google Cloud TTS** | Cloud | Uses Google's `texttospeech.googleapis.com/v1/text:synthesize` with a selectable Neural2 voice. |
| **xAI Grok TTS** | Cloud | Choose a Grok voice and language (or auto-detect). |

### Voice blending (Kokoro)

The Kokoro provider includes a **voice mixer**: add multiple voices, drag weights, and Odyssey builds a blended voice string (e.g. `af_bella(70)+am_adam(30)`) using Kokoro-FastAPI's blend format. Weights are normalized automatically and visualized as a colored bar so you can fine-tune the mix at a glance.

### Playback

- Adjustable playback speed from **0.5x to 2.0x** (except xAI, which does not support variable speed).
- Clean-text extraction strips UI markup before sending audio requests.
- All credentials are stored locally; audio is requested directly from the provider you configured.

---

## Retrieval and World Knowledge

Odyssey has two separate knowledge paths:

1. **World wiki search** — During setup and play, Odyssey can look up relevant world context from Wikipedia-style and Fandom/MediaWiki sources. Built-in and custom worlds can carry wiki metadata, and the retrieved passages are used as live context for the current turn when the related search/RAG settings are enabled.
2. **Game-memory vector RAG** — Odyssey can index local game memory into a per-save vector store. This is opt-in from **Settings &rarr; RAG** and requires a configured embedding provider before retrieval context is injected into turns.

Premade universe vector stores (for example older Harry Potter packs) are effectively deprecated and not recommended to download or use.

---

## Terminal and Telegram Play

Odyssey ships with a text-only Node runtime shared by the terminal CLI and Telegram bot. Both use the same Odyssey app-data folder as the Tauri desktop app (saves, presets, and provider settings).

### Terminal CLI

```bash
# From a clone (after npm install)
npm run odyssey:cli
```

The CLI is arrow-key navigable for Continue / Load / New Game, going back or editing the last turn, and opening the Player Menu, Game Codex, and stats views. It does not generate or display images. Preset loading still walks through the normal setup questions with preset answers filled in, so every field can be kept or changed.

Provider settings default to the desktop app’s local WebView storage (provider, model, API key, token limits, reasoning, game prompt, and retrieval flags). Values you save from the CLI live in `cli-settings.json` under the Odyssey data folder and override desktop defaults for CLI/Telegram only — they do not rewrite the desktop WebView settings. `ODYSSEY_*` environment variables override both.

### Telegram bot

**From the desktop app (recommended):**

1. Message [BotFather](https://core.telegram.org/bots/features#botfather) in Telegram and create a bot.
2. Open Odyssey → **Settings → Telegram**, paste the bot token, keep private pairing on, generate pairing words, and **Save**.
3. Press **Start Bot** and wait until status shows **Running** (requires **Node.js 18+** on your PATH; the bot scripts are bundled with the app installer).
4. Open your bot in Telegram, send `/start`, and follow the verify prompts using the pairing words from Settings.

**From a clone / terminal:**

```bash
npm run odyssey:telegram
# Windows convenience launcher:
# OdysseyTelegram.bat
```

**Reset / security:** **Reset Verified Users** clears paired accounts immediately for the running bot (no restart). Saving new pairing words also revokes previous verifications. Optional **Allowed Telegram IDs** are separate and are not cleared by Reset. Private pairing is on by default; turn it off only if you intentionally want an open bot.

**Saves:** Prefer one writer at a time. Simultaneous desktop play and Telegram/CLI turns on the **same** save can conflict; use separate saves or pause one client.

Telegram settings are stored in Odyssey app data as `telegram-settings.json`. Env overrides include `TELEGRAM_BOT_TOKEN` / `ODYSSEY_TELEGRAM_BOT_TOKEN`, `ODYSSEY_TELEGRAM_PAIRING_PHRASE`, and related `ODYSSEY_*` flags.

Telegram commands include `/verify`, `/load`, `/new`, `/back`, `/edit`, `/history`, `/player`, `/codex`, `/stats`, `/settings`, `/menu`, and `/cancel`. After a verified account loads a game, normal chat messages are treated as player actions. New turns create local rewind snapshots, so `/back` restores the previous game state and `/edit` rewinds then regenerates from your replacement action.

### Retrieval in terminal / Telegram

When Vector RAG, web/wiki, Fandom, or Brave search are enabled in the desktop app, the Node runtimes use the same flags. Game-memory vector RAG embeds and searches the per-save `vector_store.json` via your embedding API (shared with the desktop app). Live Wikipedia, world-wiki/Fandom MediaWiki search, and Brave Search run over HTTP when enabled.

### Telegram UI and optional Mini App

The bot uses Telegram’s native surfaces where available: emoji labels, HTML-formatted narration and status cards, styled inline buttons, quick action callbacks, force-reply setup prompts, message reactions, and an optional Mini App button. Normal chat text does not support arbitrary CSS-like colors.

Optional Mini App button:

```env
ODYSSEY_TELEGRAM_WEB_APP_URL=https://your-hosted-odyssey-mini-app.example
```

Mini Apps must be served over HTTPS. If that variable is set, `/setup` registers an “Open Odyssey” Telegram menu button and the bot adds an inline app button to its menus.

---

## How It Works

Odyssey is a client-side adventure engine. The desktop UI is a Tauri shell around the same save format and AI turn loop used by the text-only CLI and Telegram bot.

1. **Setup** — You pick a universe, define a character, write a starting scenario, and (on desktop) generate a portrait.
2. **Turn loop** — Each turn, Odyssey assembles a contextual prompt from your current state (stats, inventory, recent narration, codex entries, optional live wiki/search passages, and optional vector-RAG results) and sends it to your configured model.
3. **Structured response** — The model's reply is parsed into narration, state updates, codex additions, and optional image-generation prompts (desktop only).
4. **Persistence** — Saves, presets, and settings live on disk in the Odyssey app-data folder (via Tauri’s FS plugin on desktop, or the shared Node core for CLI/Telegram). Your API key stays on your machine.

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

- **Rust** (stable toolchain) — [install via rustup](https://rustup.rs/) — required for the desktop app
- **Node.js 18+** — required for the Tauri CLI, text CLI, and Telegram bot
- **System webview** (desktop only)
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

# Run the desktop app in development
npm run dev

# Produce platform installers (desktop)
npm run build

# Text-only runtimes (no Rust build required)
npm run odyssey:cli
npm run odyssey:telegram
```

Installers are written to `src-tauri/target/release/bundle/`.

---

## Project Structure

```
Odyssey/
├── src-tauri/          Rust backend (Tauri 2.x with fs, dialog, shell plugins)
│   ├── src/
│   │   ├── lib.rs      App setup, invoke handlers
│   │   ├── audio.rs    Menu music
│   │   └── telegram_runner.rs  Managed Node process for the in-app Telegram bot
│   ├── icons/          App icons for all platforms
│   └── tauri.conf.json Tauri configuration
├── public/             Frontend application
│   ├── Welcome.html    First-run welcome screen
│   ├── mainmenu.html   Main menu
│   ├── game.html       In-game view
│   ├── presets.html    Character preset management
│   ├── settings.html   Provider, appearance, Telegram, and prompt settings
│   ├── infowiki.html   In-app Info & Wiki
│   ├── creation.js     New game setup, world presets, launch flow
│   ├── chat.js         AI prompting, in-game chat, image runtime, TTS
│   ├── saves.js        Autosaves and chat history persistence
│   ├── theme.js        Theme definitions
│   ├── ui-components.js Custom inputs and interactive elements
│   ├── tauri-bridge.js Native FS + Telegram bot control commands
│   ├── titlebar.js     Custom window titlebar
│   ├── menu-music.js   Main menu audio
│   ├── models.json     Built-in model metadata
│   ├── openrouter-attribution.js OpenRouter app attribution headers
│   ├── style.css       Global design system
│   ├── assets/         Images, audio, fonts
│   └── jsons/          Built-in templates and pairing words
├── tools/
│   ├── odyssey-cli.mjs           Terminal ASCII client
│   ├── odyssey-telegram-bot.mjs  Telegram long-polling bot
│   ├── odyssey-core.mjs          Shared saves, turns, settings
│   └── odyssey-retrieval.mjs     Shared wiki/RAG helpers for text runtimes
├── readme images/      Assets for this document
├── devdocs.html        Developer documentation
├── CONTRIBUTING.md     Contribution guide
├── OdysseyTelegram.bat Convenience launcher for the Telegram bot
└── package.json
```

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for project architecture, code conventions, the pull request workflow, and how to add new themes or world presets. `devdocs.html` contains extended developer documentation and can be opened directly in a browser or from the repository.

---

## License

Odyssey is licensed under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE) for the full text.
