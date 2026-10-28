//! `SuperLoaderBytes` — the wrapper for manual `.osbin`/`.bin`/`.okx` imports and anything
//! the server hands back pre-wrapped (native-protocol §1, VERIFIED(oracle)).
//!
//! Algorithm (libexo.so `sub_3cd9cc`): XOR the whole buffer byte-wise with the constant
//! `0x33`, which turns the file magic `1B 86 1C CE` into the ZSTD magic `28 B5 2F FD`,
//! then decompress a single standard zstd frame. No key, no IV, no MAC — the XOR constant
//! is the only secret and it is fixed in code.
//!
//! The output is a `PModel.interfacess` protobuf; its obfuscated strings and pins are then
//! XOR'd with the single-byte key in `interfacess.key` (handled in `routing`).

use crate::error::{CoreError, Result};

/// The fixed whole-buffer XOR constant.
pub const XOR_CONST: u8 = 0x33;
/// ZSTD frame magic (little-endian `0xFD2FB528`).
pub const ZSTD_MAGIC: [u8; 4] = [0x28, 0xB5, 0x2F, 0xFD];
/// File magic of a SuperLoader-wrapped blob: `ZSTD_MAGIC ^ 0x33` (`splash.f45118I`).
pub const WRAPPED_MAGIC: [u8; 4] = [0x1B, 0x86, 0x1C, 0xCE];

/// True if `bytes` starts with the SuperLoader magic (`1B 86 1C CE`).
pub fn is_wrapped(bytes: &[u8]) -> bool {
    bytes.starts_with(&WRAPPED_MAGIC)
}

/// Decode a `SuperLoaderBytes` blob: `zstd_decompress(buffer XOR 0x33)`.
pub fn super_loader_bytes(input: &[u8]) -> Result<Vec<u8>> {
    let mut buf: Vec<u8> = input.to_vec();
    for b in &mut buf {
        *b ^= XOR_CONST;
    }
    if buf.len() < 4 || buf[..4] != ZSTD_MAGIC {
        return Err(CoreError::decode(format!(
            "after XOR 0x33 the buffer is not a ZSTD frame (magic {:02x?})",
            buf.get(..4).unwrap_or(&buf)
        )));
    }
    // A single standard zstd frame; the frame may omit the content size, so decode as a
    // stream (equivalent to the Python oracle's stream_reader fallback).
    zstd::stream::decode_all(buf.as_slice())
        .map_err(|e| CoreError::decode(format!("zstd decompress failed: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proto::pmodel::Interfacess;
    use crate::routing;
    use prost::Message;
    use sha2::{Digest, Sha256};

    /// Golden vector from native-protocol §1 / `re/golden_vector.sha256`.
    const INPUT: &[u8] = include_bytes!("../tests/fixtures/StarterOskol-08-16-2026.bin");
    const INPUT_SHA256: &str = "cd0bee2a534dcd074592a403eef19de0a21b349034e95094fab7feb7887148b1";
    const OUTPUT_SHA256: &str = "4be2aae99d865a4af2c00aafc56a53ec9d8ac3d3ef78c15662aea68e60606b07";

    fn hex_sha256(data: &[u8]) -> String {
        hex::encode(Sha256::digest(data))
    }

    #[test]
    fn golden_vector_reproduces_exact_hashes() {
        assert_eq!(INPUT.len(), 46_484);
        assert_eq!(hex_sha256(INPUT), INPUT_SHA256, "fixture input hash drifted");
        assert!(is_wrapped(INPUT));

        let out = super_loader_bytes(INPUT).expect("decode golden vector");
        assert_eq!(out.len(), 103_932);
        assert_eq!(hex_sha256(&out), OUTPUT_SHA256, "SuperLoaderBytes output hash mismatch");
        // output[0:4] == 08 AE 01 12 (field 1 = key = 174).
        assert_eq!(&out[..4], &[0x08, 0xAE, 0x01, 0x12]);
    }

    #[test]
    fn golden_output_parses_as_interfacess_with_routes() {
        let out = super_loader_bytes(INPUT).expect("decode");
        let t = Interfacess::decode(out.as_slice()).expect("parse interfacess");
        // Golden: key = 174, 21 route groups, 37 host names, hash set.
        assert_eq!(t.key, 174);
        assert_eq!(t.items.len(), 21);
        assert_eq!(t.hs_n.len(), 37);
        assert_ne!(t.hash, 0);
        assert!(routing::interfacess_is_valid(&t));

        let table = routing::RoutingTable::from_interfacess(t);
        assert!(!table.routes.is_empty(), "no routes decoded from golden interfacess");
        // De-obfuscated host names must look like real hostnames.
        assert!(table.routes.iter().any(|r| r.host.contains('.')));
    }
}
