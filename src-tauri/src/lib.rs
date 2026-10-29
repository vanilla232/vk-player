use tauri_plugin_keyring::KeyringExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{Emitter, Manager};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use souvlaki::{MediaControls, PlatformConfig, MediaMetadata, MediaPlayback, MediaControlEvent};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::collections::HashMap;

const DISCORD_APP_ID: &str = " you_discord_app_id "; 

struct MediaState(Mutex<Option<MediaControls>>);
struct DiscordState(Mutex<Option<DiscordIpcClient>>);

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AudioItem {
    id: i64,
    owner_id: i64,
    artist: String,
    title: String,
    duration: i32,
    url: Option<String>,
    cover_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Playlist {
    id: String,
    owner_id: Option<String>,
    title: String,
    description: Option<String>,
    count: i32,
    access_key: Option<String>,
    cover_url: Option<String>,
}

fn get_i64(val: &Value) -> i64 {
    if let Some(n) = val.as_i64() { n } 
    else if let Some(s) = val.as_str() { s.parse().unwrap_or(0) } 
    else { 0 }
}

fn get_string(val: &Value) -> Option<String> {
    if let Some(s) = val.as_str() {
        Some(s.to_string())
    } else if let Some(n) = val.as_i64() {
        Some(n.to_string())
    } else {
        None
    }
}

fn extract_track_cover(item: &Value) -> Option<String> {
    if let Some(album) = item.get("album") {
        if let Some(thumb) = album.get("thumb") {
            if let Some(photo) = thumb.get("photo_270") {
                return photo.as_str().map(|s| s.to_string());
            }
        }
    }
    if let Some(thumb) = item.get("thumb") {
        if let Some(photo) = thumb.get("photo_270") {
            return photo.as_str().map(|s| s.to_string());
        }
    }
    None
}

fn extract_playlist_cover(item: &Value) -> Option<String> {
    if let Some(photo) = item.get("photo") {
        if let Some(p) = photo.get("photo_270") {
            return p.as_str().map(|s| s.to_string());
        }
        if let Some(p) = photo.get("photo_600") {
            return p.as_str().map(|s| s.to_string());
        }
    }
    if let Some(cover) = item.get("cover") {
        return cover.as_str().map(|s| s.to_string());
    }
    None
}

fn parse_track(item: &Value) -> AudioItem {
    AudioItem {
        id: get_i64(&item["id"]),
        owner_id: get_i64(&item["owner_id"]),
        artist: item["artist"].as_str().unwrap_or("Неизвестен").to_string(),
        title: item["title"].as_str().unwrap_or("Без названия").to_string(),
        duration: get_i64(&item["duration"]) as i32,
        url: item["url"].as_str().map(|s| s.to_string()),
        cover_url: extract_track_cover(item),
    }
}

#[tauri::command]
fn get_cached_files(app: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("tracks");
    let mut map = HashMap::new();
    
    if path.exists() && path.is_dir() {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                let file_path = entry.path();
                if let Some(ext) = file_path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "mp3" {
                        if let Some(stem) = file_path.file_stem() {
                            if let Some(stem_str) = stem.to_str() {
                                map.insert(stem_str.to_string(), file_path.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(map)
}

#[tauri::command]
async fn download_track(app: tauri::AppHandle, url: String, filename: String) -> Result<String, String> {
    let res = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !res.status().is_success() { return Err(format!("HTTP error: {}", res.status())); }
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;

    let mut dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    dir.push("tracks");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    
    let final_path = dir.join(&filename);
    let tmp_path = dir.join(format!("{}.tmp", filename));

    std::fs::write(&tmp_path, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &final_path).map_err(|e| e.to_string())?;
    
    Ok(final_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_cached_track(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    path.push("tracks");
    path.push(filename);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn init_discord(state: tauri::State<DiscordState>) {
    let mut client = DiscordIpcClient::new(DISCORD_APP_ID);
    if client.connect().is_ok() { *state.0.lock().unwrap() = Some(client); }
}

#[tauri::command]
fn update_discord(state: tauri::State<DiscordState>, title: String, artist: String, cover_url: Option<String>, current_time: u64, duration: u64) {
    if let Some(client) = state.0.lock().unwrap().as_mut() {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        let start_ts = (now.saturating_sub(current_time)) as i64;
        let end_ts = (now + duration.saturating_sub(current_time)) as i64;
        let image = cover_url.unwrap_or_else(|| "logo".to_string());

        let payload = activity::Activity::new()
            .activity_type(activity::ActivityType::Listening)
            .details(&title).state(&artist)
            .assets(activity::Assets::new().large_image(&image).large_text("VK Player"))
            .timestamps(activity::Timestamps::new().start(start_ts).end(end_ts));
        let _ = client.set_activity(payload);
    }
}

#[tauri::command]
fn clear_discord(state: tauri::State<DiscordState>) {
    if let Some(client) = state.0.lock().unwrap().as_mut() { let _ = client.clear_activity(); }
}

#[tauri::command]
fn set_window_mode(window: tauri::WebviewWindow, is_mini: bool) -> Result<(), String> {
    if is_mini {
        window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 320.0, height: 490.0 })).map_err(|e| e.to_string())?;
        window.set_resizable(false).map_err(|e| e.to_string())?;
        window.set_decorations(false).map_err(|e| e.to_string())?;
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
    } else {
        window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1000.0, height: 700.0 })).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_decorations(true).map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.center().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn init_media_controls(app: tauri::AppHandle) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app_clone = app.clone();

    app.run_on_main_thread(move || {
        #[cfg(target_os = "windows")]
        let hwnd = {
            if let Some(window) = app_clone.get_webview_window("main") {
                window.hwnd().ok().map(|h| h.0 as *mut std::ffi::c_void)
            } else { None }
        };
        
        #[cfg(not(target_os = "windows"))]
        let hwnd = None;

        let config = PlatformConfig {
            dbus_name: "vk_player",
            display_name: "VK Player",
            hwnd,
        };

        match MediaControls::new(config) {
            Ok(mut controls) => {
                let app_handle = app_clone.clone();
                let _ = controls.attach(move |event| {
                    match event {
                        MediaControlEvent::Play => { let _ = app_handle.emit("media_play", ()); },
                        MediaControlEvent::Pause => { let _ = app_handle.emit("media_pause", ()); },
                        MediaControlEvent::Toggle => { let _ = app_handle.emit("media_toggle", ()); },
                        MediaControlEvent::Next => { let _ = app_handle.emit("media_next", ()); },
                        MediaControlEvent::Previous => { let _ = app_handle.emit("media_prev", ()); },
                        _ => {}
                    }
                });
                let _ = tx.send(Ok(controls));
            }
            Err(e) => {
                let _ = tx.send(Err(format!("Ошибка SMTC: {:?}", e)));
            }
        }
    }).map_err(|e| e.to_string())?;

    let controls = rx.recv().map_err(|e| e.to_string())??;
    let state = app.state::<MediaState>();
    *state.0.lock().unwrap() = Some(controls);
    
    Ok(())
}

#[tauri::command]
fn update_media_metadata(
    app: tauri::AppHandle, 
    title: String, 
    artist: String, 
    cover_url: Option<String>,
    is_playing: bool
) {
    let app_clone = app.clone();
    let _ = app.run_on_main_thread(move || {
        let state = app_clone.state::<MediaState>();
        let mut lock = state.0.lock().unwrap(); 
        
        if let Some(controls) = lock.as_mut() {
            let metadata = MediaMetadata {
                title: Some(&title),
                artist: Some(&artist),
                album: None,
                cover_url: cover_url.as_deref(),
                duration: None,
            };
            let _ = controls.set_metadata(metadata);
            
            let playback = if is_playing { MediaPlayback::Playing { progress: None } } else { MediaPlayback::Paused { progress: None } };
            let _ = controls.set_playback(playback);
        }
    }); 
}

#[tauri::command]
async fn check_auth(app: tauri::AppHandle) -> bool {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) {
        Ok(tauri_plugin_keyring::CredentialValue::Password(_)) => true, _ => false,
    }
}

#[tauri::command]
async fn save_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let token = token.trim().to_string();
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| e.to_string())?;
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let res = client.get("https://api.vk.com/method/users.get").query(&[("access_token", token.as_str()), ("v", "5.199")]).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    if json.get("error").is_some() { return Err("Неверный токен".to_string()); }
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    app.keyring().set("vk_access_token", tauri_plugin_keyring::CredentialType::Password, tauri_plugin_keyring::CredentialValue::Password(token)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn search_music(app: tauri::AppHandle, query: String, offset: i32) -> Result<Vec<AudioItem>, String> {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    let token = match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) { Ok(tauri_plugin_keyring::CredentialValue::Password(t)) => t, _ => return Err("Токен не найден".to_string()) };
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| e.to_string())?;
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let res = client.get("https://api.vk.com/method/audio.search").query(&[("access_token", token.as_str()), ("v", "5.199"), ("q", query.as_str()), ("count", "50"), ("offset", &offset.to_string())]).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(error) = json.get("error") { return Err(format!("Ошибка ВК: {}", error["error_msg"].as_str().unwrap_or("Неизвестно"))); }
    let items = json["response"]["items"].as_array().ok_or("Нет поля items")?;
    Ok(items.iter().map(parse_track).collect())
}

#[tauri::command]
async fn get_my_music(app: tauri::AppHandle, offset: i32) -> Result<Vec<AudioItem>, String> {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    let token = match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) { Ok(tauri_plugin_keyring::CredentialValue::Password(t)) => t, _ => return Err("Токен не найден".to_string()) };
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| e.to_string())?;
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let res = client.get("https://api.vk.com/method/audio.get").query(&[("access_token", token.as_str()), ("v", "5.199"), ("count", "50"), ("offset", &offset.to_string())]).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(error) = json.get("error") { return Err(format!("Ошибка ВК: {}", error["error_msg"].as_str().unwrap_or("Неизвестно"))); }
    let items = json["response"]["items"].as_array().ok_or("Нет поля items")?;
    Ok(items.iter().map(parse_track).collect())
}

#[tauri::command]
async fn toggle_favorite(app: tauri::AppHandle, audio_id: i64, owner_id: i64, add: bool) -> Result<(), String> {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    let token = match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) { Ok(tauri_plugin_keyring::CredentialValue::Password(t)) => t, _ => return Err("Токен не найден".to_string()) };
    let client = reqwest::Client::new();
    let method = if add { "audio.add" } else { "audio.delete" };
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let res = client.get(format!("https://api.vk.com/method/{}", method)).query(&[("access_token", token.as_str()), ("v", "5.199"), ("audio_id", &audio_id.to_string()), ("owner_id", &owner_id.to_string())]).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(error) = json.get("error") { return Err(format!("Ошибка ВК: {}", error["error_msg"].as_str().unwrap_or("Неизвестно"))); }
    Ok(())
}

#[tauri::command]
async fn get_playlists(app: tauri::AppHandle) -> Result<Vec<Playlist>, String> {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    let token = match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) { Ok(tauri_plugin_keyring::CredentialValue::Password(t)) => t, _ => return Err("Токен не найден".to_string()) };
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| e.to_string())?;
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let user_res = client.get("https://api.vk.com/method/users.get").query(&[("access_token", token.as_str()), ("v", "5.199")]).send().await.map_err(|e| e.to_string())?;
    let user_json: Value = user_res.json().await.map_err(|e| e.to_string())?;
    let user_id = get_i64(&user_json["response"][0]["id"]).to_string();

    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let res = client.get("https://api.vk.com/method/audio.getPlaylists").query(&[("access_token", token.as_str()), ("v", "5.199"), ("count", "100"), ("owner_id", user_id.as_str())]).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(error) = json.get("error") { return Err(format!("Ошибка ВК: {}", error["error_msg"].as_str().unwrap_or("Неизвестно"))); }
    let mut playlists = Vec::new();
    if let Some(items) = json["response"]["items"].as_array() {
        for item in items {
            playlists.push(Playlist {
                id: get_string(&item["id"]).unwrap_or_default(),
                owner_id: get_string(&item["owner_id"]).or(Some(user_id.clone())),
                title: item["title"].as_str().unwrap_or("Без названия").to_string(),
                description: item["description"].as_str().map(|s| s.to_string()),
                count: get_i64(&item["count"]) as i32,
                access_key: item["access_key"].as_str().map(|s| s.to_string()),
                cover_url: extract_playlist_cover(item),
            });
        }
    }
    Ok(playlists)
}

#[tauri::command]
async fn get_vk_mix(app: tauri::AppHandle, offset: i32, seed_audio: Option<String>) -> Result<(Vec<AudioItem>, Vec<Playlist>), String> {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    let token = match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) { Ok(tauri_plugin_keyring::CredentialValue::Password(t)) => t, _ => return Err("Токен не найден".to_string()) };
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| e.to_string())?;
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let mut query: Vec<(&str, String)> = vec![("access_token", token.clone()), ("v", "5.199".to_string()), ("count", "50".to_string())];
    if let Some(seed) = seed_audio { if !seed.is_empty() { query.push(("target_audio", seed)); } else { query.push(("offset", offset.to_string())); } } else { query.push(("offset", offset.to_string())); }
    let res_rec = client.get("https://api.vk.com/method/audio.getRecommendations").query(&query).send().await.map_err(|e| e.to_string())?;
    let json_rec: Value = res_rec.json().await.map_err(|e| e.to_string())?;
    let mut recommended_tracks = Vec::new();
    if let Some(items) = json_rec["response"]["items"].as_array() { recommended_tracks = items.iter().map(parse_track).collect(); }
    let mut playlists = Vec::new();
    if offset == 0 {
        tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
        
        let res_pl = client.get("https://api.vk.com/method/audio.getPlaylists").query(&[("access_token", token.as_str()), ("v", "5.199"), ("count", "20"), ("mixed", "true")]).send().await.map_err(|e| e.to_string())?;
        let json_pl: Value = res_pl.json().await.map_err(|e| e.to_string())?;
        if let Some(items) = json_pl["response"]["items"].as_array() {
            for item in items {
                playlists.push(Playlist {
                    id: get_string(&item["id"]).unwrap_or_default(),
                    owner_id: get_string(&item["owner_id"]),
                    title: item["title"].as_str().unwrap_or("Без названия").to_string(),
                    description: item["description"].as_str().map(|s| s.to_string()),
                    count: get_i64(&item["count"]) as i32,
                    access_key: item["access_key"].as_str().map(|s| s.to_string()),
                    cover_url: extract_playlist_cover(item),
                });
            }
        }
    }
    Ok((recommended_tracks, playlists))
}

#[tauri::command]
async fn get_playlist_tracks(app: tauri::AppHandle, owner_id: Option<String>, playlist_id: String, access_key: Option<String>) -> Result<Vec<AudioItem>, String> {
    let _ = app.keyring().initialize_service("com.vkplayer.app".to_string());
    let token = match app.keyring().get("vk_access_token", tauri_plugin_keyring::CredentialType::Password) { Ok(tauri_plugin_keyring::CredentialValue::Password(t)) => t, _ => return Err("Токен не найден".to_string()) };
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0").build().map_err(|e| e.to_string())?;
    let mut final_owner_id = owner_id.unwrap_or_default();
    if final_owner_id.is_empty() || final_owner_id == "undefined" {
        tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
        
        let user_res = client.get("https://api.vk.com/method/users.get").query(&[("access_token", token.as_str()), ("v", "5.199")]).send().await.map_err(|e| e.to_string())?;
        let user_json: Value = user_res.json().await.map_err(|e| e.to_string())?;
        final_owner_id = get_i64(&user_json["response"][0]["id"]).to_string();
    }
    
    tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;
    
    let mut query = vec![("access_token".to_string(), token), ("v".to_string(), "5.199".to_string()), ("owner_id".to_string(), final_owner_id), ("playlist_id".to_string(), playlist_id.clone()), ("count".to_string(), "100".to_string())];
    if let Some(key) = access_key { if !key.is_empty() { query.push(("access_key".to_string(), key)); } }
    let res = client.get("https://api.vk.com/method/audio.get").query(&query).send().await.map_err(|e| e.to_string())?;
    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    if json.get("error").is_some() { return Err(format!("Ошибка ВК: {}", json["error"]["error_msg"].as_str().unwrap_or("Неизвестно"))); }
    let items = json["response"]["items"].as_array().ok_or("Нет поля items")?;
    Ok(items.iter().map(parse_track).collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_keyring::init())
        .manage(MediaState(Mutex::new(None)))
        .manage(DiscordState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            check_auth, save_token, search_music, get_my_music, toggle_favorite, get_playlists, get_vk_mix, get_playlist_tracks,
            init_media_controls, update_media_metadata, set_window_mode, download_track, delete_cached_track, get_cached_files,
            init_discord, update_discord, clear_discord
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}