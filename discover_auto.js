#!/usr/bin/env node

/**
 * 自动发现并处理新文章（无需确认）
 * 使用方法：
 * node discover_auto.js                              # 扫描24小时内的文章
 * node discover_auto.js --ignore-time                # 扫描所有文章（忽略时间）
 * node discover_auto.js --fetch-detail-time          # 从详情页获取时间
 * node discover_auto.js "https://www.golfmonthly.com/" --ignore-time
 */

const RecentArticleDiscoverer = require('./discover_recent_articles');

async function autoDiscoverAndProcess() {
    const args = process.argv.slice(2);
    const fetchDetailTime = args.includes('--fetch-detail-time');
    const ignoreTime = args.includes('--ignore-time');
    const urlArg = args.find(arg => !arg.startsWith('--'));
    const homepageUrl = urlArg || 'https://www.golfmonthly.com/';
    
    const discoverer = new RecentArticleDiscoverer();
    
    console.log('\n🤖 自动发现并处理新文章模式');
    console.log('📍 扫描主页:', homepageUrl);
    if (fetchDetailTime) {
        console.log('💡 已启用从详情页获取时间');
    }
    if (ignoreTime) {
        console.log('⚡ 已启用忽略时间模式（获取所有文章）');
    }
    
    try {
        const result = await discoverer.discoverRecentArticles(homepageUrl, { fetchDetailTime, ignoreTime });
        
        console.log('\n📊 扫描结果汇总:');
        console.log(`  - 总文章数: ${result.total}`);
        console.log(`  - 24小时内: ${result.recent}`);
        console.log(`  - 新文章数: ${result.new}`);
        
        if (result.newArticles.length > 0) {
            console.log('\n🆕 发现新文章:');
            result.newArticles.forEach((article, index) => {
                console.log(`${index + 1}. ${article.title}`);
                console.log(`   ${article.url}`);
            });
            
            console.log('\n🚀 自动开始处理...');
            await discoverer.processNewArticles(result.newArticles);
            
            console.log('\n✅ 自动处理完成！');
            console.log(`📊 共处理 ${result.newArticles.length} 篇新文章`);
        } else {
            console.log('\n✅ 没有新文章需要处理');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ 处理过程中出错:', error);
        process.exit(1);
    }
}

// 运行自动处理
autoDiscoverAndProcess();