#!/usr/bin/env node

// 直接处理失败的文章，跳过编号检查
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const failedFile = process.argv[2] || 'retry_failed_articles.txt';
if (!fs.existsSync(failedFile)) {
    console.error('文件不存在:', failedFile);
    process.exit(1);
}

const urls = fs.readFileSync(failedFile, 'utf8')
    .split('\n')
    .filter(url => url.trim());

console.log(`📋 准备处理 ${urls.length} 篇失败的文章`);

// 创建临时文件，每次5篇
const batchSize = 5;
let processedCount = 0;

for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const tempFile = `temp_batch_${Date.now()}.txt`;
    
    console.log(`\n🔄 处理第 ${batchNum} 批（${batch.length} 篇）...`);
    
    // 直接创建新的URL文件，强制处理
    fs.writeFileSync(tempFile, batch.join('\n'));
    
    try {
        // 使用 --force 参数强制处理（如果有的话）
        execSync(`node batch_process_articles.js ${tempFile}`, {
            stdio: 'inherit'
        });
        processedCount += batch.length;
    } catch (error) {
        console.error(`❌ 批次 ${batchNum} 处理失败:`, error.message);
    }
    
    // 清理临时文件
    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
    }
    
    // 休息一下避免过载
    if (i + batchSize < urls.length) {
        console.log('⏸️  休息5秒...');
        execSync('sleep 5');
    }
}

console.log(`\n✅ 处理完成: ${processedCount}/${urls.length} 篇`);