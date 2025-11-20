# Miniapp 部署脚本使用说明

本项目提供了两个公共脚本用于统一管理所有 miniapp 的 iOS 部署和配置更新。

## 📁 项目文件

### 脚本文件

- **`deploy_ios.sh`** - iOS 部署脚本
- **`update_monster_config.cjs`** - 配置更新脚本

### 配置文件

- **`.gitignore`** - Git 忽略文件配置
  - 忽略所有以 `github_mini` 开头的目录（如 `github_mini_app_*`）
  - 忽略 `node_modules/` 目录

## 🚀 快速开始

### 基本用法

从项目根目录运行部署脚本：

```bash
./deploy_ios.sh <miniapp_directory> [environment]
```

### 示例

```bash
# 部署到开发环境（默认）
./deploy_ios.sh github_mini_app_919_block
./deploy_ios.sh github_mini_app_919_block dev

# 部署到生产环境
./deploy_ios.sh github_mini_app_919_block prod

# 部署其他 miniapp
./deploy_ios.sh github_mini_app_1014sp-wine
./deploy_ios.sh github_mini_app_1015sp-memora prod
```

**环境参数说明：**
- `dev` (默认) - 开发环境，文件上传到 `s3://vsa-bucket-public-new/miniapps/${NAME}/`
- `prod` - 生产环境，文件上传到 `s3://vsa-bucket-public-new/monster/miniapps/${NAME}/`

## 📂 项目结构

本项目采用多 miniapp 管理结构：

```
monster_ai_miniapp/
├── .gitignore              # Git 忽略配置
├── deploy_ios.sh           # iOS 部署脚本
├── update_monster_config.cjs  # 配置更新脚本
├── package.json            # 根目录依赖配置
├── github_mini_app_*/      # 各个 miniapp 项目目录（被 .gitignore 忽略）
│   ├── package.json
│   ├── rnbundle/
│   └── index.tsx
└── ...
```

**注意：** 所有以 `github_mini` 开头的目录已被 `.gitignore` 配置忽略，不会被提交到 Git 仓库中。这些目录通常包含独立的 miniapp 项目，每个项目都有自己的依赖和构建产物。

## 📋 前置条件

### 1. AWS CLI 配置

确保已安装并配置 AWS CLI，并且具有访问 S3 的权限：

```bash
# 检查 AWS CLI 是否已安装
aws --version

# 配置 AWS 凭证（如果尚未配置）
aws configure
```

### 2. Node.js 依赖

确保目标 miniapp 项目中已安装 `@aws-sdk/client-s3` 依赖。通常该依赖已在各 miniapp 的 `package.json` 中定义。

### 3. 文件结构要求

目标 miniapp 目录必须包含以下文件：

- `package.json` - 包含 `name` 和 `version` 字段
- `index.tsx` - 包含 `AppRegistry.registerComponent` 调用（用于提取 module name）

**注意：** `rnbundle/` 目录会在部署过程中自动生成，无需预先存在。

## 🔧 脚本功能说明

### deploy_ios.sh

部署脚本会自动执行以下操作：

1. **执行 React Native Bundle**
   - 运行 `npx react-native bundle` 命令
   - 生成 `rnbundle/main.jsbundle` 和资源文件到 `rnbundle/` 目录
   - 使用生产模式打包（`--dev false`）

2. **验证目录和文件**
   - 检查 miniapp 目录是否存在
   - 验证 `package.json` 文件是否存在

3. **读取项目信息**
   - 从 `package.json` 读取 `name` 和 `version`
   - 从 `index.tsx` 提取 module name（通过解析 `AppRegistry.registerComponent`）

4. **打包和上传**
   - 压缩 `rnbundle/` 目录下的所有文件为 `${VERSION}.zip`
   - 根据环境参数上传到对应的 S3 路径：
     - 开发环境（dev）: `s3://vsa-bucket-public-new/miniapps/${NAME}/`
     - 生产环境（prod）: `s3://vsa-bucket-public-new/monster/miniapps/${NAME}/`

5. **更新配置**
   - 自动调用 `update_monster_config.cjs` 更新 S3 中的配置 JSON
   - 传递环境参数以更新对应环境的配置

### update_monster_config.cjs

配置更新脚本的功能：

1. **获取配置**
   - 从 S3 获取 `monster/index_config.json` 配置文件

2. **更新或添加配置项**
   - 如果找到匹配的 `name` 和 `module_name`，则更新 `releaseUrl`
   - 如果未找到匹配项，则添加新的配置项

3. **保存配置**
   - 将更新后的配置保存回 S3

## 📝 参数说明

### deploy_ios.sh

```bash
./deploy_ios.sh <miniapp_directory> [environment]
```

- `miniapp_directory` (必需) - miniapp 的目录名称，例如 `github_mini_app_919_block`
- `environment` (可选) - 部署环境，`dev`（默认）或 `prod`

### update_monster_config.cjs

该脚本通常由 `deploy_ios.sh` 自动调用，但也可以手动运行：

```bash
node update_monster_config.cjs <name> <moduleName> <releaseUrl> <environment>
```

- `name` (必需) - miniapp 的名称（来自 package.json）
- `moduleName` (必需) - React Native 注册的组件名称
- `releaseUrl` (必需) - 部署文件的完整 URL
- `environment` (必需) - 环境标识，`dev` 或 `prod`

## 📦 部署流程

完整的部署流程如下：

```
1. 运行 ./deploy_ios.sh <miniapp_directory> [environment]
   ↓
2. 脚本进入目标 miniapp 目录
   ↓
3. 执行 React Native Bundle 命令
   - 生成 rnbundle/main.jsbundle
   - 复制资源文件到 rnbundle/ 目录
   ↓
4. 读取 package.json 获取 name 和 version
   ↓
5. 从 index.tsx 提取 module name
   ↓
6. 压缩 rnbundle/ 目录为 ${VERSION}.zip
   ↓
7. 根据环境上传到 S3:
   - dev: s3://vsa-bucket-public-new/miniapps/${NAME}/
   - prod: s3://vsa-bucket-public-new/monster/miniapps/${NAME}/
   ↓
8. 生成发布 URL:
   - dev: https://vsa-bucket-public-new.s3.amazonaws.com/miniapps/${NAME}/${VERSION}.zip
   - prod: https://vsa-bucket-public-new.s3.amazonaws.com/monster/miniapps/${NAME}/${VERSION}.zip
   ↓
9. 调用 update_monster_config.cjs 更新配置（传递环境参数）
   ↓
10. 删除本地压缩文件
   ↓
11. 完成部署
```

## ⚠️ 注意事项

1. **执行权限**
   - 确保 `deploy_ios.sh` 具有执行权限
   - 如果没有，运行: `chmod +x deploy_ios.sh`

2. **工作目录**
   - 必须在项目根目录运行脚本
   - 脚本会自动切换到目标 miniapp 目录执行操作

3. **版本号**
   - 确保 `package.json` 中的 `version` 字段格式正确
   - 每次部署前建议更新版本号

4. **Module Name 提取**
   - 如果无法从 `index.tsx` 提取 module name，脚本会显示警告
   - 可以手动运行 `update_monster_config.cjs` 来更新配置

5. **S3 权限**
   - 确保 AWS 凭证具有以下权限：
     - `s3:PutObject` - 上传文件
     - `s3:GetObject` - 读取配置
     - `s3:PutObject` - 更新配置

## 🔍 故障排查

### 错误：无法从 package.json 中获取 version 字段

**解决方案：** 检查目标 miniapp 的 `package.json` 文件，确保包含有效的 `version` 字段。

### 错误：目录不存在

**解决方案：** 检查输入的目录名是否正确，确保目录存在于项目根目录下。

### 错误：上传到S3失败

**解决方案：**
- 检查 AWS CLI 配置是否正确
- 验证 S3 存储桶权限
- 确认网络连接正常

### 警告：无法从 index.tsx 中提取 module name

**解决方案：** 检查 `index.tsx` 文件，确保包含 `AppRegistry.registerComponent` 调用。可以手动运行：

```bash
node update_monster_config.cjs <name> <moduleName> <releaseUrl> <environment>
```

### 错误：iOS 打包失败

**解决方案：**
- 检查 React Native 环境是否正确配置
- 确保 `index.tsx` 文件存在且格式正确
- 检查是否有足够的磁盘空间
- 查看错误日志获取详细信息

## 📚 相关文件

- S3 配置 JSON: `https://vsa-bucket-public-new.s3.us-east-1.amazonaws.com/monster/index_config.json`
- S3 存储桶: `vsa-bucket-public-new`
- 开发环境部署路径: `s3://vsa-bucket-public-new/miniapps/{NAME}/{VERSION}.zip`
- 生产环境部署路径: `s3://vsa-bucket-public-new/monster/miniapps/{NAME}/{VERSION}.zip`

## 💡 最佳实践

1. **版本管理**
   - 每次部署前更新 `package.json` 中的版本号
   - 使用语义化版本号（如 1.0.0, 1.0.1, 1.1.0）

2. **版本控制**
   - 所有 `github_mini_app_*` 目录已被 `.gitignore` 忽略，不会提交到 Git
   - 如果需要版本控制某个 miniapp，可以将其移出 `github_mini_app_*` 命名规范，或修改 `.gitignore` 规则
   - 根目录的脚本和配置文件（如 `deploy_ios.sh`、`update_monster_config.cjs`）应提交到版本库

3. **环境管理**
   - 默认使用开发环境（dev）进行部署
   - 生产环境部署需要显式指定 `prod` 参数
   - 确保在不同环境使用正确的 S3 路径

4. **测试部署**
   - 在正式部署前，可以在开发环境验证脚本功能

4. **备份配置**
   - 在更新配置前，建议备份 S3 中的配置文件

5. **日志记录**
   - 脚本会输出详细的执行日志，便于排查问题

## 📞 支持

如有问题或建议，请联系项目维护者。

