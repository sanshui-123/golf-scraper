#!/usr/bin/env node

// 批量处理所有失败的文章
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 批量处理所有失败的文章...\n');

const golfContentDir = path.join(__dirname, 'golf_content');
const failedUrls = [];

// 收集所有失败的文章URL
fs.readdirSync(golfContentDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .forEach(date => {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (!fs.existsSync(urlsFile)) return;
        
        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        
        Object.entries(urls).forEach(([num, value]) => {
            if (typeof value === 'object' && value.status === 'failed') {
                // 检查是否真的没有完成
                const mdFile = path.join(golfContentDir, date, 'wechat_ready', `wechat_article_${num}.md`);
                if (!fs.existsSync(mdFile)) {
                    failedUrls.push(value.url);
                    console.log(`📌 ${date}/文章${num}: ${value.url}`);
                    console.log(`   失败原因: ${value.error || '未知'}`);
                }
            }
        });
    });

console.log(`\n📊 找到 ${failedUrls.length} 篇失败的文章\n`);

if (failedUrls.length === 0) {
    console.log('✨ 没有失败的文章需要处理');
    process.exit(0);
}

// 分批处理，每批5篇
const batchSize = 5;
let successCount = 0;

for (let i = 0; i < failedUrls.length; i += batchSize) {
    const batch = failedUrls.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const tempFile = `failed_batch_${batchNum}.txt`;
    
    console.log(`\n🔄 处理第 ${batchNum}/${Math.ceil(failedUrls.length/batchSize)} 批（${batch.length} 篇）...`);
    
    // 创建批次文件
    fs.writeFileSync(tempFile, batch.join('\n'));
    
    try {
        // 执行批处理
        console.log(`📝 执行: node batch_process_articles.js ${tempFile}`);
        execSync(`node batch_process_articles.js ${tempFile}`, {
            stdio: 'inherit'
        });
        
        successCount += batch.length;
    } catch (error) {
        console.error(`\n❌ 批次 ${batchNum} 处理出错:`, error.message);
    }
    
    // 清理临时文件
    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
    }
    
    // 批次间休息，避免API过载
    if (i + batchSize < failedUrls.length) {
        console.log('\n⏸️  休息10秒后继续下一批...');
        execSync('sleep 10');
    }
}

// 生成处理报告
console.log('\n' + '='.repeat(50));
console.log('📊 处理完成报告:');
console.log(`   总失败文章: ${failedUrls.length}`);
console.log(`   尝试处理: ${failedUrls.length}`);
console.log(`   预期成功: ${successCount}`);
console.log('='.repeat(50));
console.log('\n💡 提示: 运行 node analyze_failed_articles.js 查看最新状态');