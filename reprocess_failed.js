#!/usr/bin/env node

// 重新处理失败状态的文章
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 重新处理失败的文章...\n');

const golfContentDir = path.join(__dirname, 'golf_content');
const failedArticles = [];

// 收集所有失败的文章
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
                    failedArticles.push({
                        date,
                        num,
                        url: value.url,
                        error: value.error
                    });
                }
            }
        });
    });

console.log(`📊 找到 ${failedArticles.length} 篇失败的文章需要重新处理\n`);

if (failedArticles.length === 0) {
    console.log('✨ 没有失败的文章需要处理');
    process.exit(0);
}

// 按日期分组
const byDate = {};
failedArticles.forEach(article => {
    if (!byDate[article.date]) {
        byDate[article.date] = [];
    }
    byDate[article.date].push(article);
});

// 逐日期处理
for (const [date, articles] of Object.entries(byDate)) {
    console.log(`\n📅 处理 ${date} 的 ${articles.length} 篇文章...`);
    
    // 切换到对应日期目录
    process.chdir(path.join(golfContentDir, date));
    
    // 每次处理3篇，避免过载
    for (let i = 0; i < articles.length; i += 3) {
        const batch = articles.slice(i, i + 3);
        console.log(`\n🔄 处理第 ${Math.floor(i/3) + 1} 批...`);
        
        for (const article of batch) {
            console.log(`\n📄 重新处理文章 ${article.num}: ${article.url}`);
            
            try {
                // 创建临时处理脚本
                const script = `
const BatchArticleProcessor = require('${path.join(__dirname, 'batch_process_articles.js')}').BatchArticleProcessor;
const processor = new BatchArticleProcessor();

(async () => {
    processor.baseDir = '${path.join(golfContentDir, date)}';
    const article = {
        url: '${article.url}',
        title: '重新处理'
    };
    
    try {
        await processor.processArticle(article, '${article.num}');
        console.log('✅ 文章 ${article.num} 处理成功');
        
        // 更新状态
        const urlsFile = '${path.join(golfContentDir, date, 'article_urls.json')}';
        const urls = JSON.parse(require('fs').readFileSync(urlsFile, 'utf8'));
        urls['${article.num}'] = '${article.url}';
        require('fs').writeFileSync(urlsFile, JSON.stringify(urls, null, 2));
        
    } catch (error) {
        console.error('❌ 文章 ${article.num} 处理失败:', error.message);
    }
})();
`;
                
                const tempScript = path.join(__dirname, `temp_process_${article.num}.js`);
                fs.writeFileSync(tempScript, script);
                
                execSync(`node ${tempScript}`, { stdio: 'inherit' });
                
                // 清理临时文件
                fs.unlinkSync(tempScript);
                
            } catch (error) {
                console.error(`❌ 处理文章 ${article.num} 时出错:`, error.message);
            }
        }
        
        // 批次间休息
        if (i + 3 < articles.length) {
            console.log('\n⏸️  休息5秒...');
            execSync('sleep 5');
        }
    }
}

console.log('\n✅ 所有失败文章处理完成');