//! TLS configuration.
//!
//! Two worlds:
//! - **Public internet** (`default_config`): ordinary WebPKI validation, used by the
//!   bootstrap/DoH client for GitHub/blogfa/aparat/DoH fetches — those are real public hosts.
//! - **Backend routes** (`route_config`): the app's own **certificate-pinning** scheme.
//!
//! ## NATIVE-TLS-SEAM (native-protocol §10/§11 — RESOLVED, LIVE-VERIFIED 2026-10-29)
//!
//! `libexo.so` (BoringSSL) is **pin-only** on a backend route: it verifies the server leaf's
//! SubjectPublicKeyInfo SHA-256 against the route's `Cpis` pin and does **no CA or hostname
//! validation**. The route cert is a camouflage CN that will not chain to a public CA for the
//! route host, so WebPKI cannot be used — the pin is the trust anchor instead, which is a
//! strictly *stronger* check than CA for these routes (this is pinning, not disabled security).
//! Bootstrap/`hell` rows carry no pin (`initZero` passes none), so any cert is accepted there.
//!
//! `route_config(pin)` builds the verifier swappable and keyed off the active route's pin:
//! `Some(pin)` ⇒ enforce the SPKI pin; `None` ⇒ accept any cert (bootstrap). SNI = Host =
//! the route hostname is set by reqwest from the request URL authority (see `backend`).

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
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

fn with_alpn(mut cfg: ClientConfig) -> ClientConfig {
    cfg.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    cfg
}

/// Ordinary WebPKI-validated config — for the public bootstrap/DoH client only.
pub fn default_config() -> ClientConfig {
    with_alpn(base_builder().with_root_certificates(roots()).with_no_client_auth())
}

/// Per-route TLS config (the NATIVE-TLS-SEAM). `pin = Some(..)` enforces the SPKI pin;
/// `pin = None` accepts any cert (unpinned bootstrap/`hell` rows). No CA/hostname checks.
pub fn route_config(pin: Option<Vec<u8>>) -> ClientConfig {
    let verifier = Arc::new(RouteVerifier { pin, provider: provider() });
    with_alpn(
        base_builder()
            .dangerous()
            .with_custom_certificate_verifier(verifier)
            .with_no_client_auth(),
    )
}

/// True if `pin` matches the certificate's pinned material. The live `Cpis` pin is
/// `SHA-256(SPKI)` (32 bytes, native-protocol §2/§10.5); we also accept the raw SPKI DER
/// and `SHA-256(cert DER)` so a table that encodes a pin differently still verifies.
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

/// `SHA-256(SPKI)` of a certificate — the canonical pin form (HPKP `sha256//<b64>`).
pub fn spki_sha256(cert: &[u8]) -> Option<[u8; 32]> {
    let (_, parsed) = x509_parser::parse_x509_certificate(cert).ok()?;
    Some(Sha256::digest(parsed.tbs_certificate.subject_pki.raw).into())
}

#[derive(Debug)]
struct RouteVerifier {
    /// `Some` ⇒ enforce this SPKI pin; `None` ⇒ accept any cert (bootstrap/`hell`).
    pin: Option<Vec<u8>>,
    provider: Arc<CryptoProvider>,
}

impl ServerCertVerifier for RouteVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        // Faithful to libexo: no CA/hostname validation. Only the leaf SPKI pin is checked.
        match &self.pin {
            Some(pin) if cert_matches_pin(end_entity.as_ref(), pin) => {
                Ok(ServerCertVerified::assertion())
            }
            Some(_) => Err(rustls::Error::General("certificate pin mismatch".into())),
            None => Ok(ServerCertVerified::assertion()),
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    // A self-signed leaf so we have a real cert + SPKI to pin against (offline).
    fn self_signed() -> (Vec<u8>, [u8; 32]) {
        let cert = rcgen::generate_simple_self_signed(vec!["camouflage.example".into()]).unwrap();
        let der = cert.cert.der().to_vec();
        let spki = spki_sha256(&der).unwrap();
        (der, spki)
    }

    #[test]
    fn spki_pin_matches_and_mismatches() {
        let (der, spki) = self_signed();
        assert!(cert_matches_pin(&der, &spki), "SPKI SHA-256 pin must match");
        assert!(!cert_matches_pin(&der, &[0u8; 32]), "a wrong pin must not match");
        // A base64 pin (as the live table carries) decodes to the same 32 bytes.
        let b64 = base64::engine::general_purpose::STANDARD.encode(spki);
        let decoded = base64::engine::general_purpose::STANDARD.decode(b64).unwrap();
        assert_eq!(decoded.len(), 32);
        assert!(cert_matches_pin(&der, &decoded));
    }
}
