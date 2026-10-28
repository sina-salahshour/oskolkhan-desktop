//! The MOBILE identity presented to the backend (design §4, "Mobile-identity rule").
//!
//! The client behaves like the Android app 2.0.44 on a **Poco F6 Pro / Android 16**, never
//! like a desktop browser: the backend likely gates on the User-Agent and device fields.
//! Every value lives here so it can be swapped in one place once
//! `docs/native-protocol.md` lands.
//!
//! Per-endpoint `DeviceName`, copied verbatim from the APK (AuthActivity):
//! - `eauth` and `GCredentialAuth` send the composed settings name
//!   `capitalize(MANUFACTURER) + " " + MODEL` (field `f44790j`).
//! - `gauth` and `tauth` send raw `Build.MANUFACTURER` (field `f44792l`).
//!
//! `Model` is always `Build.MODEL`, `AndroidVersion` is `Build.VERSION.RELEASE`, and the
//! `PreLoad.Envs` UA template gets `$osVersion` = RELEASE, `$deviceName` = MODEL
//! (`p000/jb4.java`).

/// Android app version name.
pub const APP_VERSION_NAME: &str = "2.0.44";
/// Android `versionCode` (also passed to native `postInit`).
pub const APP_VERSION_CODE: i32 = 79;

/// `Build.MANUFACTURER`.
pub const MANUFACTURER: &str = "Xiaomi";
/// `Build.BRAND`.
pub const BRAND: &str = "POCO";
/// `Build.MODEL` → form field `Model` and `$deviceName` in `PreLoad.Envs`.
/// Poco F6 Pro, codename `vermeer`.
pub const MODEL: &str = "23113RKC6G";
/// `Build.VERSION.RELEASE` → form field `AndroidVersion` and `$osVersion`.
pub const ANDROID_VERSION: &str = "16";
/// `Build.VERSION.SDK_INT` (kept for the UA/RE work; not currently sent as a field).
pub const SDK_INT: i32 = 36;
/// `Build.ID` / fingerprint build tag, used by the placeholder UA below.
/// TODO(native-protocol): confirm the real build id the native UA carries.
pub const BUILD_ID: &str = "BP2A.250605.031";

/// Upstream User-Agent used until `PreLoad.Envs` provides the template.
/// TODO(native-protocol): replace with the exact string libexo.so sends. This is an
/// Android 16 / Poco F6 Pro placeholder (the platform HTTP stack's default UA shape),
/// never a desktop browser UA.
pub const FALLBACK_USER_AGENT: &str =
    "Dalvik/2.1.0 (Linux; U; Android 16; 23113RKC6G Build/BP2A.250605.031)";

/// FCM token sent with auth requests (design: empty; there is no FCM on desktop).
/// Note: Android sends `String.valueOf(token)`, i.e. the literal "null" when it has none.
pub const FCM_TOKEN: &str = "";

/// Capitalize the first character (Android `Character.toUpperCase(charAt(0)) + substring(1)`).
fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// The Android "settings" device name (AuthActivity): `capitalize(MODEL)` when MODEL
/// already starts with MANUFACTURER, otherwise `capitalize(MANUFACTURER) + " " + MODEL`.
pub fn compose_device_name(manufacturer: &str, model: &str) -> String {
    if model.starts_with(manufacturer) {
        capitalize(model)
    } else {
        format!("{} {}", capitalize(manufacturer), model)
    }
}

/// Device identity sent with auth requests. `device_id` is per-install (stable random
/// 16-hex, ANDROID_ID shape); the rest are the constants above.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MobileIdentity {
    pub device_id: String,
    /// Raw `Build.MANUFACTURER` (DeviceName for gauth/tauth).
    pub manufacturer: String,
    /// Composed settings name (DeviceName for eauth/GCredentialAuth).
    pub device_name: String,
    /// `Model` form field.
    pub model: String,
    /// `AndroidVersion` form field (Build.VERSION.RELEASE).
    pub android_version: String,
}

impl MobileIdentity {
    pub fn with_device_id(device_id: String) -> Self {
        Self {
            device_id,
            manufacturer: MANUFACTURER.into(),
            device_name: compose_device_name(MANUFACTURER, MODEL),
            model: MODEL.into(),
            android_version: ANDROID_VERSION.into(),
        }
    }

    fn form_with(&self, device_name: &str) -> Vec<(String, String)> {
        vec![
            ("DeviceId".into(), self.device_id.clone()),
            ("DeviceName".into(), device_name.to_owned()),
            ("Model".into(), self.model.clone()),
            ("AndroidVersion".into(), self.android_version.clone()),
            ("FCM".into(), FCM_TOKEN.into()),
        ]
    }

    /// `eauth` / `GCredentialAuth`: DeviceName is the composed settings name.
    pub fn form(&self) -> Vec<(String, String)> {
        self.form_with(&self.device_name)
    }

    /// `gauth` / `tauth`: DeviceName is the raw `Build.MANUFACTURER`.
    pub fn form_raw_manufacturer(&self) -> Vec<(String, String)> {
        self.form_with(&self.manufacturer)
    }

    /// Fill the `PreLoad.Envs` template: `$osVersion`→release, `$deviceName`→model.
    pub fn fill_envs(&self, template: &str) -> String {
        template.replace("$osVersion", &self.android_version).replace("$deviceName", &self.model)
    }
}

/// Generate a new ANDROID_ID-shaped id (16 lowercase hex chars).
pub fn new_device_id() -> String {
    hex::encode(rand::random::<[u8; 8]>())
}

pub fn is_device_id(s: &str) -> bool {
    s.len() == 16 && s.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mobile_values() {
        let id = MobileIdentity::with_device_id(new_device_id());
        assert!(is_device_id(&id.device_id));
        // eauth/GCredentialAuth: composed DeviceName.
        let composed = id.form();
        assert_eq!(composed[1], ("DeviceName".into(), "Xiaomi 23113RKC6G".into()));
        // gauth/tauth: raw manufacturer DeviceName.
        let raw = id.form_raw_manufacturer();
        assert_eq!(raw[1], ("DeviceName".into(), "Xiaomi".into()));
        assert_eq!(composed[2], ("Model".into(), "23113RKC6G".into()));
        assert_eq!(composed[3], ("AndroidVersion".into(), "16".into()));
        assert_eq!(id.fill_envs("X/1 ($osVersion; $deviceName)"), "X/1 (16; 23113RKC6G)");
        assert!(FALLBACK_USER_AGENT.contains("Android 16"));
        assert!(FALLBACK_USER_AGENT.contains("23113RKC6G"));
        assert!(!FALLBACK_USER_AGENT.contains("Windows") && !FALLBACK_USER_AGENT.contains("Mozilla"));
    }

    #[test]
    fn device_name_composition() {
        // MODEL does not start with MANUFACTURER → "Xiaomi 23113RKC6G".
        assert_eq!(compose_device_name("Xiaomi", "23113RKC6G"), "Xiaomi 23113RKC6G");
        // MODEL already starts with MANUFACTURER → capitalize(MODEL) only.
        assert_eq!(compose_device_name("samsung", "samsung SM-X"), "Samsung SM-X");
    }
}
