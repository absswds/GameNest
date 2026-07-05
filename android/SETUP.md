# Android APK 打包指南

本项目使用 **nodejs-mobile-android** 在 Android 设备上直接运行 Node.js 服务器。
打开 App → 自动启动 Node.js → WebView 显示游戏 → 顶部状态栏显示 LAN IP，其他设备访问即可联机。

---

## 一、前置准备

### 1.1 安装 Android Studio
下载并安装最新版 Android Studio：https://developer.android.com/studio

### 1.2 安装 NDK（CMake 用）
本项目使用 CMake 编译 JNI 桥接代码（`app/src/main/cpp/native-lib.cpp`），所以需要 NDK：

- 打开 Android Studio → **Tools → SDK Manager → SDK Tools** 标签页
- 勾选 **NDK (Side by side)** 和 **CMake**
- 点击 Apply 安装（约 1-2 GB）

### 1.3 下载 nodejs-mobile 预编译库

nodejs-mobile 的原生库需要单独下载（不在 Maven 仓库）：

1. 访问 https://github.com/nodejs-mobile/nodejs-mobile/releases
2. 下载最新版本的 Android distribution：`nodejs-mobile-vX.X.X-android.zip`
3. 解压后，将其中各 ABI 的 `libnode.so` 复制到本项目对应位置：

```
android/app/libs/jniLibs/
├── arm64-v8a/libnode.so       (真机必需 - 现代 Android 手机)
├── armeabi-v7a/libnode.so     (老款真机)
└── x86_64/libnode.so          (模拟器)
```

> 注：本项目不使用 .aar 集成方式。Node.js 运行时通过 CMake + `app/src/main/cpp/native-lib.cpp` 直接链接 `libnode.so`，所以**只需 .so 文件**，不需要 .aar。

---

## 二、复制 Node.js 项目到 Android 资源

每次修改 `server.js`、`games/`、`bots/`、`public/` 后都要重新复制：

```powershell
cd android
.\copy-nodejs-project.ps1
```

脚本会自动：
- 清理旧的 `app/src/main/assets/nodejs-project/`
- 复制 server.js、main.js、games/、bots/、public/、node_modules/、package.json
- 删除 node_modules 中的 README、文档、测试文件以缩小 APK

---

## 三、在 Android Studio 中打开项目

1. 启动 Android Studio
2. **File → Open** → 选择项目下的 `android` 目录
3. 等待 Gradle 同步完成（首次需要下载依赖，约 5-10 分钟）
4. 如果提示 SDK 缺失，按提示安装

---

## 四、构建并运行

### 4.1 模拟器测试
1. 在 Android Studio 顶部工具栏选择一个 AVD（虚拟设备）
2. 点击绿色三角形 ▶ Run 按钮
3. App 启动后会看到 splash → 服务器就绪后显示游戏大厅

### 4.2 真机测试
1. 手机开启「开发者选项」→「USB 调试」
2. USB 连接电脑，Android Studio 会识别设备
3. 选择你的设备，点击 Run
4. **测试联机：** 手机开启移动热点 → 另一台设备连接此热点 → 浏览器访问 App 顶部显示的 IP

### 4.3 构建 Release APK
```powershell
cd android
.\gradlew assembleRelease
```
APK 输出位置：`app/build/outputs/apk/release/app-release-unsigned.apk`

需要签名才能在真机安装：
```powershell
.\gradlew bundleRelease
# 或者用 Android Studio 的 Build → Generate Signed APK 向导
```

---

## 五、目录结构

```
android/
├── build.gradle                          # 项目级 Gradle
├── settings.gradle                       # 项目设置
├── gradle.properties                     # Gradle 属性
├── gradle/wrapper/                       # Gradle Wrapper
├── copy-nodejs-project.ps1               # Node.js 项目复制脚本
├── SETUP.md                              # 本文件
└── app/
    ├── build.gradle                      # App 级 Gradle（含 nodejs-mobile 依赖）
    ├── proguard-rules.pro                # ProGuard 混淆规则
    ├── libs/                             # 需手动放置 nodejs-mobile.aar 和 jniLibs/
    └── src/main/
        ├── AndroidManifest.xml           # 权限和入口
        ├── java/com/localgames/app/
        │   └── MainActivity.kt           # 启动 Node.js + WebView + 显示 IP
        ├── res/
        │   ├── layout/activity_main.xml  # WebView + 顶部状态栏 + Splash
        │   ├── values/colors.xml         # 镜像 web 端的配色
        │   ├── values/themes.xml
        │   ├── values/strings.xml
        │   ├── drawable/                 # Adaptive icon 矢量图
        │   ├── mipmap-anydpi-v26/        # Adaptive icon 容器
        │   └── xml/                      # 网络安全和备份规则
        └── assets/
            └── nodejs-project/           # 由 copy-nodejs-project.ps1 填充
                ├── server.js
                ├── main.js
                ├── games/
                ├── bots/
                ├── public/
                └── node_modules/
```

---

## 六、常见问题

**Q: Gradle 同步失败？**
- 检查 Android Studio 的 JDK 版本（需要 17+）
- 检查网络（首次需要从 JitPack/Maven Central 下载依赖）

**Q: App 启动崩溃？**
- 查看 Logcat 标签 `LocalGames` 和 `NodeJS`
- 确认 `libs/jniLibs/<abi>/libnode.so` 文件存在
- 确认 `assets/nodejs-project/main.js` 存在

**Q: 服务器启动后 WebView 是空白？**
- 检查 Logcat 是否有 "server_ready" 消息
- 在 WebView 设备上手动访问 `http://localhost:3000`

**Q: 其他设备连不上？**
- 确认两台设备在同一 WiFi 或热点
- 顶部状态栏显示的 IP 必须是 192.168.x.x 而非 127.0.0.1
- Android 防火墙可能拦截，部分品牌手机需要在系统设置允许 App 的"局域网"权限

**Q: APK 太大？**
- `node_modules/` 是主要占用，可以在 `copy-nodejs-project.ps1` 中扩展清理规则
- 也可以用 `abiFilters` 只构建特定 ABI（如只保留 arm64-v8a，APK 体积减半）

---

## 七、参考资料

- nodejs-mobile 项目主页: https://github.com/nodejs-mobile/nodejs-mobile
- nodejs-mobile-android 文档: https://github.com/nodejs-mobile/nodejs-mobile/tree/main/tools/android-sample
- WebView 调试: chrome://inspect/#devices (Chrome 浏览器)
