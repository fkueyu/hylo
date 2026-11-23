fn main() {
    tauri_build::build();

    // 把 Info.plist 嵌入 macOS 主可执行文件（系统原生对话框本地化需要）。
    //
    // 注意：这个 link-arg 只能作用于 bin（rustc-link-arg-bins）。如果像旧版那样写在
    // .cargo/config.toml 的全局 rustflags 里，它会被应用到所有链接产物，包括
    // proc-macro dylib —— 在较新的 Xcode/ld 上会产出无法 dlopen 的损坏 Mach-O
    // （mis-aligned LINKEDIT string pool），导致 release 构建随机失败。
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let manifest_dir = std::path::PathBuf::from(
            std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set by cargo"),
        );
        let info_plist = manifest_dir.join("Info.plist");
        println!("cargo:rerun-if-changed=Info.plist");
        println!(
            "cargo:rustc-link-arg-bins=-Wl,-sectcreate,__TEXT,__info_plist,{}",
            info_plist.display()
        );
    }
}
