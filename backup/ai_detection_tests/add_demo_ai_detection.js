#!/usr/bin/env node

/**
 * 为演示目的添加模拟AI检测数据
 */

const fs = require('fs');
const path = require('path');

function addDemoAIDetection() {
    console.log('🎭 添加演示AI检测数据...\n');
    
    const today = '2025-08-16';
    const mdDir = path.join('golf_content', today, 'wechat_ready');
    
    // 模拟的AI检测结果
    const demoResults = [
        { file: 'wechat_article_10091.md', ai: 25 },
        { file: 'wechat_article_10092.md', ai: 68 },
        { file: 'wechat_article_10093.md', ai: 15 },
        { file: 'wechat_article_10094.md', ai: 82 },
        { file: 'wechat_article_10098.md', ai: 45 }
    ];
    
    let added = 0;
    
    for (const demo of demoResults) {
        const filePath = path.join(mdDir, demo.file);
        
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 检查是否已有AI检测
            if (!content.includes('<!-- AI检测:')) {
                const aiComment = `<!-- AI检测: ${demo.ai}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
                const updatedContent = aiComment + content;
                
                fs.writeFileSync(filePath, updatedContent, 'utf8');
                console.log(`✅ ${demo.file}: 添加AI检测 ${demo.ai}%`);
                added++;
            }
        }
    }
    
    console.log(`\n📊 完成！添加了 ${added} 个演示AI检测结果`);
    console.log('\n🌐 访问 http://localhost:8080 查看效果');
    console.log('   - 文章列表应显示 "🤖 AI: XX%"');
    console.log('   - AI检测统计面板应显示数据');
}

// 运行
addDemoAIDetection();