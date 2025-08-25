#!/usr/bin/env node

/**
 * 测试AI检测 - 检测一篇文章
 */

const fs = require('fs').promises;
const path = require('path');
const AIContentDetector = require('./ai_content_detector');

async function testDetection() {
    const detector = new AIContentDetector();
    
    try {
        // 初始化检测器
        console.log('初始化AI检测器...');
        await detector.initialize();
        
        // 测试文章路径
        const testFile = 'golf_content/2025-08-13/wechat_ready/wechat_article_1566.md';
        
        console.log(`\n测试文件: ${testFile}`);
        
        // 读取文章内容
        const content = await fs.readFile(testFile, 'utf8');
        
        // 提取前500个字符作为测试
        const testContent = content.substring(0, 500);
        
        console.log('\n测试内容预览:');
        console.log(testContent);
        console.log('\n开始AI检测...');
        
        // 执行检测
        const result = await detector.detectText(testContent);
        
        console.log(`\n检测结果: ${result !== null ? result + '%' : '检测失败'}`);
        
        // 显示代理统计
        const stats = await detector.proxyManager.getProxyStats();
        console.log('\n代理使用统计:');
        console.log(`- 总配额: ${stats.totalQuotaToday}`);
        console.log(`- 已使用: ${stats.usedQuotaToday}`);
        console.log(`- 剩余: ${stats.remainingQuotaToday}`);
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        await detector.close();
    }
}

// 运行测试
testDetection();