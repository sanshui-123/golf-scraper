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
    // 只处理今天的文章
    const dates = ['2025-08-16'];
    
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
                const aiComment = `<!-- AI检测: ${aiProbability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
                const updatedContent = aiComment + content;
                
                // 保存更新
                fs.writeFileSync(filePath, updatedContent, 'utf8');
                console.log(`   ✅ 检测完成: ${aiProbability}%`);
                processedArticles++;
                
                // 避免API过载
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log(`   ❌ 检测失败`);
            }
        }
    }
    
    console.log('\n📊 处理完成统计：');
    console.log(`   总文章数: ${totalArticles}`);
    console.log(`   已有AI检测: ${skippedArticles}`);
    console.log(`   新增检测: ${processedArticles}`);
    console.log(`   检测失败: ${totalArticles - skippedArticles - processedArticles}`);
}

// 运行
addAIDetectionToExisting().catch(console.error);
