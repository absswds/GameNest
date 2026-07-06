# Android APK 打包指南 / Android APK Build Guide

本项目使用 **nodejs-mobile-android** 在 Android 设备上直接运行 Node.js 服务器。
打开 App → 自动启动 Node.js → WebView 显示游戏 → 顶部状态栏显示 LAN IP，其他设备访问即可联机。

This project uses **nodejs-mobile-android** to run the Node.js server directly on Android devices.
Open the app → Node.js starts automatically → WebView displays the game → the top status bar shows the LAN IP for other devices to connect.

---

## 一、前置准备 / Prerequisites

### 1.1 安装 Android Studio / Install Android Studio

下载并安装最新版 Android Studio
Download and install the latest Android Studio: https://developer.android.com/studio

### 1.2 安装 NDK（CMake 用）/ Install NDK (for CMake)

本项目使用 CMake 编译 JNI 桥接代码（`app/src/main/cpp/native-lib.cpp`），所以需要 NDK：
This project uses CMake to compile the JNI bridge (`app/src/main/cpp/native-lib.cpp`), so NDK is required:

- 打开 Android Studio → **Tools → SDK Manager → SDK Tools** 标签页 / tab
- 勾选 **NDK (Side by side)** 和 **CMake**
- 点击 Apply 安装（约 1-2 GB）/ Click Apply to install (~1-2 GB)

### 1.3 下载 nodejs-mobile 预编译库 / Download nodejs-mobile prebuilt lib

nodejs-mobile 的原生库需要单独下载（不在 Maven 仓库）：
nodejs-mobile native libraries must be downloaded separately (not in Maven):

1. 访问 / Visit https://github.com/nodejs-mobile/nodejs-mobile/releases
2. 下载最新版本的 Android distribution：`nodejs-mobile-vX.X.X-android.zip` / Download the latest Android distribution
3. 解压后，将其中各 ABI 的 `libnode.so` 复制到本项目对应位置：
   Extract and copy `libnode.so` for each ABI to the project paths below:

```
android/app/libs/jniLibs/
├── arm64-v8a/libnode.so       (真机必需 - 现代 Android 手机 / Modern Android phones)
├── armeabi-v7a/libnode.so     (老款真机 / Older phones)
└── x86_64/libnode.so          (模拟器 / Emulator)
```

> 注：本项目不使用 .aar 集成方式。Node.js 运行时通过 CMake + `app/src/main/cpp/native-lib.cpp` 直接链接 `libnode.so`，所以**只需 .so 文件**，不需要 .aar。
> Note: This project does not use the .aar integration. The Node.js runtime links `libnode.so` directly via CMake + `app/src/main/cpp/native-lib.cpp`, so **only the .so files** are needed, not the .aar.

---

## 二、复制 Node.js 项目到 Android 资源 / Copy Node.js Project to Android Assets

每次修改 `server.js`、`games/`、`bots/`、`public/` 后都要重新复制：
Re-run this after every change to `server.js`, `games/`, `bots/`, or `public/`:

```powershell
cd android
.\copy-nodejs-project.ps1
```

脚本会自动 / The script will:
- 清理旧的 `app/src/main/assets/nodejs-project/` / Clean old assets
- 复制 server.js、main.js、games/、bots/、public/、node_modules/、package.json / Copy project files
- 删除 node_modules 中的 README、文档、测试文件以缩小 APK / Strip docs and tests from node_modules to reduce APK size

---

## 三、在 Android Studio 中打开项目 / Open in Android Studio

1. 启动 Android Studio / Launch Android Studio
2. **File → Open** → 选择项目下的 `android` 目录 / Select the `android` directory
3. 等待 Gradle 同步完成（首次需要下载依赖，约 5-10 分钟）/ Wait for Gradle sync (~5-10 min on first run)
4. 如果提示 SDK 缺失，按提示安装 / Install any missing SDK components if prompted

---

## 四、构建并运行 / Build and Run

### 4.1 模拟器测试 / Emulator

1. 在 Android Studio 顶部工具栏选择一个 AVD（虚拟设备）/ Select an AVD in the toolbar
2. 点击绿色三角形 ▶ Run 按钮 / Click the green ▶ Run button
3. App 启动后会看到 splash → 服务器就绪后显示游戏大厅 / Splash screen → game lobby after server is ready

### 4.2 真机测试 / Physical Device

1. 手机开启「开发者选项」→「USB 调试」/ Enable Developer Options → USB Debugging
2. USB 连接电脑，Android Studio 会识别设备 / Connect via USB, Android Studio will detect the device
3. 选择你的设备，点击 Run / Select your device, click Run
4. **测试联机 / Testing multiplayer:** 手机开启移动热点 → 另一台设备连接此热点 → 浏览器访问 App 顶部显示的 IP / Turn on mobile hotspot → connect another device → browse to the IP shown in the app's status bar

### 4.3 构建 Release APK / Build Release APK

```powershell
cd android
.\gradlew assembleRelease
```

APK 输出位置 / Output: `app/build/outputs/apk/release/app-release-unsigned.apk`

需要签名才能在真机安装 / Must be signed for device installation:
```powershell
.\gradlew bundleRelease
# 或者用 Android Studio 的 Build → Generate Signed APK 向导 / Or use Android Studio: Build → Generate Signed APK
```

---

## 五、目录结构 / Directory Structure

```
android/
├── build.gradle                          # 项目级 Gradle / Project-level Gradle
├── settings.gradle                       # 项目设置 / Project settings
├── gradle.properties                     # Gradle 属性 / Gradle properties
├── gradle/wrapper/                       # Gradle Wrapper
├── copy-nodejs-project.ps1               # Node.js 项目复制脚本 / Copy script
├── SETUP.md                              # 本文件 / This file
└── app/
    ├── build.gradle                      # App 级 Gradle（含 nodejs-mobile 依赖）/ App-level Gradle
    ├── proguard-rules.pro                # ProGuard 混淆规则 / ProGuard rules
    ├── libs/                             # jniLibs/ 存放 libnode.so / Contains libnode.so
    └── src/main/
        ├── AndroidManifest.xml           # 权限和入口 / Permissions and entry point
        ├── java/com/gamenest/app/
        │   └── MainActivity.kt           # 启动 Node.js + WebView + 显示 IP / Start Node.js + WebView + show IP
        ├── res/
        │   ├── layout/activity_main.xml  # WebView + 顶部状态栏 + Splash / WebView + top bar + splash
        │   ├── values/colors.xml         # 镜像 web 端的配色 / Match web color scheme
        │   ├── values/themes.xml
        │   ├── values/strings.xml
        │   ├── drawable/                 # Adaptive icon 矢量图 / Vector adaptive icon
        │   ├── mipmap-anydpi-v26/        # Adaptive icon 容器 / Adaptive icon container
        │   └── xml/                      # 网络安全和备份规则 / Network security and backup rules
        └── assets/
            └── nodejs-project/           # 由 copy-nodejs-project.ps1 填充 / Populated by copy-nodejs-project.ps1
                ├── server.js
                ├── main.js
                ├── games/
                ├── bots/
                ├── public/
                └── node_modules/
```

---

## 六、常见问题 / FAQ

**Q: Gradle 同步失败？/ Gradle sync fails?**
- 检查 Android Studio 的 JDK 版本（需要 17+）/ Check JDK version (17+ required)
- 检查网络（首次需要从 JitPack/Maven Central 下载依赖）/ Check internet (first run downloads from JitPack/Maven Central)

**Q: App 启动崩溃？/ App crashes on launch?**
- 查看 Logcat 标签 `LocalGames` 和 `NodeJS` / Check Logcat tags `LocalGames` and `NodeJS`
- 确认 `libs/jniLibs/<abi>/libnode.so` 文件存在 / Verify `libs/jniLibs/<abi>/libnode.so` exists
- 确认 `assets/nodejs-project/main.js` 存在 / Verify `assets/nodejs-project/main.js` exists

**Q: 服务器启动后 WebView 是空白？/ WebView is blank after server starts?**
- 检查 Logcat 是否有 "server_ready" 消息 / Check Logcat for "server_ready"
- 在 WebView 设备上手动访问 `http://localhost:3000` / Manually visit `http://localhost:3000` on the device

**Q: 其他设备连不上？/ Other devices can't connect?**
- 确认两台设备在同一 WiFi 或热点 / Ensure devices are on the same WiFi or hotspot
- 顶部状态栏显示的 IP 必须是 192.168.x.x 而非 127.0.0.1 / The IP shown must be 192.168.x.x, not 127.0.0.1
- Android 防火墙可能拦截，部分品牌手机需要在系统设置允许 App 的"局域网"权限 / Android firewall may block; some brands need local network permission in system settings

**Q: APK 太大？/ APK is too large?**
- `node_modules/` 是主要占用，可以在 `copy-nodejs-project.ps1` 中扩展清理规则 / `node_modules/` is the main contributor; extend cleanup rules in `copy-nodejs-project.ps1`
- 也可以用 `abiFilters` 只构建特定 ABI（如只保留 arm64-v8a，APK 体积减半）/ Use `abiFilters` to target a single ABI (e.g., arm64-v8a halves APK size)

---

## 七、参考资料 / References

- nodejs-mobile 项目主页 / Project page: https://github.com/nodejs-mobile/nodejs-mobile
- nodejs-mobile-android 文档 / Docs: https://github.com/nodejs-mobile/nodejs-mobile/tree/main/tools/android-sample
- WebView 调试 / Debugging: chrome://inspect/#devices (Chrome 浏览器 / Chrome browser)
