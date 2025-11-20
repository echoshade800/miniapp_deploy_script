# Miniapp 部署脚本使用说明

本项目提供了两个公共脚本用于统一管理所有 miniapp 的 iOS 部署和配置更新。

## 📁 脚本文件

- **`deploy_ios.sh`** - iOS 部署脚本
- **`update_monster_config.cjs`** - 配置更新脚本

## 🚀 快速开始

### 基本用法

从项目根目录运行部署脚本：

```bash
./deploy_ios.sh <miniapp_directory>
```

### 示例

```bash
# 部署 github_mini_app_919_block
./deploy_ios.sh github_mini_app_919_block

# 部署 github_mini_app_1014sp-wine
./deploy_ios.sh github_mini_app_1014sp-wine

# 部署 github_mini_app_1015sp-memora
./deploy_ios.sh github_mini_app_1015sp-memora
```

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
- `ios/` 目录 - 包含需要部署的 iOS 文件
- `index.tsx` - 包含 `AppRegistry.registerComponent` 调用（用于提取 module name）

## 🔧 脚本功能说明

### deploy_ios.sh

部署脚本会自动执行以下操作：

1. **验证目录和文件**
   - 检查 miniapp 目录是否存在
   - 验证 `package.json` 和 `ios/` 目录是否存在

2. **读取项目信息**
   - 从 `package.json` 读取 `name` 和 `version`
   - 从 `index.tsx` 提取 module name（通过解析 `AppRegistry.registerComponent`）

3. **打包和上传**
   - 压缩 `ios/` 目录下的所有文件为 `ios_${VERSION}.zip`
   - 上传到 S3: `s3://vsa-bucket-public-new/miniapps/${NAME}/`

4. **更新配置**
   - 自动调用 `update_monster_config.cjs` 更新 S3 中的配置 JSON

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
./deploy_ios.sh <miniapp_directory>
```

- `miniapp_directory` (必需) - miniapp 的目录名称，例如 `github_mini_app_919_block`

### update_monster_config.cjs

该脚本通常由 `deploy_ios.sh` 自动调用，但也可以手动运行：

```bash
node update_monster_config.cjs <name> <moduleName> <host>
```

- `name` (必需) - miniapp 的名称（来自 package.json）
- `moduleName` (必需) - React Native 注册的组件名称
- `host` (必需) - 部署文件的完整 URL

## 📦 部署流程

完整的部署流程如下：

```
1. 运行 ./deploy_ios.sh <miniapp_directory>
   ↓
2. 脚本进入目标 miniapp 目录
   ↓
3. 读取 package.json 获取 name 和 version
   ↓
4. 从 index.tsx 提取 module name
   ↓
5. 压缩 ios/ 目录为 ios_${VERSION}.zip
   ↓
6. 上传到 S3: s3://vsa-bucket-public-new/miniapps/${NAME}/
   ↓
7. 生成发布 URL: https://vsa-bucket-public-new.s3.amazonaws.com/miniapps/${NAME}/ios_${VERSION}.zip
   ↓
8. 调用 update_monster_config.cjs 更新配置
   ↓
9. 完成部署
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
node update_monster_config.cjs <name> <moduleName> <host>
```

## 📚 相关文件

- S3 配置 JSON: `https://vsa-bucket-public-new.s3.us-east-1.amazonaws.com/monster/index_config.json`
- S3 存储桶: `vsa-bucket-public-new`
- 部署文件路径: `s3://vsa-bucket-public-new/miniapps/{NAME}/ios_{VERSION}.zip`

## 💡 最佳实践

1. **版本管理**
   - 每次部署前更新 `package.json` 中的版本号
   - 使用语义化版本号（如 1.0.0, 1.0.1, 1.1.0）

2. **测试部署**
   - 在正式部署前，可以在测试环境验证脚本功能

3. **备份配置**
   - 在更新配置前，建议备份 S3 中的配置文件

4. **日志记录**
   - 脚本会输出详细的执行日志，便于排查问题

## 📞 支持

如有问题或建议，请联系项目维护者。

