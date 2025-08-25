#!/usr/bin/env node

// 修复卡在processing状态的文章
const fs = require('fs');
const path = require('path');

const urlsFile = path.join(__dirname, 'golf_content/2025-07-29/article_urls.json');
const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));

let fixed = 0;

// 修复所有processing状态的文章
Object.entries(urls).forEach(([num, value]) => {
    if (typeof value === 'object' && value.status === 'processing') {
        // 检查是否有对应的成功文件
        const mdFile = path.join(__dirname, `golf_content/2025-07-29/wechat_ready/wechat_article_${num}.md`);
        
        if (fs.existsSync(mdFile)) {
            // 文件存在，标记为完成
            urls[num].status = 'completed';
            urls[num].completedAt = new Date().toISOString();
            console.log(`✅ 修复文章${num}为completed（文件已存在）`);
        } else {
            // 文件不存在，标记为失败
            urls[num].status = 'failed';
            urls[num].error = 'Processing interrupted';
            urls[num].failedAt = new Date().toISOString();
            console.log(`❌ 修复文章${num}为failed（文件不存在）`);
        }
        fixed++;
    }
    
    if (typeof value === 'object' && value.status === 'retrying') {
        // 修复retrying状态
        urls[num].status = 'failed';
        urls[num].error = 'Retry interrupted';
        urls[num].failedAt = new Date().toISOString();
        console.log(`❌ 修复文章${num}从retrying到failed`);
        fixed++;
    }
});

if (fixed > 0) {
    fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
    console.log(`\n💾 已更新 ${fixed} 篇文章的状态`);
} else {
    console.log('✅ 没有需要修复的文章');
}