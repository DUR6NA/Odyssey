//! Managed Odyssey Telegram bot child process (Node runner).

use serde::Serialize;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const STARTUP_GRACE_MS: u64 = 900;
const STDERR_TAIL_CHARS: usize = 1200;

pub struct TelegramBotProcess {
  pub child: Mutex<Option<Child>>,
  pub last_error: Mutex<Option<String>>,
  pub started_at: Mutex<Option<String>>,
  pub log_path: Mutex<Option<PathBuf>>,
}

impl Default for TelegramBotProcess {
  fn default() -> Self {
    Self {
      child: Mutex::new(None),
      last_error: Mutex::new(None),
      started_at: Mutex::new(None),
      log_path: Mutex::new(None),
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

fn read_log_tail(path: &Path) -> Option<String> {
  let mut file = File::open(path).ok()?;
  let len = file.seek(SeekFrom::End(0)).ok()?;
  let start = len.saturating_sub(STDERR_TAIL_CHARS as u64);
  file.seek(SeekFrom::Start(start)).ok()?;
  let mut buf = String::new();
  file.read_to_string(&mut buf).ok()?;
  let trimmed = buf.trim();
  if trimmed.is_empty() {
    None
  } else {
    // Prefer last non-empty lines
    let tail = trimmed
      .lines()
      .rev()
      .take(8)
      .collect::<Vec<_>>()
      .into_iter()
      .rev()
      .collect::<Vec<_>>()
      .join(" | ");
    Some(tail.chars().take(STDERR_TAIL_CHARS).collect())
  }
}

fn reap_if_exited(state: &TelegramBotProcess) {
  let mut guard = state.child.lock().unwrap();
  if let Some(child) = guard.as_mut() {
    if !is_child_running(child) {
      let code = child.wait().ok().and_then(|s| s.code());
      let log = state.log_path.lock().unwrap().clone();
      let tail = log.as_ref().and_then(|p| read_log_tail(p));
      let msg = match (code, tail) {
        (Some(c), Some(t)) => format!("Bot exited (code {c}): {t}"),
        (Some(c), None) => format!("Bot exited unexpectedly (code {c})."),
        (None, Some(t)) => format!("Bot exited: {t}"),
        (None, None) => "Bot exited unexpectedly.".into(),
      };
      *state.last_error.lock().unwrap() = Some(msg);
      *guard = None;
      *state.started_at.lock().unwrap() = None;
    }
  }
}

/// Node on Windows cannot load scripts under the `\\?\` extended-length prefix
/// (`canonicalize()` adds it). That shows up as: EISDIR lstat 'C:'.
fn node_safe_path(path: PathBuf) -> PathBuf {
  #[cfg(windows)]
  {
    let raw = path.to_string_lossy();
    if let Some(stripped) = raw.strip_prefix(r"\\?\") {
      // UNC form: \\?\UNC\server\share\... → \\server\share\...
      if let Some(unc) = stripped.strip_prefix(r"UNC\") {
        return PathBuf::from(format!(r"\\{unc}"));
      }
      return PathBuf::from(stripped);
    }
  }
  path
}

fn resolve_tools_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let manifest_tools = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("tools");
  if manifest_tools.join("odyssey-telegram-bot.mjs").is_file() {
    return Ok(node_safe_path(
      manifest_tools.canonicalize().unwrap_or(manifest_tools),
    ));
  }

  if let Ok(resource_dir) = app.path().resource_dir() {
    let candidates = [
      resource_dir.join("tools"),
      resource_dir.join("_up_").join("tools"),
      resource_dir.clone(),
    ];
    for dir in candidates {
      if dir.join("odyssey-telegram-bot.mjs").is_file() {
        return Ok(node_safe_path(dir.canonicalize().unwrap_or(dir)));
      }
    }
  }

  if let Ok(cwd) = std::env::current_dir() {
    let tools = cwd.join("tools");
    if tools.join("odyssey-telegram-bot.mjs").is_file() {
      return Ok(node_safe_path(tools.canonicalize().unwrap_or(tools)));
    }
    let parent_tools = cwd.join("..").join("tools");
    if parent_tools.join("odyssey-telegram-bot.mjs").is_file() {
      return Ok(node_safe_path(
        parent_tools.canonicalize().unwrap_or(parent_tools),
      ));
    }
  }

  Err(
    "Could not find tools/odyssey-telegram-bot.mjs. Reinstall Odyssey or run from the project folder."
      .into(),
  )
}

fn resolve_node_command() -> Result<PathBuf, String> {
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

fn bot_log_path(app: &AppHandle) -> PathBuf {
  if let Ok(dir) = app.path().app_data_dir() {
    let log_dir = dir.join("odyssey").join("logs");
    let _ = fs::create_dir_all(&log_dir);
    return log_dir.join("telegram-bot.err.log");
  }
  std::env::temp_dir().join("odyssey-telegram-bot.err.log")
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

  let node = resolve_node_command().inspect_err(|e| {
    *state.last_error.lock().unwrap() = Some(e.clone());
  })?;
  let cwd = repo_root_from_tools(&tools_dir);
  let log_path = bot_log_path(&app);
  let _ = fs::create_dir_all(log_path.parent().unwrap_or(Path::new(".")));
  // Truncate previous run log
  let _ = fs::write(&log_path, b"");

  let stderr_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&log_path)
    .map_err(|e| {
      let msg = format!("Could not open bot log file: {e}");
      *state.last_error.lock().unwrap() = Some(msg.clone());
      msg
    })?;
  let stdout_file = stderr_file
    .try_clone()
    .map_err(|e| format!("Could not clone bot log handle: {e}"))?;

  let mut command = Command::new(&node);
  command
    .arg(&script)
    .current_dir(&cwd)
    .stdin(Stdio::null())
    .stdout(Stdio::from(stdout_file))
    .stderr(Stdio::from(stderr_file));

  #[cfg(windows)]
  {
    command.creation_flags(CREATE_NO_WINDOW);
  }

  let mut child = command.spawn().map_err(|e| {
    let msg = format!("Failed to start Telegram bot: {e}");
    *state.last_error.lock().unwrap() = Some(msg.clone());
    msg
  })?;

  let pid = child.id();
  // Grace period: catch immediate exits (missing token, syntax errors, etc.)
  thread::sleep(Duration::from_millis(STARTUP_GRACE_MS));
  if !is_child_running(&mut child) {
    let code = child.wait().ok().and_then(|s| s.code());
    let tail = read_log_tail(&log_path);
    let msg = match (code, tail) {
      (Some(c), Some(t)) => format!("Bot failed to stay running (code {c}): {t}"),
      (Some(c), None) => format!(
        "Bot failed to stay running (code {c}). Check token in Settings → Telegram and Node install."
      ),
      (None, Some(t)) => format!("Bot failed to stay running: {t}"),
      (None, None) => {
        "Bot failed to stay running. Check token in Settings → Telegram and that Node is installed."
          .into()
      }
    };
    *state.last_error.lock().unwrap() = Some(msg.clone());
    *state.child.lock().unwrap() = None;
    *state.started_at.lock().unwrap() = None;
    *state.log_path.lock().unwrap() = Some(log_path);
    return Err(msg);
  }

  let started = chrono_like_now();
  *state.child.lock().unwrap() = Some(child);
  *state.started_at.lock().unwrap() = Some(started.clone());
  *state.last_error.lock().unwrap() = None;
  *state.log_path.lock().unwrap() = Some(log_path);

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
  // Keep last_error if user is diagnosing; clear on intentional stop
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
  use std::time::{SystemTime, UNIX_EPOCH};
  let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  format!("{secs}")
}
