//! Managed Odyssey Telegram bot child process (Node runner).

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct TelegramBotProcess {
  pub child: Mutex<Option<Child>>,
  pub last_error: Mutex<Option<String>>,
  pub started_at: Mutex<Option<String>>,
}

impl Default for TelegramBotProcess {
  fn default() -> Self {
    Self {
      child: Mutex::new(None),
      last_error: Mutex::new(None),
      started_at: Mutex::new(None),
    }
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramBotStatus {
  pub running: bool,
  pub pid: Option<u32>,
  pub started_at: Option<String>,
  pub last_error: Option<String>,
  pub script_path: Option<String>,
}

fn is_child_running(child: &mut Child) -> bool {
  match child.try_wait() {
    Ok(None) => true,
    Ok(Some(_)) => false,
    Err(_) => false,
  }
}

fn reap_if_exited(state: &TelegramBotProcess) {
  let mut guard = state.child.lock().unwrap();
  if let Some(child) = guard.as_mut() {
    if !is_child_running(child) {
      let _ = child.wait();
      *guard = None;
      *state.started_at.lock().unwrap() = None;
    }
  }
}

fn resolve_tools_dir(app: &AppHandle) -> Result<PathBuf, String> {
  // Dev: src-tauri/../tools
  let manifest_tools = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("tools");
  if manifest_tools.join("odyssey-telegram-bot.mjs").is_file() {
    return Ok(manifest_tools
      .canonicalize()
      .unwrap_or(manifest_tools));
  }

  // Packaged: resource dir / tools
  if let Ok(resource_dir) = app.path().resource_dir() {
    let candidates = [
      resource_dir.join("tools"),
      resource_dir.join("_up_").join("tools"),
      resource_dir.clone(),
    ];
    for dir in candidates {
      if dir.join("odyssey-telegram-bot.mjs").is_file() {
        return Ok(dir);
      }
    }
  }

  // cwd fallback
  if let Ok(cwd) = std::env::current_dir() {
    let tools = cwd.join("tools");
    if tools.join("odyssey-telegram-bot.mjs").is_file() {
      return Ok(tools);
    }
    let parent_tools = cwd.join("..").join("tools");
    if parent_tools.join("odyssey-telegram-bot.mjs").is_file() {
      return Ok(parent_tools.canonicalize().unwrap_or(parent_tools));
    }
  }

  Err(
    "Could not find tools/odyssey-telegram-bot.mjs. Reinstall Odyssey or run from the project folder."
      .into(),
  )
}

fn resolve_node_command() -> Result<PathBuf, String> {
  // Prefer `node` on PATH
  if which_exists("node") {
    return Ok(PathBuf::from("node"));
  }
  #[cfg(windows)]
  {
    if which_exists("node.exe") {
      return Ok(PathBuf::from("node.exe"));
    }
  }
  Err(
    "Node.js is required for the Telegram bot. Install Node 18+ from https://nodejs.org and ensure `node` is on your PATH."
      .into(),
  )
}

fn which_exists(command: &str) -> bool {
  let mut cmd = Command::new(if cfg!(windows) { "where" } else { "which" });
  cmd.arg(command).stdout(Stdio::null()).stderr(Stdio::null());
  #[cfg(windows)]
  {
    cmd.creation_flags(CREATE_NO_WINDOW);
  }
  match cmd.status() {
    Ok(status) => status.success(),
    Err(_) => false,
  }
}

fn repo_root_from_tools(tools_dir: &Path) -> PathBuf {
  tools_dir
    .parent()
    .map(Path::to_path_buf)
    .unwrap_or_else(|| tools_dir.to_path_buf())
}

#[tauri::command]
pub fn telegram_bot_status(
  app: AppHandle,
  state: State<'_, TelegramBotProcess>,
) -> Result<TelegramBotStatus, String> {
  reap_if_exited(&state);
  let guard = state.child.lock().unwrap();
  let running = guard.is_some();
  let pid = guard.as_ref().map(|c| c.id());
  let script = resolve_tools_dir(&app)
    .ok()
    .map(|d| d.join("odyssey-telegram-bot.mjs").display().to_string());
  Ok(TelegramBotStatus {
    running,
    pid,
    started_at: state.started_at.lock().unwrap().clone(),
    last_error: state.last_error.lock().unwrap().clone(),
    script_path: script,
  })
}

#[tauri::command]
pub fn telegram_bot_start(
  app: AppHandle,
  state: State<'_, TelegramBotProcess>,
) -> Result<TelegramBotStatus, String> {
  reap_if_exited(&state);

  {
    let mut guard = state.child.lock().unwrap();
    if let Some(child) = guard.as_mut() {
      if is_child_running(child) {
        return Ok(TelegramBotStatus {
          running: true,
          pid: Some(child.id()),
          started_at: state.started_at.lock().unwrap().clone(),
          last_error: None,
          script_path: resolve_tools_dir(&app)
            .ok()
            .map(|d| d.join("odyssey-telegram-bot.mjs").display().to_string()),
        });
      }
      let _ = child.wait();
      *guard = None;
    }
  }

  let tools_dir = resolve_tools_dir(&app)?;
  let script = tools_dir.join("odyssey-telegram-bot.mjs");
  if !script.is_file() {
    let msg = format!("Bot script missing: {}", script.display());
    *state.last_error.lock().unwrap() = Some(msg.clone());
    return Err(msg);
  }

  let node = resolve_node_command().map_err(|e| {
    *state.last_error.lock().unwrap() = Some(e.clone());
    e
  })?;
  let cwd = repo_root_from_tools(&tools_dir);

  let mut command = Command::new(&node);
  command
    .arg(&script)
    .current_dir(&cwd)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  #[cfg(windows)]
  {
    command.creation_flags(CREATE_NO_WINDOW);
  }

  let child = command.spawn().map_err(|e| {
    let msg = format!("Failed to start Telegram bot: {e}");
    *state.last_error.lock().unwrap() = Some(msg.clone());
    msg
  })?;

  let pid = child.id();
  let started = chrono_like_now();
  *state.child.lock().unwrap() = Some(child);
  *state.started_at.lock().unwrap() = Some(started.clone());
  *state.last_error.lock().unwrap() = None;

  Ok(TelegramBotStatus {
    running: true,
    pid: Some(pid),
    started_at: Some(started),
    last_error: None,
    script_path: Some(script.display().to_string()),
  })
}

#[tauri::command]
pub fn telegram_bot_stop(state: State<'_, TelegramBotProcess>) -> Result<TelegramBotStatus, String> {
  let mut guard = state.child.lock().unwrap();
  if let Some(mut child) = guard.take() {
    let _ = child.kill();
    let _ = child.wait();
  }
  *state.started_at.lock().unwrap() = None;
  *state.last_error.lock().unwrap() = None;
  Ok(TelegramBotStatus {
    running: false,
    pid: None,
    started_at: None,
    last_error: None,
    script_path: None,
  })
}

pub fn stop_managed_bot(state: &TelegramBotProcess) {
  if let Ok(mut guard) = state.child.lock() {
    if let Some(mut child) = guard.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

fn chrono_like_now() -> String {
  // Avoid extra dependency; RFC-ish local timestamp is enough for UI.
  use std::time::{SystemTime, UNIX_EPOCH};
  let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  format!("{secs}")
}
