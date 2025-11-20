#!/bin/bash



# 检查是否提供了 miniapp 目录名参数
if [ -z "$1" ]; then
  echo "错误：请提供 miniapp 目录名作为参数"
  echo "用法: ./deploy_ios.sh <miniapp_directory> [environment]"
  echo "示例: ./deploy_ios.sh github_mini_app_919_block dev"
  echo "示例: ./deploy_ios.sh github_mini_app_919_block prod"
  echo "环境参数: dev (开发环境) 或 prod (生产环境)，默认为 dev"
  exit 1
fi

MINIAPP_DIR="$1"
ENVIRONMENT="${2:-dev}"  # 第二个参数，默认为 dev

# 验证环境参数
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
  echo "错误：环境参数必须是 'dev' 或 'prod'"
  echo "当前值: ${ENVIRONMENT}"
  exit 1
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINIAPP_PATH="${SCRIPT_DIR}/${MINIAPP_DIR}"

# 进入 miniapp 目录
cd "$MINIAPP_PATH" || exit 1

# 执行 iOS 打包命令
echo "正在执行 iOS 打包: npx react-native bundle --platform ios --dev false --entry-file index.tsx --bundle-output rnbundle/main.jsbundle --assets-dest rnbundle ..."
npx react-native bundle --platform ios --dev false --entry-file index.tsx --bundle-output rnbundle/main.jsbundle --assets-dest rnbundle
if [ $? -ne 0 ]; then
  echo "iOS 打包失败，请检查日志"
  exit 1
fi

# 返回脚本所在目录，继续后续流程
cd "$SCRIPT_DIR"


# 检查 miniapp 目录是否存在
if [ ! -d "$MINIAPP_PATH" ]; then
  echo "错误：目录不存在: ${MINIAPP_PATH}"
  exit 1
fi

# 进入 miniapp 目录
cd "$MINIAPP_PATH" || exit 1

# 检查 package.json 是否存在
if [ ! -f "package.json" ]; then
  echo "错误：在 ${MINIAPP_PATH} 中找不到 package.json"
  exit 1
fi

# 从package.json中获取version字段
VERSION=$(grep '"version"' package.json | cut -d '"' -f4)

NAME=$(grep '"name"' package.json | cut -d '"' -f4)

# 检查是否成功获取版本号
if [ -z "$VERSION" ]; then
  echo "错误：无法从package.json中获取version字段"
  exit 1
fi

# 检查是否成功获取名称
if [ -z "$NAME" ]; then
  echo "错误：无法从package.json中获取name字段"
  exit 1
fi

echo "extracted VERSION: ${VERSION}; NAME: ${NAME}"

# 定义压缩文件名
ZIP_FILE="${VERSION}.zip"

# 压缩ios目录下的所有文件
echo "正在将 ${MINIAPP_PATH}/rnbundle 目录下的文件压缩到 ${ZIP_FILE}..."
zip -r "$ZIP_FILE" rnbundle/*

# 检查压缩是否成功
if [ $? -ne 0 ]; then
  echo "错误：压缩文件失败"
  exit 1
fi

# 根据环境设置 S3 路径
if [ "$ENVIRONMENT" = "prod" ]; then
  S3_PATH="s3://vsa-bucket-public-new/monster/miniapps/${NAME}/"
  S3_URL_PREFIX="https://vsa-bucket-public-new.s3.amazonaws.com/monster/miniapps/${NAME}/"
else
  S3_PATH="s3://vsa-bucket-public-new/miniapps/${NAME}/"
  S3_URL_PREFIX="https://vsa-bucket-public-new.s3.amazonaws.com/miniapps/${NAME}/"
fi

# 上传到S3
echo "正在上传 ${ZIP_FILE} 到S3 (环境: ${ENVIRONMENT})..."
echo "S3 路径: ${S3_PATH}"

aws s3 cp "$ZIP_FILE" "${S3_PATH}"

# 检查上传是否成功
if [ $? -ne 0 ]; then
  echo "错误：上传到S3失败"
  rm "$ZIP_FILE"
  exit 1
fi

# 删除本地压缩文件
rm "$ZIP_FILE"

RELEASE_URL="${S3_URL_PREFIX}${ZIP_FILE}"
echo "部署成功！环境: ${ENVIRONMENT}, 版本: ${RELEASE_URL}"

# 检查 index.tsx 是否存在
if [ ! -f "index.tsx" ]; then
  echo "警告：在 ${MINIAPP_PATH} 中找不到 index.tsx，将跳过 module name 提取"
  echo "请手动运行: node ${SCRIPT_DIR}/update_monster_config.cjs '{\"name\":\"${NAME}\",\"moduleName\":\"<moduleName>\",\"releaseUrl\":\"${RELEASE_URL}\",\"environment\":\"${ENVIRONMENT}\"}'"
  exit 0
fi

# 提取名称并赋值给变量
MODULE_NAME=$(sed -e 's#//.*##' -e ':a' -e '/\/\*/{N;ba' -e '}' -e 's#/\*.*\*/##g' index.tsx | \
grep "AppRegistry.registerComponent" | \
sed -n "s/.*registerComponent('\\([^']*\\)'.*/\\1/p")

# 检查是否成功提取 module name
if [ -z "$MODULE_NAME" ]; then
  echo "警告：无法从 index.tsx 中提取 module name"
  echo "请手动运行: node ${SCRIPT_DIR}/update_monster_config.cjs '{\"name\":\"${NAME}\",\"moduleName\":\"<moduleName>\",\"releaseUrl\":\"${RELEASE_URL}\",\"environment\":\"${ENVIRONMENT}\"}'"
  exit 0
fi

# 调用根目录的 update_monster_config.cjs
echo "正在更新配置 (环境: ${ENVIRONMENT})..."

# 构建基础 JSON 配置对象
BASE_CONFIG_JSON=$(cat <<EOF
{
  "name": "${NAME}",
  "moduleName": "${MODULE_NAME}",
  "releaseUrl": "${RELEASE_URL}",
  "environment": "${ENVIRONMENT}"
}
EOF
)

# 检查是否存在 deploy_config.json，如果存在则合并其内容
DEPLOY_CONFIG_FILE="${MINIAPP_PATH}/deploy_config.json"
if [ -f "$DEPLOY_CONFIG_FILE" ]; then
  echo "发现 deploy_config.json，正在合并配置..."
  # 使用 jq 合并 JSON（如果 jq 可用）
  if command -v jq &> /dev/null; then
    CONFIG_JSON=$(echo "$BASE_CONFIG_JSON" | jq -s '.[0] * .[1]' - "$DEPLOY_CONFIG_FILE")
  else
    # 如果没有 jq，使用 Node.js 来合并 JSON
    CONFIG_JSON=$(node -e "
      const fs = require('fs');
      const base = JSON.parse(process.argv[1]);
      const deploy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
      console.log(JSON.stringify({...base, ...deploy}));
    " "$BASE_CONFIG_JSON" "$DEPLOY_CONFIG_FILE")
  fi
else
  echo "未找到 deploy_config.json，使用基础配置"
  CONFIG_JSON="$BASE_CONFIG_JSON"
fi

echo "输出配置 ${CONFIG_JSON}"

node "${SCRIPT_DIR}/update_monster_config.cjs" "${CONFIG_JSON}"


# 清除 CloudFront 缓存
echo "🗑️  清除 CloudFront 缓存..."
CLOUDFRONT_PATHS="/monster/*"
DISTRIBUTION_ID="EFR5H7M1UNIXN"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths $CLOUDFRONT_PATHS \
    --query 'Invalidation.Id' \
    --output text)

if [ $? -eq 0 ]; then
    echo "✅ 缓存清除请求已提交"
    echo "   失效 ID: $INVALIDATION_ID"
    echo "   路径: $CLOUDFRONT_PATHS"
else
    echo "❌ 缓存清除失败"
    exit 1
fi

if [ $? -eq 0 ]; then
  echo "配置更新成功！"
else
  echo "警告：配置更新失败，但文件已成功上传到 S3"
  exit 1
fi

