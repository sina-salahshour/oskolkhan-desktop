//! `api(op, args)`: one op per backend endpoint (android-analysis §3).

use crate::backend::BackendRequest;
use crate::core::Core;
use crate::error::{CoreError, Result};
use crate::json::to_json;
use crate::proto::clientbin::SubTitleParent;
use crate::proto::pmodel::{
    AdProfile, Ctype, Faq, GenericTitle, GetMore, Home, ISearch, ItemDetail, OAuth, TitleFilesV2,
};
use serde_json::{Map, Value};

/// Constant `_plh` value Android sends (`MoreTitleActivity`, `hy`, `lz7`).
pub const PLH: &str = "834729";

struct Args<'a>(&'a Map<String, Value>);

impl Args<'_> {
    fn raw(&self, k: &str) -> Option<&Value> {
        self.0.get(k).filter(|v| !v.is_null())
    }
    fn i64(&self, k: &str) -> Result<i64> {
        self.opt_i64(k)?.ok_or_else(|| bad(format!("missing argument `{k}`")))
    }
    fn opt_i64(&self, k: &str) -> Result<Option<i64>> {
        match self.raw(k) {
            None => Ok(None),
            Some(Value::Number(n)) => n
                .as_i64()
                .or_else(|| n.as_f64().map(|f| f as i64))
                .map(Some)
                .ok_or_else(|| bad(format!("`{k}` is not an integer"))),
            Some(Value::String(s)) => s.trim().parse().map(Some).map_err(|_| bad(format!("`{k}` is not an integer"))),
            Some(Value::Bool(b)) => Ok(Some(*b as i64)),
            Some(_) => Err(bad(format!("`{k}` is not an integer"))),
        }
    }
    fn i64_or(&self, k: &str, d: i64) -> Result<i64> {
        Ok(self.opt_i64(k)?.unwrap_or(d))
    }
    fn str(&self, k: &str) -> Result<String> {
        self.opt_str(k).ok_or_else(|| bad(format!("missing argument `{k}`")))
    }
    fn opt_str(&self, k: &str) -> Option<String> {
        match self.raw(k)? {
            Value::String(s) => Some(s.clone()),
            Value::Number(n) => Some(n.to_string()),
            Value::Bool(b) => Some(b.to_string()),
            _ => None,
        }
    }
    fn bool(&self, k: &str) -> Result<bool> {
        match self.raw(k) {
            Some(Value::Bool(b)) => Ok(*b),
            Some(Value::Number(n)) => Ok(n.as_i64().unwrap_or(0) != 0),
            Some(Value::String(s)) => Ok(matches!(s.as_str(), "true" | "1")),
            None => Err(bad(format!("missing argument `{k}`"))),
            _ => Err(bad(format!("`{k}` is not a boolean"))),
        }
    }
}

fn bad(m: String) -> CoreError {
    // Argument errors are caller bugs; `decode` is the closest contract code.
    CoreError::decode(m)
}

fn form(pairs: &[(&str, String)]) -> Vec<(String, String)> {
    pairs.iter().map(|(k, v)| ((*k).to_owned(), v.clone())).collect()
}

/// Encode one path segment (ids, pages are numeric; phrases/paths are not).
fn seg(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect::<String>().replace('+', "%20")
}

impl Core {
    pub async fn api(&self, op: &str, args: Value) -> Result<Value> {
        self.require_ready()?;
        let empty = Map::new();
        let a = Args(args.as_object().unwrap_or(&empty));
        let b = &self.backend;
        let v = match op {
            "preload" => to_json(&self.load_preload().await?),
            "home" => {
                let page = a.i64_or("page", 0)?;
                to_json(&b.proto::<Home>(BackendRequest::get(format!("/Ca8d5/data/home/{page}"))).await?)
            }
            "getMore" => {
                // Retrofit `@Path(encoded = true)`: the endpoint is sent as-is.
                let endpoint = a.str("endpoint")?;
                let endpoint = endpoint.trim_start_matches('/');
                let page = a.i64_or("page", 0)?;
                let req = BackendRequest::post(
                    format!("/Ca8d5/data/getmore/{endpoint}/{page}"),
                    form(&[("_plh", PLH.into())]),
                );
                to_json(&b.proto::<GetMore>(req).await?)
            }
            "item" => {
                let id = a.i64("id")?;
                to_json(&b.proto::<GenericTitle>(BackendRequest::get(format!("/Ca8d5/data/item/{id}"))).await?)
            }
            "itemDetail" => {
                let id = a.i64("id")?;
                to_json(&b.proto::<ItemDetail>(BackendRequest::get(format!("/Ca8d5/data/itemdetail/{id}"))).await?)
            }
            "files" => {
                let id = a.i64("id")?;
                to_json(
                    &b.proto::<TitleFilesV2>(BackendRequest::get(format!("/Ca8d5/UserStuff/GetFilesV2/{id}")))
                        .await?,
                )
            }
            "faq" => to_json(&b.proto::<Faq>(BackendRequest::get("/Ca8d5/data/faq")).await?),
            "search" => {
                let req = BackendRequest::post(
                    "/Ca8d5/operator/Search",
                    form(&[
                        ("Phrase", a.opt_str("phrase").unwrap_or_default()),
                        ("Type", a.i64_or("type", 0)?.to_string()),
                        ("IgnoreTypes", a.i64_or("ignoreTypes", 0)?.to_string()),
                        ("Page", a.i64_or("page", 0)?.to_string()),
                    ]),
                );
                to_json(&b.proto::<ISearch>(req).await?)
            }
            "likes" | "watches" => {
                let which = if op == "likes" { "GetLikes" } else { "GetWatches" };
                let page = a.i64_or("page", 0)?;
                let req = BackendRequest::post(
                    format!("/Ca8d5/UserStuff/{which}/{page}"),
                    form(&[("type", a.i64_or("type", 0)?.to_string())]),
                );
                to_json(&b.proto::<GetMore>(req).await?)
            }
            "removeWatch" => {
                let req = BackendRequest::post("/Ca8d5/UserStuff/RemoveWatch", form(&[("tid", a.i64("tid")?.to_string())]));
                b.bytes(req).await?;
                Value::Null
            }
            "like" => {
                let req = BackendRequest::post(
                    "/Ca8d5/operator/like",
                    form(&[
                        ("category", a.i64("category")?.to_string()),
                        ("item", a.i64("item")?.to_string()),
                        ("on", a.i64("on")?.to_string()),
                        ("status", a.bool("status")?.to_string()),
                    ]),
                );
                b.bytes(req).await?;
                Value::Null
            }
            "watch" => {
                let req = BackendRequest::post(
                    "/Ca8d5/operator/watch",
                    form(&[
                        ("fid", a.i64("fid")?.to_string()),
                        ("tid", a.i64("tid")?.to_string()),
                        ("length", a.i64("length")?.to_string()),
                        ("last", a.i64("last")?.to_string()),
                        ("on", a.i64("on")?.to_string()),
                    ]),
                );
                b.bytes(req).await?;
                Value::Null
            }
            "subtitles" => {
                let i = a.i64("i")?;
                let c = a.i64_or("c", 0)?;
                let path = match (a.opt_str("s"), a.opt_str("e")) {
                    (Some(s), Some(e)) => format!("/Ca8d5/r/{i}/{}/{}?C={c}", seg(&s), seg(&e)),
                    _ => format!("/Ca8d5/r/{i}?C={c}"),
                };
                to_json(&b.proto::<SubTitleParent>(BackendRequest::get(path)).await?)
            }
            "srt" => {
                // `@Path(encoded = true)`: sent as-is.
                let path = a.str("path")?;
                Value::String(b.text(BackendRequest::get(format!("/Ca8d5/srt/{}", path.trim_start_matches('/')))).await?)
            }
            "trailer" => {
                let lsi = a.str("lsi")?;
                let urn = a.str("urn")?;
                Value::String(b.text(BackendRequest::get(format!("/{}/trailer/{}", seg(&lsi), seg(&urn)))).await?)
            }
            "adProfile" => to_json(&b.proto::<AdProfile>(BackendRequest::get("/Ca8d5/UserStuff/adProfile")).await?),
            "getContentTypes" => {
                let (id, carry) = self.sessions.credentials()?;
                let req = BackendRequest::post(
                    "/Ca8d5/init/GetContentTypes",
                    form(&[("id", id.to_string()), ("carry", carry)]),
                );
                to_json(&b.proto::<Ctype>(req).await?)
            }
            "setContentTypes" => {
                let (id, carry) = self.sessions.credentials()?;
                let req = BackendRequest::post(
                    "/Ca8d5/init/SetContentTypes",
                    form(&[("id", id.to_string()), ("carry", carry), ("value", a.i64("value")?.to_string())]),
                );
                let o: OAuth = b.proto(req).await?;
                self.accept_oauth_update(o)?
            }
            "setBirth" => {
                let (id, carry) = self.sessions.credentials()?;
                let req = BackendRequest::post(
                    "/Ca8d5/init/setBirth",
                    form(&[("value", a.i64("value")?.to_string()), ("carry", carry), ("id", id.to_string())]),
                );
                let o: OAuth = b.proto(req).await?;
                self.accept_oauth_update(o)?
            }
            "playUrl" => {
                // Build the external play/download URL (mpv/VLC "copy link") the
                // Android app produces. `vurn`/`download` are accepted for contract
                // stability but do not change the URL: downloads use HTTP Range on
                // the same URL, and `vurn` addresses thumbnails, not the stream.
                let urn = a.str("urn")?;
                let _vurn = a.opt_str("vurn");
                let _download = a.opt_i64("download")?.map(|n| n != 0).unwrap_or(false);
                let port = a.opt_i64("port")?.map(|p| p as u16).unwrap_or(crate::media::DEFAULT_PORT);
                let file_id = a.opt_i64("id")?.unwrap_or(0);
                let preload = self
                    .preload_cached()
                    .ok_or_else(|| CoreError::unimplemented("preload not loaded yet"))?;
                if preload.salt.is_empty() {
                    return Err(CoreError::decode("PreLoad.Salt is empty".to_string()));
                }
                let url = crate::media::build_play_url(
                    &preload.salt,
                    &crate::media::PlayUrlParams { urn: &urn, file_id, port },
                );
                let mut obj = Map::new();
                obj.insert("url".into(), Value::String(url));
                obj.insert("filename".into(), Value::String(crate::media::urn_filename(&urn)));
                Value::Object(obj)
            }
            other => return Err(CoreError::unimplemented(format!("unknown op `{other}`"))),
        };
        Ok(v)
    }

    /// setBirth / SetContentTypes return an updated `OAuth`.
    fn accept_oauth_update(&self, o: OAuth) -> Result<Value> {
        let json = to_json(&o);
        if crate::session::oauth_ok(&o) {
            self.store_oauth(o)?;
        }
        Ok(json)
    }
}
