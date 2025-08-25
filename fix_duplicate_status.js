#!/usr/bin/env node

// 修复所有重复文章的状态
const fs = require('fs');
const path = require('path');
const { checkGlobalDuplicate } = require('./check_global_duplicates');

console.log('🔧 修复所有重复文章的状态...\n');

const golfContentDir = path.join(__dirname, 'golf_content');
let totalFixed = 0;
let totalFailed = 0;

// 扫描所有日期目录
const dates = fs.readdirSync(golfContentDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

for (const date of dates) {
    const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
    if (!fs.existsSync(urlsFile)) continue;
    
    const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    let modified = false;
    let dateFixed = 0;
    
    for (const [num, value] of Object.entries(urls)) {
        if (typeof value === 'object' && value.status === 'failed') {
            totalFailed++;
            
            // 检查是否在其他日期已成功
            const globalCheck = checkGlobalDuplicate(value.url);
            
            if (globalCheck && globalCheck.hasContent && globalCheck.date !== date) {
                // 更新状态为duplicate
                urls[num] = {
                    url: value.url,
                    timestamp: value.timestamp,
                    status: 'duplicate',
                    duplicateInfo: {
                        date: globalCheck.date,
                        articleNum: globalCheck.articleNum
                    },
                    previousStatus: 'failed',
                    previousError: value.error,
                    fixedAt: new Date().toISOString()
                };
                
                modified = true;
                dateFixed++;
                totalFixed++;
                
                console.log(`✅ 修复 ${date}/文章${num}`);
                console.log(`   已在 ${globalCheck.date}/文章${globalCheck.articleNum} 成功处理`);
                console.log(`   ${value.url}\n`);
            }
        }
    }
    
    // 保存修改
    if (modified) {
        fs.writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
        console.log(`💾 更新 ${date}/article_urls.json (修复 ${dateFixed} 篇)\n`);
    }
}

console.log('═══════════════════════════════════════════════════');
console.log(`📊 修复完成统计：`);
console.log(`   总失败文章: ${totalFailed}`);
console.log(`   修复为duplicate: ${totalFixed}`);
console.log(`   真正失败: ${totalFailed - totalFixed}`);
console.log('═══════════════════════════════════════════════════');
console.log('\n💡 提示: 现在运行 batch_process_articles.js 将自动跳过这些重复文章');