const GolfWRXScraper = require('./golfwrx_scraper');
const BatchProcessor = require('./batch_process_articles');
const path = require('path');

/**
 * 处理 GolfWRX 网站的文章
 * 使用方式：
 * - node process_golfwrx.js          # 只获取URL列表
 * - node process_golfwrx.js process  # 获取并处理文章
 * - node process_golfwrx.js process 5  # 处理最新的5篇文章
 */
async function processGolfWRX() {
    const args = process.argv.slice(2);
    const shouldProcess = args[0] === 'process';
    const articleLimit = parseInt(args[1]) || 10;
    const urlsOnly = args.includes('--urls-only');
    
    // 在 --urls-only 模式下禁用日志输出
    if (urlsOnly) {
        const originalLog = console.log;
        console.log = function(...args) {
            // 只允许输出URL
            if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('https://')) {
                originalLog.apply(console, args);
            }
        };
        console.error = () => {};
    }

    console.log('\n🚀 GolfWRX 处理器启动');
    
    const scraper = new GolfWRXScraper();
    
    // 步骤1: 获取文章URL
    console.log('\n📡 步骤1: 从 GolfWRX 获取文章URL...');
    const urls = await scraper.getRecentArticles(articleLimit);
    
    if (urls.length === 0) {
        console.log('❌ 未能获取到任何文章URL');
        return;
    }
    
    console.log(`✅ 成功获取 ${urls.length} 个文章URL`);
    
    if (!shouldProcess) {
        if (urlsOnly) {
            // --urls-only 模式：只输出URL
            urls.forEach((url) => {
                console.log(url);
            });
        } else {
            // 正常模式：输出详细信息
            console.log('\n📋 获取到的URL列表:');
            urls.forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
            console.log('\n💡 提示: 使用 "node process_golfwrx.js process" 来处理这些文章');
        }
        return;
    }
    
    // 步骤2: 使用批处理系统处理文章
    console.log('\n🔄 步骤2: 使用批处理系统处理文章...');
    
    const processor = new BatchProcessor();
    
    // GolfWRX 特殊提示
    if (urls.some(url => url.includes('golfwrx.com'))) {
        console.log('\n⚠️  GolfWRX 提示:');
        console.log('- 该网站可能使用Cloudflare保护');
        console.log('- 如遇到访问问题，脚本会自动重试');
        console.log('- 建议在网络状况良好时运行\n');
    }
    
    console.log(`\n📊 将处理最新的 ${urls.length} 篇文章`);
    
    // 处理文章
    await processor.processArticles(urls);
}

// 运行主函数
processGolfWRX().catch(error => {
    console.error('\n❌ 处理过程中发生错误:', error);
    process.exit(1);
});