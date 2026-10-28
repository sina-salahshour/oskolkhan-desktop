//! Contract JSON for protobuf messages:
//! proto field names verbatim, defaults emitted (`0`/`""`/`false`, `[]`, `null`),
//! ints as JSON numbers (64-bit too), bytes as base64.

use prost_reflect::{ReflectMessage, SerializeOptions};
use serde_json::Value;

fn options() -> SerializeOptions {
    SerializeOptions::new()
        .use_proto_field_name(true)
        .skip_default_fields(false)
        .stringify_64_bit_integers(false)
        .use_enum_numbers(true)
}

/// Serialize any generated message to contract JSON.
pub fn to_json<M: ReflectMessage>(msg: &M) -> Value {
    let dynamic = msg.transcode_to_dynamic();
    dynamic
        .serialize_with_options(serde_json::value::Serializer, &options())
        .unwrap_or(Value::Null)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::pmodel::{GenericTitle, Interfacess, OAuth, TitleFilesV2};

    #[test]
    fn oauth_defaults_and_names() {
        let v = to_json(&OAuth::default());
        let o = v.as_object().unwrap();
        assert_eq!(o["Name"], "");
        assert_eq!(o["VipLevel"], 0);
        assert_eq!(o["Vip"], false);
        assert_eq!(o["contentType"], 0);
        assert_eq!(o.len(), 13);
    }

    #[test]
    fn int64_numbers_bytes_base64_repeated() {
        let m = Interfacess {
            hash: 1234567890123,
            hs_n: vec![vec![1, 2, 3]],
            ..Default::default()
        };
        let v = to_json(&m);
        assert_eq!(v["hash"], serde_json::json!(1234567890123i64));
        assert_eq!(v["HsN"], serde_json::json!(["AQID"]));
        assert_eq!(v["items"], serde_json::json!([]));
        assert_eq!(v["TimeStamp"], 0);
    }

    #[test]
    fn absent_message_is_null_and_maps_present() {
        let v = to_json(&GenericTitle::default());
        // every singular message-typed field must be present as null
        let desc = GenericTitle::default().descriptor();
        for f in desc.fields() {
            assert!(v.get(f.name()).is_some(), "missing field {}", f.name());
            if f.kind().as_message().is_some() && !f.is_list() && !f.is_map() {
                assert!(v[f.name()].is_null(), "{} should be null", f.name());
            }
        }
        let t = to_json(&TitleFilesV2::default());
        assert!(t["InfoMap"].is_object());
    }
}
