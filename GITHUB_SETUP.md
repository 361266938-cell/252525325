# MiniNomad GitHub Actions 配置指南

## 前置条件
- GitHub 账号
- Git 已安装（本地已有）

## 步骤 1：创建 GitHub 仓库

1. 打开 https://github.com/new
2. Repository name: `MiniNomad-Android-AI`
3. 设为 **Public**（Private 也可，但 Actions 免费额度 Public 更宽）
4. **不要**勾选 "Add a README" / "Add .gitignore" / "Choose a license"（保持空仓）
5. 点击 "Create repository"

## 步骤 2：推送代码

在项目目录下执行：

```powershell
cd "C:\Users\Administrator\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\work-mode-projects\6aaf3d3b172d88f903e59c1b\MiniNomad-Android-AI"

# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/MiniNomad-Android-AI.git

# 推送
git push -u origin main
```

如果提示输入凭据：
- Username: 你的 GitHub 用户名
- Password: 使用 Personal Access Token（非密码），在 https://github.com/settings/tokens 生成，勾选 `repo` 权限

## 步骤 3：等待 Actions 自动构建

推送后 GitHub Actions 会自动触发：
1. 打开 https://github.com/YOUR_USERNAME/MiniNomad-Android-AI/actions
2. 看到 "Build Android APK" 工作流正在运行
3. 等待约 5-10 分钟（首次构建需下载 Gradle + Android SDK）

## 步骤 4：下载 APK

1. 点击完成的 workflow run
2. 拉到底部 "Artifacts" 区域
3. 点击 `minimonad-debug-apk` 下载
4. 解压得到 `app-debug.apk`

## 步骤 5：安装到手机

```powershell
# 通过 ADB 安装
adb install app-debug.apk
```

或者将 APK 传到手机直接安装（需开启"允许未知来源"）。

## 打 Tag 发布 Release

```powershell
git tag v1.0.0
git push origin v1.0.0
```

打 tag 后 Actions 会自动创建 GitHub Release 并附带 APK 下载。

## 工作流说明

| 触发条件 | 行为 |
|---|---|
| push 到 main/master | 构建 debug APK，上传 artifact |
| Pull Request | 构建 debug APK，在 PR 评论下载链接 |
| 打 tag (v*) | 构建 debug APK + 创建 GitHub Release |
| workflow_dispatch | 手动触发构建 |

## 本地构建 APK（可选）

如需本地编译，安装 Android Studio 后：

```powershell
cd android
# 复制 SDK 路径模板
Copy-Item local.properties.template local.properties
# 编辑 local.properties 填入 SDK 路径，如：
# sdk.dir=C:\Users\YourName\AppData\Local\Android\Sdk
.\gradlew.bat assembleDebug
```

APK 路径：`android/app/build/outputs/apk/debug/app-debug.apk`
