#!/bin/bash

echo "🚀 启动VPN安全批处理程序"

# 设置VPN兼容环境变量
export NO_PROXY="localhost,127.0.0.1,*.local"
export no_proxy="localhost,127.0.0.1,*.local"
export VPN_COMPATIBLE_MODE=true

# 找到最新的combined文件
latest_combined=$(ls -t combined_*.txt 2>/dev/null | head -1)

if [ -z "$latest_combined" ]; then
    echo "❌ 找不到combined文件，请先运行URL生成程序"
    exit 1
fi

echo "✅ 使用文件: $latest_combined"
echo "✅ 已设置代理例外: $NO_PROXY"

# 临时修改batch_process_articles.js，跳过web_server require
# 创建一个临时副本
cp batch_process_articles.js batch_process_articles_vpn.js

# 注释掉web_server的require
sed -i '' '21s/^/\/\/ /' batch_process_articles_vpn.js
sed -i '' '22s/^/\/\/ /' batch_process_articles_vpn.js

# 运行修改后的版本
echo "🔧 启动批处理程序（VPN安全模式）..."
node batch_process_articles_vpn.js "$latest_combined"

# 清理临时文件
rm -f batch_process_articles_vpn.js

echo "✅ 批处理完成"