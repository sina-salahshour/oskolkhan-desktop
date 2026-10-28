//! Thin Tauri layer over `oskol-core`: commands, state, and the `core://status` event.

use oskol_core::auth::TelegramStart;
use oskol_core::{Core, CoreConfig, CoreError, CoreStatus, Session};
use serde_json::Value;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};

type CoreState<'a> = State<'a, Arc<Core>>;
type Res<T> = Result<T, CoreError>;

#[tauri::command]
fn core_status(core: CoreState<'_>) -> CoreStatus {
    core.status()
}

#[tauri::command]
async fn api(core: CoreState<'_>, op: String, args: Option<Value>) -> Res<Value> {
    core.api(&op, args.unwrap_or(Value::Null)).await
}

#[tauri::command]
async fn auth_email(core: CoreState<'_>, user_name: String, password: String) -> Res<Session> {
    core.auth_email(&user_name, &password).await
}

#[tauri::command]
async fn auth_guest(core: CoreState<'_>) -> Res<Session> {
    core.auth_guest().await
}

#[tauri::command]
async fn auth_google(core: CoreState<'_>) -> Res<Session> {
    core.auth_google().await
}

#[tauri::command]
async fn auth_telegram_start(core: CoreState<'_>) -> Res<TelegramStart> {
    core.auth_telegram_start().await
}

#[tauri::command]
async fn auth_telegram_poll(core: CoreState<'_>) -> Res<Option<Session>> {
    core.auth_telegram_poll().await
}

#[tauri::command]
fn session(core: CoreState<'_>) -> Option<Session> {
    core.session()
}

#[tauri::command]
async fn logout(core: CoreState<'_>) -> Res<()> {
    core.logout().await
}

#[tauri::command]
async fn import_kickstart(core: CoreState<'_>, path: String) -> Res<CoreStatus> {
    core.import_kickstart(std::path::Path::new(&path)).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_env("OSKOL_LOG")
                .unwrap_or_else(|_| "oskol_core=info,oskolkhan_desktop_lib=info".into()),
        )
        .init();

    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let core = tauri::async_runtime::block_on(Core::start(CoreConfig::new(data_dir)))
                .map_err(|e| Box::<dyn std::error::Error>::from(e.to_string()))?;
            let mut rx = core.subscribe();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let status = rx.borrow_and_update().clone();
                    if let Err(e) = handle.emit("core://status", &status) {
                        tracing::warn!(error = %e, "emit core://status failed");
                    }
                    if rx.changed().await.is_err() {
                        break;
                    }
                }
            });
            app.manage(core);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_status,
            api,
            auth_email,
            auth_guest,
            auth_google,
            auth_telegram_start,
            auth_telegram_poll,
            session,
            logout,
            import_kickstart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OskolKhan");
}
