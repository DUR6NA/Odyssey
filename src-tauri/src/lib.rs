mod audio;
mod telegram_runner;

use audio::{menu_music_play, menu_music_set_volume, menu_music_stop, AudioManager};
use tauri::Manager;
use telegram_runner::{
  stop_managed_bot, telegram_bot_start, telegram_bot_status, telegram_bot_stop, TelegramBotProcess,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Native audio manager — runs on its own OS thread so page navigations
  // inside the WebView cannot interrupt playback. Start the menu music
  // immediately so the user never waits on autoplay heuristics.
  let audio = AudioManager::new();
  audio.play(0.35);

  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .manage(audio)
    .manage(TelegramBotProcess::default())
    .invoke_handler(tauri::generate_handler![
      menu_music_play,
      menu_music_stop,
      menu_music_set_volume,
      telegram_bot_start,
      telegram_bot_stop,
      telegram_bot_status
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Ensure the window opens maximized and only becomes visible once
      // the webview has finished initializing. This prevents the white
      // flash / half-sized window that users briefly saw on launch.
      if let Some(window) = app.get_webview_window("main") {
        // Maximize first, then reveal after a brief delay so the first
        // paint is at final size and the intro fade-in stays smooth.
        let _ = window.maximize();
        let w_show = window.clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_millis(150));
          let _ = w_show.show();
          let _ = w_show.set_focus();
        });
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        if let Some(state) = app_handle.try_state::<TelegramBotProcess>() {
          stop_managed_bot(&state);
        }
      }
    });
}
