# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-05-20

### Added
- 新增软件自动更新与手动更新检查功能。
- 在前端集成基于毛玻璃高颜值特效的软件升级状态提示弹窗 `UpdateModal`。
- 实现启动自动静默检测更新、右键菜单点击手动检测更新，提供进度条和自动重启覆盖安装支持。
- 将更新数据分发源和包存放源设计为私有服务器 `ainx.ink`，全面解决国内用户访问和更新缓慢的问题。
- 在 GitHub Actions 工作流中集成基于私钥 `TAURI_SIGNING_PRIVATE_KEY` 变量的安全自动数字签名机制。

## [0.1.1] - 2026-05-19

### Added
- 新增 GitHub Actions 自动 CI/CD 构建工作流，实现 macOS (Universal), Windows, Linux 三端安装包的自动编译与 Release 发布。
- 新增 GitHub Actions 触发时自动利用 Git commits 生成 Releases 页面更新记录的功能 (`generateReleaseNotes`)。

### Fixed
- 修复 Node 22+ 环境下因 `fs.rmdirSync` 选项废弃导致项目 Vite 开发服务器启动崩溃的兼容性问题。
- 修复因缺少 `core:window:allow-start-dragging` 权限导致的 Tauri 窗口无法拖拽的问题。
- 重构标题栏拖拽逻辑，将拖拽区域直接绑定到 header 级元素并设置为 `drag`，且将左区和右区控制层设为 `no-drag`，移除原有的绝对定位占位层，彻底解决了层级遮挡引起的拖动失效问题。
