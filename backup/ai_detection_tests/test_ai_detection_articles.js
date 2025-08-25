#!/usr/bin/env node

/**
 * 测试现有文章的AI检测
 * 用于验证对已处理文章进行AI检测的完整流程
 */

const fs = require('fs').promises;
const path = require('path');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function testExistingArticles() {
    console.log('\n📄 测试现有文章的AI检测\n');
    
    try {
        // 获取今天的日期
        const today = new Date().toISOString().split('T')[0];
        const articlesDir = path.join(__dirname, 'golf_content', today, 'wechat_ready');
        
        // 检查目录是否存在
        try {
            await fs.access(articlesDir);
        } catch (error) {
            console.log(`⚠️ 今日文章目录不存在: ${articlesDir}`);
            console.log('尝试查找最近的文章目录...\n');
            
            // 查找最近的日期目录
            const contentDir = path.join(__dirname, 'golf_content');
            const dates = await fs.readdir(contentDir);
            const validDates = dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
            
            if (validDates.length > 0) {
                const latestDate = validDates[0];
                articlesDir = path.join(contentDir, latestDate, 'wechat_ready');
                console.log(`✅ 使用日期: ${latestDate}\n`);
            } else {
                throw new Error('没有找到任何文章目录');
            }
        }
        
        // 读取文章列表
        const files = await fs.readdir(articlesDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        
        if (mdFiles.length === 0) {
            console.log('❌ 没有找到任何文章');
            return;
        }
        
        console.log(`📊 找到 ${mdFiles.length} 篇文章\n`);
        
        // 限制测试数量
        const testLimit = 3;
        const filesToTest = mdFiles.slice(0, testLimit);
        
        console.log(`🔍 测试前 ${testLimit} 篇文章的AI检测...\n`);
        
        // 初始化检测器
        const detector = new EnhancedAIContentDetector();
        await detector.initialize();
        
        // 测试每篇文章
        for (let i = 0; i < filesToTest.length; i++) {
            const file = filesToTest[i];
            const filePath = path.join(articlesDir, file);
            
            console.log(`\n[${i + 1}/${filesToTest.length}] 检测文章: ${file}`);
            console.log('-'.repeat(50));
            
            // 读取文章内容
            const content = await fs.readFile(filePath, 'utf8');
            
            // 检查是否已有AI检测结果
            const existingMatch = content.match(/<!-- AI检测: (\d+(?:\.\d+)?)% \| 检测时间: ([\d-]+) -->/);
            if (existingMatch) {
                console.log(`📝 已有检测结果: ${existingMatch[1]}% (${existingMatch[2]})`);
            }
            
            // 提取文章正文
            const bodyMatch = content.match(/---[\s\S]*?---\s*([\s\S]*)/);
            const articleText = bodyMatch ? bodyMatch[1] : content;
            
            // 显示文章预览
            const preview = articleText.substring(0, 150).replace(/\n/g, ' ');
            console.log(`📄 内容预览: ${preview}...`);
            
            // 执行AI检测
            console.log('🤖 执行AI检测...');
            const startTime = Date.now();
            const probability = await detector.detectText(articleText);
            const duration = Date.now() - startTime;
            
            if (probability !== null) {
                console.log(`✅ 检测成功: ${probability}% (耗时: ${(duration / 1000).toFixed(2)}秒)`);
                
                // 如果需要更新文件
                if (!existingMatch || parseFloat(existingMatch[1]) !== probability) {
                    console.log('📝 需要更新文件中的AI检测结果');
                }
            } else {
                console.log(`❌ 检测失败 (耗时: ${(duration / 1000).toFixed(2)}秒)`);
            }
            
            // 避免过快请求
            if (i < filesToTest.length - 1) {
                console.log('\n⏳ 等待2秒后继续...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // 显示统计信息
        console.log('\n');
        detector.showStatistics();
        
        // 清理资源
        await detector.cleanup();
        
        console.log('\n✅ 测试完成！');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

// 显示使用说明
console.log('🎯 现有文章AI检测测试');
console.log('');
console.log('功能: 对已处理的文章进行AI检测测试');
console.log('目录: golf_content/日期/wechat_ready/');
console.log('');

// 执行测试
testExistingArticles();