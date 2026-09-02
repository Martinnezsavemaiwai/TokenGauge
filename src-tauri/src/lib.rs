use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, Position, image::Image
};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::time::{SystemTime, Duration, Instant};
use chrono::{DateTime, Local, NaiveDate};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub used_percent: f64,
    pub remaining_percent: f64,
    pub used: u64,
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
    /// Seconds since the API last answered, so a paused sync can say how old
    /// its numbers are. `None` until one call has succeeded this run.
    pub api_age_secs: Option<u64>,
    /// Tokens per model over the same rolling 24h the chart covers, biggest first.
    pub models: Vec<ModelUsage>,
}

/// One model's share of the rolling 24h, in tokens. There is no per-model
/// *limit* anywhere — the API meters the plan, not the model — so this is
/// counted, never rendered as a percentage of anything but the 24h total.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub credits: u64,
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

/// When the API last actually answered — not when it was last *asked*. The cache
/// timestamp above moves on every attempt, including the failed ones, so it
/// cannot say how stale a paused sync's numbers are.
static LAST_API_OK: std::sync::Mutex<Option<Instant>> = std::sync::Mutex::new(None);

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
    let (total_credits, history, models, base_dir, plan): (u64, Vec<f64>, Vec<ModelUsage>, Option<std::path::PathBuf>, Option<String>) = tokio::task::spawn_blocking(|| {
        let mut total_credits = 0u64;
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
        let mut model_credits: HashMap<String, f64> = HashMap::new();

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
                            // Only assistant messages name a model; user turns
                            // carry usage counters but no `message.model`.
                            if let Some(model) = json
                                .get("message")
                                .and_then(|m| m.get("model"))
                                .and_then(|m| m.as_str())
                            {
                                *model_credits.entry(model.to_string()).or_insert(0.0) += msg_credits;
                            }
                        }
                    }
                }
            }
        }

        let mut models: Vec<ModelUsage> = model_credits
            .into_iter()
            .map(|(model, credits)| ModelUsage { model, credits: credits as u64 })
            .collect();
        models.sort_by(|a, b| b.credits.cmp(&a.credits));

        Ok((total_credits, history, models, base_dir, plan))
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
                    if let Ok(mut ok) = LAST_API_OK.lock() {
                        *ok = Some(Instant::now());
                    }
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

    // No API window means no trustworthy denominator. The raw token count is
    // still reported in `used`; a percentage is only ever the measured one.
    let used_percent = snapshot.session.unwrap_or(0.0);

    Ok(UsageData {
        used_percent,
        remaining_percent: (100.0 - used_percent).max(0.0),
        used: total_credits,
        history,
        api_used_percent: snapshot.session,
        api_reset_at: snapshot.session_reset,
        weekly_percent: snapshot.weekly,
        weekly_reset_at: snapshot.weekly_reset,
        weekly_opus_percent: snapshot.opus,
        weekly_opus_reset_at: snapshot.opus_reset,
        plan,
        api_stale: stale,
        api_age_secs: LAST_API_OK
            .lock()
            .ok()
            .and_then(|ok| *ok)
            .map(|at| at.elapsed().as_secs()),
        models,
    })
}

/// One local calendar day's tokens. Days with no usage are still listed, at
/// zero — a gap in the chart is a fact about that day, not missing data.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DayUsage {
    /// Local date, ISO `YYYY-MM-DD`.
    pub date: String,
    pub credits: u64,
}

static HISTORY_CACHE: std::sync::Mutex<Option<(Instant, Vec<DayUsage>)>> = std::sync::Mutex::new(None);

const HISTORY_TTL: Duration = Duration::from_secs(300);
const HISTORY_DAYS: i64 = 7;

/// Tokens per day for the last week, from the local session files.
///
/// Deliberately not part of `get_claude_usage`: that one runs every 30s and
/// skips any file untouched for 24h, which is what keeps the poll off long-dead
/// session archives. This walks those archives, so it runs when the History tab
/// asks for it and its answer is cached for a few minutes.
#[tauri::command]
async fn get_usage_history() -> Result<Vec<DayUsage>, String> {
    if let Some((fetched, days)) = HISTORY_CACHE.lock().ok().and_then(|c| c.clone()) {
        if fetched.elapsed() < HISTORY_TTL {
            return Ok(days);
        }
    }

    let days: Vec<DayUsage> = tokio::task::spawn_blocking(|| {
        let projects_dir = dirs::home_dir()
            .map(|h| h.join(".claude").join("projects"))
            .ok_or_else(|| "Could not find config directory".to_string())?;
        if !projects_dir.exists() {
            return Err("Claude projects directory not found".to_string());
        }

        let today = Local::now().date_naive();
        let start = today - chrono::Duration::days(HISTORY_DAYS - 1);
        // A file last written before the window opened cannot hold a message
        // inside it. The extra day is slack for clock skew and time zones.
        let cutoff = Duration::from_secs((HISTORY_DAYS as u64 + 1) * 86_400);
        let now = SystemTime::now();

        let mut totals: HashMap<NaiveDate, f64> = HashMap::new();
        let mut seen_uuids = HashSet::new();

        if let Ok(entries) = std::fs::read_dir(projects_dir) {
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
                    let too_old = session_entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|m| now.duration_since(m).ok())
                        .map(|age| age > cutoff)
                        .unwrap_or(false);
                    if too_old {
                        continue;
                    }
                    let Ok(file) = File::open(&session_path) else { continue };
                    for line in BufReader::new(file).lines().filter_map(|l| l.ok()) {
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
                        // The user reads these as their own days, so the bucket
                        // is the local date, not the UTC one the file records.
                        let day = dt.with_timezone(&Local).date_naive();
                        if day < start || day > today {
                            continue;
                        }
                        *totals.entry(day).or_insert(0.0) += msg_credits;
                    }
                }
            }
        }

        Ok((0..HISTORY_DAYS)
            .map(|offset| {
                let day = start + chrono::Duration::days(offset);
                DayUsage {
                    date: day.format("%Y-%m-%d").to_string(),
                    credits: totals.get(&day).copied().unwrap_or(0.0) as u64,
                }
            })
            .collect())
    })
    .await
    .unwrap_or_else(|_| Err("Failed to execute blocking task".to_string()))?;

    if let Ok(mut cache) = HISTORY_CACHE.lock() {
        *cache = Some((Instant::now(), days.clone()));
    }
    Ok(days)
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

/// The tray glyph, not the app tile: `icon.ico` is a 256px Windows plate that
/// turns to mush at 16px. See scripts/gen-icons.mjs.
const TRAY_NORMAL_ICON: &[u8] = include_bytes!("../icons/icon_normal.ico");

#[tauri::command]
fn set_tray_state(app: tauri::AppHandle, state: String) {
    if let Some(tray) = app.tray_by_id("main") {
        // These arms are `UsageState` values, spelled exactly as the frontend
        // sends them. "full" used to fall through to the normal icon, so a spent
        // quota showed the same half-filled orange gauge as a fresh one.
        let icon_bytes = match state.as_str() {
            "warning" => include_bytes!("../icons/icon_warning.ico").as_slice(),
            "critical" | "full" => include_bytes!("../icons/icon_critical.ico").as_slice(),
            "loading" | "no_access" | "error" => include_bytes!("../icons/icon_disabled.ico").as_slice(),
            _ => TRAY_NORMAL_ICON,
        };
        
        if let Ok(image) = Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(image));
        }
    }
}

/// Last known tray icon rect in physical pixels (x, y, width).
static TRAY_ANCHOR: std::sync::Mutex<Option<(i32, i32, i32)>> = std::sync::Mutex::new(None);

fn position_window(window: &tauri::WebviewWindow, tray_rect: tauri::Rect) {
    // `tray-icon` already reports this rect in physical pixels, so there is no
    // scale factor left to apply. Asking the *window's* monitor for one was
    // worse than pointless on a mixed-DPI desktop: it needed an early return
    // when the lookup failed, and that return skipped writing the anchor — so
    // the flyout opened wherever the window had last been left.
    let position = tray_rect.position.to_physical::<i32>(1.0);
    let size = tray_rect.size.to_physical::<u32>(1.0);

    if let Ok(mut anchor) = TRAY_ANCHOR.lock() {
        *anchor = Some((position.x, position.y, size.width as i32));
    }
    anchor_window(window);
}

/// Where a flyout sits: centred over the tray icon, hanging above it, and kept
/// inside `work_area`. Physical pixels throughout; `work_area` is
/// (x, y, width, height), or `None` when the monitor could not be identified.
fn flyout_position(
    tray: (i32, i32, i32),
    size: (u32, u32),
    work_area: Option<(i32, i32, u32, u32)>,
) -> (i32, i32) {
    const GAP: i32 = 12;
    let (tray_x, tray_y, tray_w) = tray;
    let (w, h) = (size.0 as i32, size.1 as i32);

    let mut x = tray_x + (tray_w / 2) - (w / 2);
    let mut y = tray_y - h - GAP;

    if let Some((area_x, area_y, area_w, area_h)) = work_area {
        // `.max` comes last on purpose: a panel bigger than the work area still
        // starts on-screen instead of being shoved off the opposite edge.
        x = x.min(area_x + area_w as i32 - w).max(area_x);
        y = y.min(area_y + area_h as i32 - h).max(area_y);
    }

    (x, y)
}

/// Park the window on the tray anchor at its current size. Called when a flyout
/// opens — not on every resize, which is what used to drag it back across
/// monitors.
fn anchor_window(window: &tauri::WebviewWindow) {
    let Some(tray) = TRAY_ANCHOR.lock().ok().and_then(|a| *a) else { return };
    let Ok(size) = window.outer_size() else { return };

    // The monitor the *tray* is on, not the one the window was last left on.
    // With one monitor at 100% and another at 150% those are different
    // rectangles, and using the wrong one puts the panel off-screen.
    let work_area = window
        .monitor_from_point(tray.0 as f64, tray.1 as f64)
        .ok()
        .flatten()
        .map(|monitor| {
            let area = monitor.work_area();
            (area.position.x, area.position.y, area.size.width, area.size.height)
        });

    let (x, y) = flyout_position(tray, (size.width, size.height), work_area);
    let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
}

/// Hold the window's bottom edge still across a resize.
///
/// The panel grows upward from the taskbar, but `set_position` addresses its
/// top-left, so a resize has to move the window as well — otherwise switching
/// tabs walks its bottom edge down over the taskbar. This used to re-snap to
/// the tray anchor instead, which meant a DPI change (exactly what crossing to
/// a differently-scaled monitor triggers) resized the window and immediately
/// yanked it back to the tray. That is why the flyout could not be moved to the
/// second screen.
fn keep_bottom_edge(window: &tauri::WebviewWindow, last_height: &std::sync::Mutex<u32>, new_height: u32) {
    let Ok(mut last) = last_height.lock() else { return };
    let previous = std::mem::replace(&mut *last, new_height);
    // 0 is "no measurement yet" — the size the window was built with.
    if previous == 0 || previous == new_height {
        return;
    }
    let Ok(position) = window.outer_position() else { return };
    let y = position.y + previous as i32 - new_height as i32;
    let _ = window.set_position(Position::Physical(PhysicalPosition { x: position.x, y }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first. Nothing else stopped a second copy from starting — and a
        // second copy means a second tray icon and two of every notification.
        // Launching again just surfaces the dashboard of the copy already running.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(click) = app.get_webview_window("click") {
                let _ = click.show();
                anchor_window(&click);
                let _ = click.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![close_hover_panel, close_click_panel, set_tray_state, get_claude_usage, get_usage_history, exit_app])
        .setup(|app| {
            let _tray = TrayIconBuilder::with_id("main")
                .icon(Image::from_bytes(TRAY_NORMAL_ICON)?)
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

            for label in ["hover", "click"] {
                let Some(window) = app.get_webview_window(label) else { continue };
                let target = window.clone();
                // Per-window, so the two flyouts cannot read each other's height.
                let last_height = std::sync::Mutex::new(0u32);
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(size) = event {
                        keep_bottom_edge(&target, &last_height, size.height);
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::flyout_position;

    /// 1920x1080 primary at 100%, 48px taskbar — the monitor the tray lives on.
    const PRIMARY: Option<(i32, i32, u32, u32)> = Some((0, 0, 1920, 1032));

    #[test]
    fn centres_the_flyout_above_the_tray_icon() {
        let (x, y) = flyout_position((1500, 1040, 24), (380, 300), PRIMARY);
        assert_eq!(x, 1500 + 12 - 190);
        assert_eq!(y, 1040 - 300 - 12);
    }

    #[test]
    fn keeps_a_tray_near_the_right_edge_on_screen() {
        let (x, _) = flyout_position((1890, 1040, 24), (380, 300), PRIMARY);
        assert!(x + 380 <= 1920, "flyout ran off the right edge: x={x}");
    }

    #[test]
    fn never_starts_above_the_work_area() {
        // A panel taller than the space above the tray would get a negative y.
        let (_, y) = flyout_position((960, 200, 24), (380, 900), PRIMARY);
        assert!(y >= 0, "flyout started off the top of the screen: y={y}");
    }

    #[test]
    fn stays_inside_a_secondary_monitor_with_its_own_origin() {
        // Second screen right of the primary and 86px higher — a real layout,
        // and the one where an unclamped position lands on no monitor at all.
        let secondary = Some((1920, -86, 2560, 1354));
        let (x, y) = flyout_position((4400, 1200, 24), (380, 300), secondary);
        assert!(x >= 1920 && x + 380 <= 1920 + 2560, "x escaped the monitor: {x}");
        assert!(y >= -86, "y escaped the monitor: {y}");
    }

    #[test]
    fn without_a_known_monitor_the_position_is_left_unclamped() {
        // Pins what the clamp is actually doing: these same inputs put the
        // flyout 172px past the right edge when no work area is known.
        let (x, _) = flyout_position((1890, 1040, 24), (380, 300), None);
        assert_eq!(x, 1712);
        assert!(x + 380 > 1920);
    }

    #[test]
    fn a_panel_taller_than_the_screen_still_starts_on_screen() {
        let (_, y) = flyout_position((960, 1040, 24), (380, 2000), PRIMARY);
        assert_eq!(y, 0);
    }
}
