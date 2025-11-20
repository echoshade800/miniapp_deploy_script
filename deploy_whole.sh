#!/bin/bash

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 环境参数，默认为 dev
ENVIRONMENT="${1:-dev}"

# 验证环境参数
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
  echo "错误：环境参数必须是 'dev' 或 'prod'"
  echo "用法: ./deploy_whole.sh [environment]"
  echo "示例: ./deploy_whole.sh dev"
  echo "示例: ./deploy_whole.sh prod"
  exit 1
fi

echo "=========================================="
echo "开始批量部署所有 github_mini 应用"
echo "环境: ${ENVIRONMENT}"
echo "=========================================="
echo ""

# 切换到脚本所在目录
cd "$SCRIPT_DIR" || exit 1

# 查找所有以 github_mini 开头的目录
MINIAPP_DIRS=$(find . -maxdepth 1 -type d -name "github_mini*" | sort)

# 检查是否找到任何目录
if [ -z "$MINIAPP_DIRS" ]; then
  echo "错误：未找到任何以 'github_mini' 开头的目录"
  exit 1
fi

# 统计总数
TOTAL=$(echo "$MINIAPP_DIRS" | wc -l | tr -d ' ')
CURRENT=0
SUCCESS=0
FAILED=0

# 遍历每个目录并部署
while IFS= read -r dir; do
  CURRENT=$((CURRENT + 1))
  # 提取目录名（去掉 ./ 前缀）
  MINIAPP_NAME=$(basename "$dir")
  
  echo ""
  echo "----------------------------------------"
  echo "[$CURRENT/$TOTAL] 正在部署: ${MINIAPP_NAME}"
  echo "----------------------------------------"
  
  # 检查目录是否存在 deploy_ios.sh 或 package.json
  if [ ! -f "${dir}/package.json" ]; then
    echo "⚠️  跳过 ${MINIAPP_NAME}：未找到 package.json"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # 执行部署
  if ./deploy_ios.sh "$MINIAPP_NAME" "$ENVIRONMENT"; then
    echo "✅ ${MINIAPP_NAME} 部署成功"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ ${MINIAPP_NAME} 部署失败"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
  
done <<< "$MINIAPP_DIRS"

# 输出总结
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "总计: $TOTAL"
echo "成功: $SUCCESS"
echo "失败: $FAILED"
echo "环境: ${ENVIRONMENT}"
echo "=========================================="

# 如果有失败的部署，返回非零退出码
if [ $FAILED -gt 0 ]; then
  exit 1
fi

exit 0
