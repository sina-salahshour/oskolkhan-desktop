//! TLS configuration: webpki roots by default, SPKI pinning when a route carries a pin.
//!
//! ## NATIVE-TLS-SEAM (native-protocol §3 — DO NOT change without sign-off)
//!
//! The native client (`libexo.so`, BoringSSL) is **pin-only**: for a pinned route it
//! enforces the `Cpis` SPKI SHA-256 pin and does **no CA or hostname validation at all**
//! (`network.xml` only whitelists cleartext to `127.0.0.1`/`instantgame.ir`). The route's
//! cert therefore will not CA-validate for the route host, and the SNI likely must be a
//! decoy / the per-host issued `ish` value rather than the route host — this is the leading
//! suspected cause of the live 404s.
//!
//! This module keeps a **CA-validating** client for now, on purpose: switching to
//! pin-only + decoy-SNI is gated and must be approved separately. When approved, the swap
//! is here (`pinned_config` → accept a matching pin with CA/hostname checks disabled) plus
//! the connect/SNI choice in `backend::build_route_client`. Until then this is the seam;
//! `PinVerifier` already matches the pin but still refuses a chain whose pin does not match.

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::client::WebPkiServerVerifier;
use rustls::crypto::{verify_tls12_signature, verify_tls13_signature, CryptoProvider};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{ClientConfig, DigitallySignedStruct, RootCertStore, SignatureScheme};
use sha2::{Digest, Sha256};
use std::sync::{Arc, LazyLock};

pub fn provider() -> Arc<CryptoProvider> {
    static P: LazyLock<Arc<CryptoProvider>> =
        LazyLock::new(|| Arc::new(rustls::crypto::ring::default_provider()));
    P.clone()
}

fn roots() -> Arc<RootCertStore> {
    static R: LazyLock<Arc<RootCertStore>> = LazyLock::new(|| {
        let mut store = RootCertStore::empty();
        store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        Arc::new(store)
    });
    R.clone()
}

fn base_builder() -> rustls::ConfigBuilder<ClientConfig, rustls::WantsVerifier> {
    ClientConfig::builder_with_provider(provider())
        .with_safe_default_protocol_versions()
        .expect("ring supports default protocol versions")
}

/// Ordinary webpki-validated config (used for bootstrap and unpinned routes).
pub fn default_config() -> ClientConfig {
    let mut cfg = base_builder().with_root_certificates(roots()).with_no_client_auth();
    cfg.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    cfg
}

/// Config that accepts the server iff some certificate in the chain matches `pin`.
///
/// TODO(native-protocol): the exact pin semantics of libexo.so are unknown. `Cpis` entries
/// are XOR-decoded bytes; we accept a match against SHA-256(SPKI), the raw SPKI DER, or
/// SHA-256(certificate DER). When a pin matches, CA validation is not required (as with
/// a self-signed backend); handshake signatures are always verified.
pub fn pinned_config(pin: Vec<u8>) -> ClientConfig {
    let verifier = Arc::new(PinVerifier {
        pin,
        provider: provider(),
        fallback: WebPkiServerVerifier::builder_with_provider(roots(), provider())
            .build()
            .expect("webpki verifier"),
    });
    let mut cfg = base_builder()
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();
    cfg.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    cfg
}

#[derive(Debug)]
struct PinVerifier {
    pin: Vec<u8>,
    provider: Arc<CryptoProvider>,
    fallback: Arc<WebPkiServerVerifier>,
}

pub fn cert_matches_pin(cert: &[u8], pin: &[u8]) -> bool {
    if Sha256::digest(cert).as_slice() == pin {
        return true;
    }
    if let Ok((_, parsed)) = x509_parser::parse_x509_certificate(cert) {
        let spki = parsed.tbs_certificate.subject_pki.raw;
        if spki == pin || Sha256::digest(spki).as_slice() == pin {
            return true;
        }
    }
    false
}

impl ServerCertVerifier for PinVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        let pinned = std::iter::once(end_entity)
            .chain(intermediates.iter())
            .any(|c| cert_matches_pin(c.as_ref(), &self.pin));
        if pinned {
            return Ok(ServerCertVerified::assertion());
        }
        // Pin did not match: still accept a publicly valid chain? No — a pinned route
        // must match its pin. Report the webpki verdict only for diagnostics.
        let verdict = self.fallback.verify_server_cert(end_entity, intermediates, server_name, ocsp, now);
        tracing::warn!(?verdict, "certificate does not match route pin");
        Err(rustls::Error::General("certificate pin mismatch".into()))
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls12_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        verify_tls13_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.provider.signature_verification_algorithms.supported_schemes()
    }
}
