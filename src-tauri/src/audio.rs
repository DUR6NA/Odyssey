//! Native menu music playback.
//!
//! Audio is produced entirely on the Rust side (via rodio) so that page
//! navigations inside the WebView cannot interrupt it, and so that browser
//! autoplay policies never apply. The frontend controls the music with three
//! Tauri commands: play, stop, and set_volume.
//!
//! A dedicated OS thread owns the rodio `OutputStream` + `Sink` because the
//! stream handle is `!Send`. The rest of the app communicates with it via a
//! channel.

use std::io::Cursor;
use std::sync::mpsc::{channel, Sender};
use std::thread;

use rodio::{Decoder, OutputStream, Sink, Source};

/// The menu music is embedded in the binary so the running app never needs to
/// touch the filesystem to play it.
const MENU_MUSIC: &[u8] = include_bytes!("../../public/assets/menu-music.mp3");

enum AudioCmd {
    Play(f32),
    Stop,
    SetVolume(f32),
}

pub struct AudioManager {
    tx: Sender<AudioCmd>,
}

impl AudioManager {
    pub fn new() -> Self {
        let (tx, rx) = channel::<AudioCmd>();

        thread::spawn(move || {
            let (_stream, handle) = match OutputStream::try_default() {
                Ok(pair) => pair,
                Err(e) => {
                    eprintln!("[audio] no default output device: {}", e);
                    // Keep draining the channel so senders never block.
                    while rx.recv().is_ok() {}
                    return;
                }
            };

            let mut sink: Option<Sink> = None;

            while let Ok(cmd) = rx.recv() {
                match cmd {
                    AudioCmd::Play(vol) => {
                        let v = vol.clamp(0.0, 1.0);

                        // Already playing — just refresh the volume.
                        if let Some(s) = &sink {
                            if !s.empty() {
                                s.set_volume(v);
                                continue;
                            }
                        }

                        let s = match Sink::try_new(&handle) {
                            Ok(s) => s,
                            Err(e) => {
                                eprintln!("[audio] sink creation failed: {}", e);
                                continue;
                            }
                        };

                        let decoded = match Decoder::new(Cursor::new(MENU_MUSIC)) {
                            Ok(d) => d,
                            Err(e) => {
                                eprintln!("[audio] mp3 decode failed: {}", e);
                                continue;
                            }
                        };

                        s.set_volume(v);
                        s.append(decoded.repeat_infinite());
                        sink = Some(s);
                    }
                    AudioCmd::Stop => {
                        if let Some(s) = sink.take() {
                            s.stop();
                        }
                    }
                    AudioCmd::SetVolume(vol) => {
                        if let Some(s) = &sink {
                            s.set_volume(vol.clamp(0.0, 1.0));
                        }
                    }
                }
            }
        });

        AudioManager { tx }
    }

    pub fn play(&self, vol: f32) {
        let _ = self.tx.send(AudioCmd::Play(vol));
    }

    pub fn stop(&self) {
        let _ = self.tx.send(AudioCmd::Stop);
    }

    pub fn set_volume(&self, vol: f32) {
        let _ = self.tx.send(AudioCmd::SetVolume(vol));
    }
}

#[tauri::command]
pub fn menu_music_play(state: tauri::State<'_, AudioManager>, volume: f32) {
    state.play(volume);
}

#[tauri::command]
pub fn menu_music_stop(state: tauri::State<'_, AudioManager>) {
    state.stop();
}

#[tauri::command]
pub fn menu_music_set_volume(state: tauri::State<'_, AudioManager>, volume: f32) {
    state.set_volume(volume);
}
