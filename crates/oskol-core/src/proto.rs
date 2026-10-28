//! Generated protobuf types (Wire models transcribed in `proto/`), plus the
//! reflection pool used for contract-shaped JSON.
#![allow(non_snake_case, non_camel_case_types, clippy::all, missing_docs)]

use prost_reflect::DescriptorPool;
use std::sync::LazyLock;

pub static DESCRIPTOR_POOL: LazyLock<DescriptorPool> = LazyLock::new(|| {
    DescriptorPool::decode(
        include_bytes!(concat!(env!("OUT_DIR"), "/file_descriptor_set.bin")).as_ref(),
    )
    .expect("embedded descriptor set is valid")
});

/// `package PModel;`
pub mod pmodel {
    include!(concat!(env!("OUT_DIR"), "/p_model.rs"));
}

/// `package ClientBinModel;`
pub mod clientbin {
    include!(concat!(env!("OUT_DIR"), "/client_bin_model.rs"));
}
