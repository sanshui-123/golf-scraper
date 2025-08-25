#!/usr/bin/env node

// 修复所有"processing"状态的文章
const fs = require('fs');
const path = require('path');

console.log('🔧 修复处理状态...\n');

const golfContentDir = path.join(__dirname, 'golf_content');
const dates = fs.readdirSync(golfContentDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

let fixedCount = 0;

dates.forEach(date => {
    const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
    const wechatDir = path.join(golfContentDir, date, 'wechat_ready');
    
    if (!fs.existsSync(urlsFile)) return;
    
    let urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    let modified = false;
    
    Object.keys(urls).forEach(num => {
        const value = urls[num];
        
        // 检查是否为processing状态
        if (typeof value === 'object' && value.status === 'processing') {
            // 检查是否实际已完成
            const mdFile = path.join(wechatDir, `wechat_article_${num}.md`);
            if (fs.existsSync(mdFile)) {
                // 实际已完成，更新状态
                urls[num] = value.url;
                console.log(`✅ ${date}/文章${num}: processing -> completed`);
                modified = true;
                fixedCount++;
            } else {
                // 检查处理时间，超过1小时认为失败
                const processingTime = Date.now() - new Date(value.timestamp).getTime();
                if (processingTime > 3600000) { // 1小时
                    value.status = 'failed';
                    value.error = 'Processing timeout';
                    value.failedAt = new Date().toISOString();
                    console.log(`❌ ${date}/文章${num}: processing -> failed (超时)`);
                    modified = true;
                    fixedCount++;
                }
            }
        }
    });
    
    if (modified) {
        fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
        console.log(`💾 更新 ${urlsFile}\n`);
    }
});

console.log(`\n🎯 共修复 ${fixedCount} 个状态`);

// 生成重试列表
console.log('\n📋 生成失败文章重试列表...');
const retryUrls = [];

dates.forEach(date => {
    const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
    if (!fs.existsSync(urlsFile)) return;
    
    const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    
    Object.entries(urls).forEach(([num, value]) => {
        if (typeof value === 'object' && value.status === 'failed') {
            retryUrls.push(value.url);
        }
    });
});

if (retryUrls.length > 0) {
    const retryFile = path.join(__dirname, 'retry_failed_articles.txt');
    fs.writeFileSync(retryFile, retryUrls.join('\n'));
    console.log(`\n📝 失败文章列表已保存到: retry_failed_articles.txt`);
    console.log(`   共 ${retryUrls.length} 篇文章需要重试`);
}