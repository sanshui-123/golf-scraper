#!/usr/bin/env node

// 查找所有未处理完成的文章
const fs = require('fs');
const path = require('path');

const golfContentDir = path.join(__dirname, 'golf_content');
const unfinished = {
    processing: [],
    retrying: [],
    failed_timeout: [],
    failed_other: []
};

console.log('🔍 查找所有未处理完成的文章...\n');

// 扫描所有日期目录
const dates = fs.readdirSync(golfContentDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

for (const date of dates) {
    const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
    if (!fs.existsSync(urlsFile)) continue;
    
    const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    
    for (const [num, value] of Object.entries(urls)) {
        if (typeof value === 'object') {
            // 检查处理中的文章
            if (value.status === 'processing') {
                unfinished.processing.push({
                    date, num, url: value.url,
                    timestamp: value.timestamp
                });
            }
            // 检查重试中的文章
            else if (value.status === 'retrying') {
                unfinished.retrying.push({
                    date, num, url: value.url,
                    timestamp: value.timestamp
                });
            }
            // 检查失败的文章（排除404和已标记为duplicate的）
            else if (value.status === 'failed' && 
                     !value.error?.includes('404') && 
                     value.status !== 'duplicate') {
                
                // 检查是否有对应的成功文件
                const mdFile = path.join(golfContentDir, date, 'wechat_ready', `wechat_article_${num}.md`);
                if (!fs.existsSync(mdFile)) {
                    if (value.error === 'Processing timeout') {
                        unfinished.failed_timeout.push({
                            date, num, url: value.url,
                            error: value.error,
                            failedAt: value.failedAt
                        });
                    } else {
                        unfinished.failed_other.push({
                            date, num, url: value.url,
                            error: value.error,
                            failedAt: value.failedAt
                        });
                    }
                }
            }
        }
    }
}

// 输出结果
console.log('📊 未处理完成的文章统计：\n');

if (unfinished.processing.length > 0) {
    console.log(`⏳ 处理中 (processing): ${unfinished.processing.length} 篇`);
    unfinished.processing.forEach(item => {
        console.log(`   ${item.date}/文章${item.num}: ${item.url}`);
    });
    console.log();
}

if (unfinished.retrying.length > 0) {
    console.log(`🔄 重试中 (retrying): ${unfinished.retrying.length} 篇`);
    unfinished.retrying.forEach(item => {
        console.log(`   ${item.date}/文章${item.num}: ${item.url}`);
    });
    console.log();
}

if (unfinished.failed_timeout.length > 0) {
    console.log(`⏱️ 处理超时 (可重试): ${unfinished.failed_timeout.length} 篇`);
    const byWebsite = {};
    unfinished.failed_timeout.forEach(item => {
        const domain = new URL(item.url).hostname;
        if (!byWebsite[domain]) byWebsite[domain] = [];
        byWebsite[domain].push(item);
    });
    
    Object.entries(byWebsite).forEach(([domain, items]) => {
        console.log(`\n   ${domain} (${items.length} 篇):`);
        items.forEach(item => {
            console.log(`   - ${item.date}/文章${item.num}`);
        });
    });
    console.log();
}

if (unfinished.failed_other.length > 0) {
    console.log(`❌ 其他错误: ${unfinished.failed_other.length} 篇`);
    unfinished.failed_other.forEach(item => {
        console.log(`   ${item.date}/文章${item.num}: ${item.error}`);
        console.log(`   URL: ${item.url}`);
    });
}

// 总结
const total = unfinished.processing.length + 
              unfinished.retrying.length + 
              unfinished.failed_timeout.length + 
              unfinished.failed_other.length;

console.log('\n' + '='.repeat(50));
console.log(`📊 总计未完成: ${total} 篇`);
console.log('='.repeat(50));

// 生成可重试的URL列表
if (unfinished.failed_timeout.length > 0) {
    const retryUrls = unfinished.failed_timeout.map(item => item.url);
    const retryFile = 'unfinished_timeout_urls.txt';
    fs.writeFileSync(retryFile, retryUrls.join('\n'));
    console.log(`\n💾 超时文章URL已保存到: ${retryFile}`);
}