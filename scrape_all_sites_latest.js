const { execSync } = require('child_process');
const fs = require('fs');

console.log('🏌️ 抓取4个高尔夫网站的最新文章...\n');

// 网站列表
const sites = [
    { name: 'Golf.com', url: 'https://golf.com' },
    { name: 'Golf Monthly', url: 'https://www.golfmonthly.com' },
    { name: 'MyGolfSpy', url: 'https://mygolfspy.com' },
    { name: 'GolfWRX', url: 'https://www.golfwrx.com' }
];

// 创建临时文件存储所有新文章
const allArticlesFile = 'all_new_articles_temp.txt';
fs.writeFileSync(allArticlesFile, '');

// 逐个网站抓取
for (const site of sites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📰 正在抓取 ${site.name}...`);
    console.log(`${'='.repeat(60)}\n`);
    
    try {
        // 使用discover_recent_articles.js抓取每个网站
        const output = execSync(`node discover_recent_articles.js "${site.url}" --skip-process --recent-hours 48`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        // 提取新文章URL
        const urlMatches = output.match(/https?:\/\/[^\s]+/g) || [];
        const newArticles = urlMatches.filter(url => 
            url.includes(site.url.replace('https://', '').replace('www.', ''))
        );
        
        if (newArticles.length > 0) {
            console.log(`✅ 发现 ${newArticles.length} 篇新文章`);
            fs.appendFileSync(allArticlesFile, newArticles.join('\n') + '\n');
        } else {
            console.log(`⚠️  ${site.name} 没有发现新文章`);
        }
        
    } catch (error) {
        console.log(`❌ ${site.name} 抓取失败:`, error.message);
    }
}

// 读取所有收集的文章
const allArticles = fs.readFileSync(allArticlesFile, 'utf8')
    .split('\n')
    .filter(url => url.trim());

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 总结:`);
console.log(`   发现 ${allArticles.length} 篇新文章`);
console.log(`${'='.repeat(60)}\n`);

if (allArticles.length > 0) {
    console.log('🚀 开始批量处理所有文章...\n');
    
    try {
        execSync(`node batch_process_articles.js ${allArticlesFile}`, {
            stdio: 'inherit'
        });
    } catch (error) {
        console.log('❌ 批量处理失败:', error.message);
    }
} else {
    console.log('😊 所有网站都没有新文章');
}

// 清理临时文件
fs.unlinkSync(allArticlesFile);