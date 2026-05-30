#![allow(dead_code)]

// Keep the current Rust Android runtime behavior while moving Android builds to
// a Cargo crate. This gives the ratatui/crossterm rewrite a stable package,
// target, and release boundary before the implementation is split into modules.
include!("../../android-host/main.rs");
