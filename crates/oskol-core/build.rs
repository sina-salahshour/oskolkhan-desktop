use std::path::PathBuf;

fn main() {
    let proto_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("proto");
    let files = [proto_dir.join("pmodel.proto"), proto_dir.join("clientbin.proto")];
    for f in &files {
        println!("cargo:rerun-if-changed={}", f.display());
    }
    if std::env::var_os("PROTOC").is_none() && std::path::Path::new("/usr/bin/protoc").exists() {
        // SAFETY: build scripts are single-threaded at this point.
        unsafe { std::env::set_var("PROTOC", "/usr/bin/protoc") };
    }
    let mut config = prost_build::Config::new();
    config.btree_map(["."]);
    prost_reflect_build::Builder::new()
        .descriptor_pool("crate::proto::DESCRIPTOR_POOL")
        .compile_protos_with_config(config, &files, &[proto_dir])
        .expect("compile protos");
}
