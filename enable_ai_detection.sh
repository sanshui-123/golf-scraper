#!/bin/bash

# 🎯 一键启用AI检测的最优方案
# 基于现有系统架构，无需任何新代码

echo "🚀 启用AI检测功能..."
echo ""

# 1. 切换到代理模式（如果还没切换）
if ! grep -q "setDetectionMode('proxy')" batch_process_articles.js; then
    echo "📝 切换到代理模式..."
    sed -i '' "s/setDetectionMode('hybrid')/setDetectionMode('proxy')/g" batch_process_articles.js
    echo "✅ 已切换到代理模式"
else
    echo "✅ 已经是代理模式"
fi

# 2. 检查代理配置
echo ""
echo "🔍 检查代理配置..."
if grep -q "127.0.0.1" proxy_config.json && grep -q "7890\|1080\|10808" proxy_config.json; then
    echo "✅ 发现本地代理配置"
else
    echo "⚠️  未发现有效代理配置"
    echo "   请确保："
    echo "   1. 运行本地代理软件（Clash/V2Ray等）"
    echo "   2. 编辑 proxy_config.json 配置正确端口"
fi

# 3. 为现有文章添加AI检测
echo ""
echo "🤖 为现有文章添加AI检测..."
echo ""

# 创建批量AI检测脚本
cat > add_ai_detection_to_existing.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function addAIDetectionToExisting() {
    console.log('🔍 扫描现有文章...\n');
    
    // 初始化AI检测器
    const detector = new EnhancedAIContentDetector();
    detector.detectionMode = 'proxy';
    await detector.initialize();
    
    // 获取所有日期目录
    const golfContentDir = path.join(__dirname, 'golf_content');
    const dates = fs.readdirSync(golfContentDir)
        .filter(d => fs.statSync(path.join(golfContentDir, d)).isDirectory());
    
    let totalArticles = 0;
    let processedArticles = 0;
    let skippedArticles = 0;
    
    for (const date of dates) {
        const mdDir = path.join(golfContentDir, date, 'wechat_ready');
        
        if (!fs.existsSync(mdDir)) continue;
        
        const mdFiles = fs.readdirSync(mdDir)
            .filter(f => f.endsWith('.md') && f.startsWith('wechat_article_'));
        
        console.log(`📅 处理 ${date} 的 ${mdFiles.length} 篇文章`);
        
        for (const mdFile of mdFiles) {
            totalArticles++;
            const filePath = path.join(mdDir, mdFile);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 检查是否已有AI检测
            if (content.includes('<!-- AI检测:')) {
                console.log(`   ⏭️  ${mdFile} - 已有AI检测，跳过`);
                skippedArticles++;
                continue;
            }
            
            // 提取文章内容（移除元数据）
            let articleContent = content;
            const metadataMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
            if (metadataMatch) {
                articleContent = content.substring(metadataMatch[0].length);
            }
            
            // 执行AI检测
            console.log(`   🔍 检测 ${mdFile}...`);
            const aiProbability = await detector.detectText(articleContent);
            
            if (aiProbability !== null) {
                // 添加AI检测注释
                const aiComment = \`<!-- AI检测: \${aiProbability}% | 检测时间: \${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n\`;
                const updatedContent = aiComment + content;
                
                // 保存更新
                fs.writeFileSync(filePath, updatedContent, 'utf8');
                console.log(\`   ✅ 检测完成: \${aiProbability}%\`);
                processedArticles++;
                
                // 避免API过载
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log(`   ❌ 检测失败`);
            }
        }
    }
    
    console.log('\n📊 处理完成统计：');
    console.log(\`   总文章数: \${totalArticles}\`);
    console.log(\`   已有AI检测: \${skippedArticles}\`);
    console.log(\`   新增检测: \${processedArticles}\`);
    console.log(\`   检测失败: \${totalArticles - skippedArticles - processedArticles}\`);
}

// 运行
addAIDetectionToExisting().catch(console.error);
EOF

echo "选择操作："
echo "1) 为所有现有文章添加AI检测（需要时间）"
echo "2) 只为今天的文章添加AI检测（快速）"
echo "3) 跳过，只在新文章处理时检测"
echo ""
read -p "请选择 (1/2/3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 开始为所有文章添加AI检测..."
        node add_ai_detection_to_existing.js
        ;;
    2)
        echo ""
        echo "🚀 只处理今天的文章..."
        # 修改脚本只处理今天
        sed -i '' "s/const dates = .*/const dates = ['$(date +%Y-%m-%d)'];/" add_ai_detection_to_existing.js
        node add_ai_detection_to_existing.js
        ;;
    3)
        echo ""
        echo "⏭️  跳过现有文章"
        ;;
esac

echo ""
echo "✅ AI检测功能已启用！"
echo ""
echo "📊 查看结果："
echo "1. 访问 http://localhost:8080"
echo "2. 查看文章列表中的 '🤖 AI: XX%' 标记"
echo "3. 查看AI检测统计面板"
echo ""
echo "🔄 后续处理："
echo "新文章会自动进行AI检测（如果代理正常）"
echo "运行: node batch_process_articles.js deep_urls_*.txt"