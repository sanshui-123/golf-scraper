#!/usr/bin/env node

// 分析处理失败的文章
const fs = require('fs');
const path = require('path');

console.log('📊 分析文章处理状态...\n');

const golfContentDir = path.join(__dirname, 'golf_content');
const dates = fs.readdirSync(golfContentDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

let totalAssigned = 0;
let totalCompleted = 0;
let totalProcessing = 0;
let totalFailed = 0;

dates.forEach(date => {
    const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
    const wechatDir = path.join(golfContentDir, date, 'wechat_ready');
    
    if (!fs.existsSync(urlsFile)) return;
    
    const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    const completed = fs.existsSync(wechatDir) 
        ? fs.readdirSync(wechatDir).filter(f => f.match(/wechat_article_\d+\.md/)).length
        : 0;
    
    let processing = 0;
    let assigned = Object.keys(urls).length;
    
    Object.values(urls).forEach(value => {
        if (typeof value === 'object' && value.status === 'processing') {
            processing++;
        }
    });
    
    totalAssigned += assigned;
    totalCompleted += completed;
    totalProcessing += processing;
    
    if (assigned > 0) {
        console.log(`📅 ${date}:`);
        console.log(`  分配编号: ${assigned}`);
        console.log(`  实际完成: ${completed}`);
        console.log(`  处理中: ${processing}`);
        console.log(`  失败/丢失: ${assigned - completed - processing}`);
        console.log(`  成功率: ${(completed/assigned*100).toFixed(1)}%\n`);
    }
});

console.log('📊 总计:');
console.log(`  总分配: ${totalAssigned}`);
console.log(`  总完成: ${totalCompleted}`);
console.log(`  处理中: ${totalProcessing}`);
console.log(`  失败/丢失: ${totalAssigned - totalCompleted - totalProcessing}`);
console.log(`  总成功率: ${(totalCompleted/totalAssigned*100).toFixed(1)}%`);