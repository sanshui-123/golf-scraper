#!/usr/bin/env node

const fs = require('fs');

function monitorProgress() {
    setInterval(() => {
        try {
            // 读取已处理的文章数
            const urlsFile = '/Users/sanshui/Desktop/cursor/golf_content/2025-07-15/article_urls.json';
            const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
            const processedCount = Object.keys(urls).length;
            
            // 读取待处理文章
            const failedFile = 'failed_articles.json';
            const failed = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
            const pending = Object.entries(failed)
                .filter(([url, data]) => data.status === 'pending_retry' && url.includes('golfmonthly.com'))
                .length;
            
            // 计算最新的文章编号
            const latestArticleNum = Math.max(...Object.keys(urls).map(num => parseInt(num)));
            
            // 清屏并显示进度
            console.clear();
            console.log('🔄 实时处理进度监控');
            console.log('='.repeat(50));
            console.log(`📅 日期: 2025-07-15`);
            console.log(`✅ 已处理: ${processedCount} 篇`);
            console.log(`⏳ 待处理: ${pending} 篇`);
            console.log(`📊 总进度: ${Math.round((processedCount / 33) * 100)}%`);
            console.log(`🔢 最新文章编号: article_${latestArticleNum}`);
            console.log('='.repeat(50));
            console.log(`⏰ 更新时间: ${new Date().toLocaleTimeString()}`);
            console.log('\n按 Ctrl+C 退出监控');
            
        } catch (error) {
            console.log('读取进度时出错:', error.message);
        }
    }, 3000); // 每3秒更新一次
}

console.log('📊 开始监控处理进度...\n');
monitorProgress();