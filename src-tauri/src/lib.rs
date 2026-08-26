use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, Position, image::Image
};
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::time::{SystemTime, Duration, Instant};
use chrono::DateTime;
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub used_percent: f64,
    pub remaining_percent: f64,
    pub used: u64,
    pub limit: u64,
    pub history: Vec<f64>,
    pub api_used_percent: Option<f64>,
    pub api_reset_at: Option<String>,
    /// Weekly (7-day, all models) rate-limit window.
    pub weekly_percent: Option<f64>,
    pub weekly_reset_at: Option<String>,
    /// Weekly Opus window — only sent on plans that meter Opus separately.
    pub weekly_opus_percent: Option<f64>,
    pub weekly_opus_reset_at: Option<String>,
    /// Subscription tier from the Claude Code credentials ("pro", "max", …).
    pub plan: Option<String>,
    /// True when the API refresh is failing and these are the last good numbers.
    pub api_stale: bool,
}

#[derive(Clone, Default)]
struct ApiSnapshot {
    session: Option<f64>,
    session_reset: Option<String>,
    weekly: Option<f64>,
    weekly_reset: Option<String>,
    opus: Option<f64>,
    opus_reset: Option<String>,
}

impl ApiSnapshot {
    fn has_data(&self) -> bool {
        self.session.is_some() || self.weekly.is_some()
    }
}

/// (fetched_at, last known good snapshot, last fetch succeeded)
static API_CACHE: std::sync::Mutex<Option<(Instant, ApiSnapshot, bool)>> = std::sync::Mutex::new(None);

const API_TTL: Duration = Duration::from_secs(120);

fn read_window(root: &Value, key: &str) -> (Option<f64>, Option<String>) {
    let window = root.get(key);
    (
        window.and_then(|w| w.get("utilization")).and_then(|u| u.as_f64()),
        window
            .and_then(|w| w.get("resets_at"))
            .and_then(|r| r.as_str())
            .map(|s| s.to_string()),
    )
}

/// Ask Anthropic for the live rate-limit windows. `None` means the call failed
/// (offline, expired OAuth token, API error) — callers keep their last good data.
///
/// ponytail: read-only on the credentials file. The OAuth token expires every few
/// hours and only Claude Code renews it, so sync stays paused (and says so) until
/// it does. Doing the refresh here means writing .credentials.json underneath a
/// running Claude Code — only worth it if "Sync paused" turns out to be common.
async fn fetch_api_usage(base_dir: &std::path::Path) -> Option<ApiSnapshot> {
    let creds_content = std::fs::read_to_string(base_dir.join(".credentials.json")).ok()?;
    let creds = serde_json::from_str::<Value>(&creds_content).ok()?;
    let token = creds
        .get("claudeAiOauth")
        .and_then(|o| o.get("accessToken"))
        .and_then(|t| t.as_str())?;

    let res = reqwest::Client::new()
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "claude-code/2.1.231")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .ok()?;

    if !res.status().is_success() {
        return None;
    }

    let data = res.json::<Value>().await.ok()?;
    let (session, session_reset) = read_window(&data, "five_hour");
    let (weekly, weekly_reset) = read_window(&data, "seven_day");
    let (opus, opus_reset) = read_window(&data, "seven_day_opus");

    let snapshot = ApiSnapshot { session, session_reset, weekly, weekly_reset, opus, opus_reset };
    if snapshot.has_data() { Some(snapshot) } else { None }
}

#[tauri::command]
async fn get_claude_usage() -> Result<UsageData, String> {
    let (local_percent, total_credits, limit, history, base_dir, plan): (f64, u64, u64, Vec<f64>, Option<std::path::PathBuf>, Option<String>) = tokio::task::spawn_blocking(|| {
        let mut total_credits = 0u64;
        let limit = 25_000_000u64;
        let base_dir = dirs::home_dir().map(|h| h.join(".claude"));

        let plan = base_dir
            .as_ref()
            .and_then(|b| std::fs::read_to_string(b.join(".credentials.json")).ok())
            .and_then(|c| serde_json::from_str::<Value>(&c).ok())
            .and_then(|c| {
                c.get("claudeAiOauth")
                    .and_then(|o| o.get("subscriptionType"))
                    .and_then(|s| s.as_str())
                    .map(|s| s.to_string())
            });

        let projects_dir = base_dir.clone()
            .map(|p| p.join("projects"))
            .ok_or_else(|| "Could not find config directory".to_string())?;

        if !projects_dir.exists() {
            return Err("Claude projects directory not found".to_string());
        }

        let five_hours = Duration::from_secs(5 * 3600);
        let twenty_four_hours = Duration::from_secs(24 * 3600);
        let mut seen_uuids = HashSet::new();
        let mut history = vec![0f64; 24]; // rolling hourly buckets, index 23 = this hour

        if let Ok(entries) = std::fs::read_dir(projects_dir) {
            let now = SystemTime::now();
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let Ok(session_files) = std::fs::read_dir(&path) else { continue };
                for session_entry in session_files.filter_map(|e| e.ok()) {
                    let session_path = session_entry.path();
                    if session_path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                        continue;
                    }
                    // A file untouched for 24h holds nothing this scan looks at —
                    // skipping it keeps the poll off long-dead session archives.
                    let untouched = session_entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|m| now.duration_since(m).ok())
                        .map(|age| age > twenty_four_hours)
                        .unwrap_or(false);
                    if untouched {
                        continue;
                    }
                    let Ok(file) = File::open(&session_path) else { continue };
                    let reader = BufReader::new(file);
                    for line in reader.lines().filter_map(|l| l.ok()) {
                        let Ok(json) = serde_json::from_str::<Value>(&line) else { continue };

                        if let Some(uuid) = json.get("uuid").and_then(|u| u.as_str()) {
                            if !seen_uuids.insert(uuid.to_string()) {
                                continue;
                            }
                        }

                        let Some(usage) = json.get("message").and_then(|m| m.get("usage")) else { continue };
                        let msg_credits = ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]
                            .iter()
                            .filter_map(|field| usage.get(field).and_then(|v| v.as_f64()))
                            .sum::<f64>();
                        if msg_credits <= 0.0 {
                            continue;
                        }

                        let Some(ts_str) = json.get("timestamp").and_then(|t| t.as_str()) else { continue };
                        let Ok(dt) = DateTime::parse_from_rfc3339(ts_str) else { continue };
                        let msg_time = SystemTime::from(dt);

                        let Ok(duration) = now.duration_since(msg_time) else { continue };
                        if duration <= five_hours {
                            total_credits += msg_credits as u64;
                        }

                        // Rolling 24h, oldest first: index 23 is the hour we are in.
                        // The limits being watched are rolling too, so a midnight
                        // reset would blank the chart against nothing real. The
                        // frontend turns the index into a clock hour using
                        // `updatedAt` — labelling the index itself as an hour is
                        // what pinned the axis to "11 PM" forever.
                        if duration <= twenty_four_hours {
                            let hours_ago = (duration.as_secs() / 3600) as usize;
                            if hours_ago < 24 {
                                history[23 - hours_ago] += msg_credits;
                            }
                        }
                    }
                }
            }
        }

        let local_percent = (total_credits as f64 / limit as f64) * 100.0;
        
        Ok((local_percent, total_credits, limit, history, base_dir, plan))
    }).await.unwrap_or_else(|_| Err("Failed to execute blocking task".to_string()))?;

    // Start from whatever the API last told us. A failed refresh must never drop
    // us back onto the local token estimate — that fallback is what turned a
    // healthy "35% — Live API Sync" into "100% used / negative remaining (Local only)".
    let cached = API_CACHE.lock().ok().and_then(|c| c.clone());
    let mut snapshot = cached.as_ref().map(|(_, s, _)| s.clone()).unwrap_or_default();
    let mut stale = cached.as_ref().map(|(_, _, ok)| !ok).unwrap_or(false);
    let should_fetch = cached
        .as_ref()
        .map(|(fetched, _, _)| fetched.elapsed() >= API_TTL)
        .unwrap_or(true);

    if should_fetch {
        match base_dir {
            Some(base) => match fetch_api_usage(&base).await {
                Some(fresh) => {
                    snapshot = fresh;
                    stale = false;
                }
                // Keep the last good numbers; just flag them as stale.
                None => stale = snapshot.has_data(),
            },
            None => stale = snapshot.has_data(),
        }
        if let Ok(mut cache) = API_CACHE.lock() {
            *cache = Some((Instant::now(), snapshot.clone(), !stale));
        }
    }

    let used_percent = snapshot.session.unwrap_or_else(|| local_percent.min(100.0));

    Ok(UsageData {
        used_percent,
        remaining_percent: (100.0 - used_percent).max(0.0),
        used: total_credits,
        limit,
        history,
        api_used_percent: snapshot.session,
        api_reset_at: snapshot.session_reset,
        weekly_percent: snapshot.weekly,
        weekly_reset_at: snapshot.weekly_reset,
        weekly_opus_percent: snapshot.opus,
        weekly_opus_reset_at: snapshot.opus_reset,
        plan,
        api_stale: stale,
    })
}

#[tauri::command]
fn close_hover_panel(app: tauri::AppHandle) {
    if let Some(hover) = app.get_webview_window("hover") {
        let _ = hover.hide();
    }
}

#[tauri::command]
fn close_click_panel(app: tauri::AppHandle) {
    if let Some(click) = app.get_webview_window("click") {
        let _ = click.hide();
    }
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // Gracefully close all windows to try and satisfy WebView2 teardown
    for window in app.webview_windows().values() {
        let _ = window.close();
    }
    app.exit(0);
}

#[tauri::command]
fn set_tray_state(app: tauri::AppHandle, state: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let icon_bytes = match state.as_str() {
            "warning" => include_bytes!("../icons/icon_warning.ico").as_slice(),
            "critical" => include_bytes!("../icons/icon_critical.ico").as_slice(),
            "disabled" => include_bytes!("../icons/icon_disabled.ico").as_slice(),
            _ => include_bytes!("../icons/icon.ico").as_slice(),
        };
        
        if let Ok(image) = Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(image));
        }
    }
}

fn position_window(window: &tauri::WebviewWindow, tray_rect: tauri::Rect) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let scale_factor = monitor.scale_factor();
        let window_size = window.outer_size().unwrap_or_default();
        
        let physical_pos = tray_rect.position.to_physical::<i32>(scale_factor);
        let physical_size = tray_rect.size.to_physical::<u32>(scale_factor);
        
        let tray_x = physical_pos.x;
        let tray_y = physical_pos.y;
        let tray_w = physical_size.width as i32;
        
        // Center horizontally above tray icon
        let x = tray_x + (tray_w / 2) - (window_size.width as i32 / 2);
        
        // Position vertically above tray icon (with small gap)
        let gap = 12; // pixels
        let y = tray_y - window_size.height as i32 - gap;
        
        let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![close_hover_panel, close_click_panel, set_tray_state, get_claude_usage, exit_app])
        .setup(|app| {
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("TokenGauge")
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    let hover = app.get_webview_window("hover").unwrap();
                    let click = app.get_webview_window("click").unwrap();
                    
                    match event {
                        TrayIconEvent::Enter { rect, .. } => {
                            let _ = app.emit("tray-enter", ());
                            if !click.is_visible().unwrap_or(false) {
                                position_window(&hover, rect);
                                let _ = hover.show();
                            }
                        }
                        TrayIconEvent::Leave { .. } => {
                            let _ = app.emit("tray-leave", ());
                        }
                        TrayIconEvent::Click { button, button_state, id: _, position: _, rect, .. } => {
                            if button == tauri::tray::MouseButton::Left && button_state == tauri::tray::MouseButtonState::Down {
                                let _ = hover.hide();
                                
                                if click.is_visible().unwrap_or(false) {
                                    let _ = click.hide();
                                } else {
                                    position_window(&click, rect);
                                    let _ = click.show();
                                    let _ = click.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
