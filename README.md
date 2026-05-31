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
- **World wiki search and RAG** - Pull relevant live wiki/search context for the active world, optionally combine it with local vector memory, and keep large experimental universe stores separate from the stable app package.
- **Character presets** — Save reusable characters (stats, appearance, personality, gear) and load them into any new campaign.
- **AI-generated portraits** — Character and scene artwork generated on demand from detailed, editable prompts.
- **Live game state** — Health, Money, Hunger, Thirst, and Energy are tracked every turn and surfaced in the sidebar.
- **Automatic Game Codex** — An NPC Ledger and Location Ledger populate themselves as your story unfolds, giving you a durable reference for every person and place you encounter.
- **Text-only CLI and Telegram bot** - Play Odyssey without images through an ASCII terminal UI or a BotFather-created Telegram bot backed by the same local saves.
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

1. **World wiki search** - During setup and play, Odyssey can look up relevant world context from Wikipedia-style and Fandom/MediaWiki sources. Built-in and custom worlds can carry wiki metadata, and the retrieved passages are used as live context for the current turn when the related search/RAG settings are enabled.
2. **Vector RAG stores** - Odyssey can index local game memory and curated universe knowledge into vector stores. These stores are opt-in from **Settings &rarr; RAG** and require a configured embedding provider before retrieval context is injected into turns.

The Harry Potter universe vector store is intentionally separate from the v0.6.0 stable app package. It was validated as an alpha/prerelease vector-store artifact, but it is large and experimental, so the stable release keeps the generator/publisher workflow without bundling that store into the installer.

For maintainers, generation happens in the ignored `.rag-vector-generation/` workspace and curated stores are published intentionally into `public/jsons/universe-vector-stores/`.

---

## Terminal and Telegram Play

Odyssey also ships with a text-only Node runtime for terminal and Telegram play. These modes use the same save folder as the Tauri desktop app:

```bash
npm run odyssey:cli
```

The CLI is arrow-key navigable for loading games, creating new campaigns, going back or editing the last turn, and opening the Player Menu, Game Codex, and stats views. It does not generate or display images. Preset loading still walks through the normal setup questions with preset answers filled in, so every field can be kept or changed. It also reads the desktop app's local WebView settings by default, so the terminal and Telegram runtimes can reuse your existing Odyssey provider, model, API key, token limits, reasoning setting, and game prompt. Explicit CLI settings and `ODYSSEY_*` environment variables override the desktop settings.

To run Odyssey through Telegram:

1. Message [BotFather](https://core.telegram.org/bots/features#botfather) in Telegram and create a bot.
2. Open Odyssey, go to **Settings -> Telegram**, paste the bot token, and save.
3. Keep private pairing enabled unless you intentionally want a public bot. Odyssey generates a local four-word pairing phrase from the standard 2048-word BIP-39 English list.
4. Run setup once so Telegram updates the bot command menu:

```powershell
npm run odyssey:telegram -- --setup
```

5. Start long polling and leave the runner open while playing:

```powershell
npm run odyssey:telegram
```

6. In Telegram, open your bot, send `/start`, tap **Verify account** or send `/verify`, then reply with the pairing words shown in **Settings -> Telegram**.

The bot token, pairing phrase, optional allowed Telegram IDs, and optional Mini App URL are stored locally in Odyssey app data as `telegram-settings.json`. The runner also loads `.env.local` and `.env` from the repo root, so power users can still override settings with environment variables:

```env
TELEGRAM_BOT_TOKEN=123456:your-token
ODYSSEY_TELEGRAM_PAIRING_PHRASE=lamp tiger shoelace hairpin
ODYSSEY_TELEGRAM_AUTH_ENABLED=true
```

Optional explicit allow list:

```powershell
$env:ODYSSEY_TELEGRAM_ALLOWED_USERS="123456789"
```

Telegram commands include `/verify`, `/load`, `/new`, `/back`, `/edit`, `/history`, `/player`, `/codex`, `/stats`, `/settings`, `/menu`, and `/cancel`. After a verified account loads a game, normal chat messages are treated as player actions. New turns create local rewind snapshots, so `/back` restores the previous game state and `/edit` rewinds then regenerates from your replacement action.

The Telegram bot uses Telegram's native rich surfaces where the platform allows them: emoji labels, HTML-formatted narration and status cards, styled inline buttons, quick action callbacks, force-reply setup prompts, message reactions, and an optional Mini App button. Telegram bot messages do not support arbitrary CSS-like text colors inside normal chat text; the practical color options are styled buttons, emoji/status symbols, custom emoji, media, and Mini Apps.

Optional Mini App button:

```env
ODYSSEY_TELEGRAM_WEB_APP_URL=https://your-hosted-odyssey-mini-app.example
```

Mini Apps must be served over HTTPS. If that variable is set, `/setup` registers an "Open Odyssey" Telegram menu button and the bot adds an inline app button to its menus.

---

## How It Works

Odyssey is a client-side adventure engine wrapped in a native Tauri shell.

1. **Setup** — You pick a universe, define a character, write a starting scenario, and generate a portrait.
2. **Turn loop** — Each turn, Odyssey assembles a contextual prompt from your current state (stats, inventory, recent narration, codex entries, optional live wiki/search passages, and optional vector-RAG results) and sends it to your configured model.
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
│   ├── creation.js     New game setup, world presets, launch flow
│   ├── chat.js         AI prompting, in-game chat, image runtime, TTS
│   ├── saves.js        Autosaves and chat history persistence
│   ├── theme.js        Theme definitions
│   ├── ui-components.js Custom inputs and interactive elements
│   ├── tauri-bridge.js Native FS operations (presets, saves, games)
│   ├── titlebar.js     Custom window titlebar
│   ├── menu-music.js   Main menu audio
│   ├── models.json     Built-in model metadata
│   ├── openrouter-attribution.js OpenRouter app attribution headers
│   ├── style.css       Global design system
│   ├── assets/         Images, audio, fonts
│   └── jsons/          Built-in templates, pairing words, and universe stores
├── tools/              Text-only CLI, Telegram bot, and shared Node runtime
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
