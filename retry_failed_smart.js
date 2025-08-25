#!/usr/bin/env node

// 智能重试失败文章 - 按网站分组，避免已知问题
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 智能重试失败文章...\n');

const golfContentDir = path.join(__dirname, 'golf_content');
const failedBysite = {
    'golfmonthly.com': [],
    'golf.com': [],
    'golfdigest.com': [],
    'mygolfspy.com': [],
    'golfwrx.com': []
};

// 首先修复stuck的文章
const todayDir = path.join(golfContentDir, '2025-07-29');
const todayUrlsFile = path.join(todayDir, 'article_urls.json');
if (fs.existsSync(todayUrlsFile)) {
    const urls = JSON.parse(fs.readFileSync(todayUrlsFile, 'utf8'));
    
    // 修复article 262
    if (urls['262'] && urls['262'].status === 'processing') {
        urls['262'].status = 'failed';
        urls['262'].error = 'Processing interrupted';
        urls['262'].failedAt = new Date().toISOString();
        fs.writeFileSync(todayUrlsFile, JSON.stringify(urls, null, 2));
        console.log('✅ 修复了stuck的文章262\n');
    }
}

// 收集所有失败的文章，按网站分组
fs.readdirSync(golfContentDir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .forEach(date => {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (!fs.existsSync(urlsFile)) return;
        
        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        
        Object.entries(urls).forEach(([num, value]) => {
            if (typeof value === 'object' && value.status === 'failed') {
                // 跳过404错误
                if (value.error && value.error.includes('404')) {
                    console.log(`⏭️ 跳过404文章: ${num} - ${value.url}`);
                    return;
                }
                
                // 检查是否真的没有完成
                const mdFile = path.join(golfContentDir, date, 'wechat_ready', `wechat_article_${num}.md`);
                if (!fs.existsSync(mdFile)) {
                    // 按网站分组
                    const url = value.url;
                    if (url.includes('golfmonthly.com')) {
                        failedBysite['golfmonthly.com'].push(url);
                    } else if (url.includes('golf.com')) {
                        failedBysite['golf.com'].push(url);
                    } else if (url.includes('golfdigest.com')) {
                        failedBysite['golfdigest.com'].push(url);
                    } else if (url.includes('mygolfspy.com')) {
                        failedBysite['mygolfspy.com'].push(url);
                    } else if (url.includes('golfwrx.com')) {
                        failedBysite['golfwrx.com'].push(url);
                    }
                }
            }
        });
    });

// 显示统计
console.log('📊 失败文章统计（按网站）:');
let totalFailed = 0;
Object.entries(failedBysite).forEach(([site, urls]) => {
    console.log(`   ${site}: ${urls.length} 篇`);
    totalFailed += urls.length;
});
console.log(`   总计: ${totalFailed} 篇\n`);

// 优先处理成功率高的网站
const processOrder = [
    { site: 'golf.com', batch: 3 },          // Golf.com 成功率最高
    { site: 'mygolfspy.com', batch: 2 },    // MyGolfSpy 较稳定
    { site: 'golfwrx.com', batch: 2 },      // GolfWRX 只有1篇
    { site: 'golfmonthly.com', batch: 2 },  // Golf Monthly 问题较多，小批量
    { site: 'golfdigest.com', batch: 1 }    // Golf Digest 有重定向问题，一次一篇
];

let totalProcessed = 0;

// 按网站顺序处理
for (const { site, batch } of processOrder) {
    const urls = failedBysite[site];
    if (urls.length === 0) continue;
    
    console.log(`\n🌐 处理 ${site} (${urls.length} 篇)...`);
    
    for (let i = 0; i < urls.length; i += batch) {
        const batchUrls = urls.slice(i, i + batch);
        const tempFile = `retry_${site.replace('.', '_')}_batch.txt`;
        
        console.log(`\n📦 批次 ${Math.floor(i/batch) + 1}/${Math.ceil(urls.length/batch)} (${batchUrls.length} 篇)`);
        
        // 创建批次文件
        fs.writeFileSync(tempFile, batchUrls.join('\n'));
        
        try {
            console.log(`📝 执行: node batch_process_articles.js ${tempFile}`);
            
            // 针对不同网站使用不同超时时间
            const timeout = site === 'golfdigest.com' ? 180000 : 120000; // Golf Digest 3分钟，其他2分钟
            
            execSync(`node ${path.join(__dirname, 'batch_process_articles.js')} ${tempFile}`, {
                stdio: 'inherit',
                timeout: timeout
            });
            
            totalProcessed += batchUrls.length;
        } catch (error) {
            console.error(`\n❌ 批次处理出错:`, error.message);
        }
        
        // 清理临时文件
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        
        // 批次间休息
        if (i + batch < urls.length) {
            const waitTime = site === 'golfmonthly.com' ? 15 : 10; // Golf Monthly 休息更久
            console.log(`\n⏸️  休息${waitTime}秒后继续...`);
            execSync(`sleep ${waitTime}`);
        }
    }
}

// 生成最终报告
console.log('\n' + '='.repeat(50));
console.log('📊 智能重试完成报告:');
console.log(`   总失败文章: ${totalFailed}`);
console.log(`   尝试处理: ${totalProcessed}`);
console.log('='.repeat(50));
console.log('\n💡 提示: 运行 node analyze_failed_articles.js 查看最新状态');