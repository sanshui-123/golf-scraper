#!/usr/bin/env node

/**
 * 测试单个文章的AI检测
 */

const fs = require('fs');
const path = require('path');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function testSingleAIDetection() {
    // 对于本地连接，不使用代理
    process.env.NO_PROXY = 'localhost,127.0.0.1';
    
    console.log('🧪 测试单个文章的AI检测\n');
    
    const detector = new EnhancedAIContentDetector();
    
    try {
        // 设置为仅使用BitBrowser模式
        detector.setDetectionMode('bitbrowser');
        await detector.initialize();
        
        // 获取今天的第一篇文章
        const today = new Date().toISOString().split('T')[0];
        const articlesDir = path.join('golf_content', today, 'wechat_ready');
        
        if (!fs.existsSync(articlesDir)) {
            console.log('❌ 今天的文章目录不存在');
            return;
        }
        
        const files = fs.readdirSync(articlesDir)
            .filter(f => f.endsWith('.md'))
            .filter(f => {
                const content = fs.readFileSync(path.join(articlesDir, f), 'utf8');
                return !content.includes('<!-- AI检测:');
            });
        
        if (files.length === 0) {
            console.log('✅ 所有文章都已有AI检测结果');
            return;
        }
        
        const file = files[0];
        console.log(`📄 选择文章: ${file}\n`);
        
        const filePath = path.join(articlesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 提取纯文本，限制长度
        let textContent = content;
        textContent = textContent.replace(/!\[.*?\]\(.*?\)/g, ''); // 移除图片
        textContent = textContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // 保留链接文本
        textContent = textContent.substring(0, 2000); // 限制长度避免超时
        
        console.log('📝 文本长度:', textContent.length, '字符\n');
        
        // 执行AI检测
        console.log('🔍 开始AI检测...');
        const startTime = Date.now();
        const aiProbability = await detector.detectText(textContent);
        const duration = Date.now() - startTime;
        
        if (aiProbability !== null) {
            console.log(`\n✅ AI检测成功!`);
            console.log(`   AI率: ${aiProbability}%`);
            console.log(`   耗时: ${(duration/1000).toFixed(1)}秒`);
            
            // 在文件开头添加AI检测注释
            const aiComment = `<!-- AI检测: ${aiProbability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
            const updatedContent = aiComment + content;
            
            // 更新文件
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`\n📁 文件已更新: ${file}`);
        } else {
            console.log('\n❌ AI检测失败');
        }
        
    } catch (error) {
        console.error('\n❌ 测试出错:', error.message);
    } finally {
        // 清理资源
        if (detector.bitBrowserManager) {
            await detector.bitBrowserManager.cleanup();
        }
        if (detector.proxyManager) {
            await detector.proxyManager.cleanup();
        }
    }
    
    console.log('\n📌 下一步：');
    console.log('1. 访问 http://localhost:8080 查看Web页面');
    console.log('2. 查看文章是否显示AI检测率');
}

// 运行
if (require.main === module) {
    testSingleAIDetection()
        .then(() => {
            console.log('\n✅ 测试完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 测试失败:', error);
            process.exit(1);
        });
}

module.exports = testSingleAIDetection;