#!/usr/bin/env node

const testSingleArticle = require('./test_single_article');

// 每个网站的测试文章
const testArticles = {
    'golfmonthly.com': 'https://www.golfmonthly.com/news/phil-mickelson-tiger-woods-head-to-head-record',
    'golf.com': 'https://golf.com/instruction/tips/never-chunk-chip-shot-again-easy-trick/',
    'mygolfspy.com': 'https://mygolfspy.com/best-golf-drivers/',
    'golfwrx.com': 'https://www.golfwrx.com/category/instruction/',
    'golfdigest.com': 'https://www.golfdigest.com/story/tiger-woods-pga-tour-wins-82',
    'pgatour.com': 'https://www.pgatour.com/news',
    'golfchannel.com': 'https://www.golfchannel.com/news'
};

async function testAllWebsites() {
    console.log('🌐 测试所有配置的网站...\n');
    
    const results = [];
    
    for (const [domain, url] of Object.entries(testArticles)) {
        console.log(`\n========== 测试 ${domain} ==========`);
        
        try {
            await testSingleArticle(url);
            results.push({ domain, status: '✅ 成功' });
        } catch (error) {
            results.push({ domain, status: '❌ 失败', error: error.message });
        }
        
        // 等待2秒再测试下一个
        if (domain !== Object.keys(testArticles).pop()) {
            console.log('\n⏳ 等待2秒...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // 显示测试摘要
    console.log('\n\n📊 测试摘要');
    console.log('=====================================');
    results.forEach(result => {
        console.log(`${result.domain}: ${result.status}`);
        if (result.error) {
            console.log(`   错误: ${result.error}`);
        }
    });
}

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help')) {
        console.log('\n批量测试所有网站的文章抓取效果');
        console.log('\n使用方法:');
        console.log('  node test_all_websites.js');
        console.log('\n注意: 请提供每个网站的真实文章URL进行测试');
        process.exit(0);
    }
    
    console.log('⚠️ 注意: 测试URL可能需要更新为真实的文章链接\n');
    
    testAllWebsites().catch(console.error);
}

module.exports = testAllWebsites;