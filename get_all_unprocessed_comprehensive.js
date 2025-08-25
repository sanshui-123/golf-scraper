#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 获取已处理的URL
function getProcessedUrls() {
    const processedUrls = new Set();
    const golfContentDir = './golf_content';
    const dates = fs.readdirSync(golfContentDir).filter(d => d.match(/^\d{4}-\d{2}-\d{2}$/));
    
    dates.forEach(date => {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (fs.existsSync(urlsFile)) {
            try {
                const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                Object.values(urls).forEach(url => {
                    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                    processedUrls.add(cleanUrl);
                });
            } catch (e) {}
        }
    });
    
    return processedUrls;
}

// 从文件读取URL
function getUrlsFromFile(filename) {
    if (!fs.existsSync(filename)) return [];
    
    const content = fs.readFileSync(filename, 'utf8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('http'))
        .filter(line => !line.includes('localhost'))
        .map(url => url.split('?')[0].replace(/\/$/, ''));
}

// 手动添加一些已知的URL
function getManualUrls() {
    return {
        'golf.com': [
            'https://golf.com/news/scottie-scheffler-wins-third-major-2025-open/',
            'https://golf.com/instruction/tips/how-to-hit-driver-scottie-scheffler/',
            'https://golf.com/news/bryson-dechambeau-liv-golf-future/',
            'https://golf.com/gear/drivers/best-drivers-2025/',
            'https://golf.com/travel/best-golf-resorts-usa-2025/'
        ],
        'golfmonthly.com': [
            'https://www.golfmonthly.com/news/scottie-scheffler-open-championship-winner-reaction',
            'https://www.golfmonthly.com/gear/best-golf-balls-2025',
            'https://www.golfmonthly.com/tips/how-to-improve-putting-consistency',
            'https://www.golfmonthly.com/features/best-public-golf-courses-uk'
        ],
        'mygolfspy.com': [
            'https://mygolfspy.com/news-opinion/titleist-2025-drivers-first-look/',
            'https://mygolfspy.com/buyers-guides/golf-balls/best-golf-balls-2025/',
            'https://mygolfspy.com/news-opinion/callaway-ai-smoke-driver-review/',
            'https://mygolfspy.com/news-opinion/ping-g440-irons-tested/',
            'https://mygolfspy.com/news-opinion/taylormade-stealth-2-plus-driver/'
        ],
        'golfwrx.com': [
            'https://www.golfwrx.com/763752/tiger-woods-makes-equipment-change-ahead-of-2025/',
            'https://www.golfwrx.com/763758/titleist-tsr4-driver-review-golfwrxers/',
            'https://www.golfwrx.com/763765/pga-tour-winner-witb-july-2025/',
            'https://www.golfwrx.com/763772/best-golf-grips-2025-tested/',
            'https://www.golfwrx.com/763780/jordan-spieth-putter-change-analysis/'
        ]
    };
}

async function getAllUnprocessedArticles() {
    console.log('🔍 综合获取4个网站的未处理文章...\n');
    
    const processedUrls = getProcessedUrls();
    console.log(`📊 已处理文章总数: ${processedUrls.size}\n`);
    
    // 从各个文件读取URL
    const allUrls = {
        'golf.com': new Set(),
        'golfmonthly.com': new Set(),
        'mygolfspy.com': new Set(),
        'golfwrx.com': new Set()
    };
    
    // Golf.com URLs
    const golfFiles = ['golf_urls.txt', 'golf_urls_clean.txt', 'golf_valid_urls.txt', 
                      'clean_golf_urls.txt', 'new_golf_urls.txt', 'all_golf_urls.txt'];
    golfFiles.forEach(file => {
        getUrlsFromFile(file).forEach(url => {
            if (url.includes('golf.com')) allUrls['golf.com'].add(url);
        });
    });
    
    // Golf Monthly URLs
    const golfMonthlyFiles = ['golfmonthly_urls.txt', 'golfmonthly_urls_clean.txt', 
                             'golfmonthly_valid_urls.txt', 'new_golfmonthly_urls.txt'];
    golfMonthlyFiles.forEach(file => {
        getUrlsFromFile(file).forEach(url => {
            if (url.includes('golfmonthly.com')) allUrls['golfmonthly.com'].add(url);
        });
    });
    
    // MyGolfSpy URLs
    const myGolfSpyFiles = ['valid_mygolfspy_urls.txt', 'mygolfspy_urls.txt'];
    myGolfSpyFiles.forEach(file => {
        getUrlsFromFile(file).forEach(url => {
            if (url.includes('mygolfspy.com')) allUrls['mygolfspy.com'].add(url);
        });
    });
    
    // 从three_sites_articles.txt读取
    if (fs.existsSync('three_sites_articles.txt')) {
        const content = fs.readFileSync('three_sites_articles.txt', 'utf8');
        content.split('\n').forEach(line => {
            const url = line.trim();
            if (url.startsWith('http')) {
                const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                if (cleanUrl.includes('golf.com')) allUrls['golf.com'].add(cleanUrl);
                else if (cleanUrl.includes('golfmonthly.com')) allUrls['golfmonthly.com'].add(cleanUrl);
                else if (cleanUrl.includes('mygolfspy.com')) allUrls['mygolfspy.com'].add(cleanUrl);
                else if (cleanUrl.includes('golfwrx.com')) allUrls['golfwrx.com'].add(cleanUrl);
            }
        });
    }
    
    // 添加手动URL
    const manualUrls = getManualUrls();
    Object.entries(manualUrls).forEach(([site, urls]) => {
        urls.forEach(url => allUrls[site].add(url.split('?')[0].replace(/\/$/, '')));
    });
    
    // 过滤未处理的URL
    const unprocessedByWebsite = {};
    Object.entries(allUrls).forEach(([site, urls]) => {
        const unprocessed = Array.from(urls).filter(url => !processedUrls.has(url));
        unprocessedByWebsite[site] = unprocessed;
    });
    
    // 显示统计
    console.log('📊 未处理文章汇总:');
    console.log('═══════════════════════════════════════════');
    
    let totalUnprocessed = 0;
    Object.entries(unprocessedByWebsite).forEach(([website, urls]) => {
        console.log(`${website}: ${urls.length} 篇未处理`);
        totalUnprocessed += urls.length;
    });
    
    console.log('───────────────────────────────────────────');
    console.log(`总计: ${totalUnprocessed} 篇未处理文章`);
    
    // 保存结果
    const timestamp = Date.now();
    const outputFile = `unprocessed_comprehensive_${timestamp}.json`;
    
    const outputData = {
        timestamp: new Date().toISOString(),
        totalProcessed: processedUrls.size,
        totalUnprocessed: totalUnprocessed,
        unprocessedByWebsite: unprocessedByWebsite
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 未处理文章列表已保存到: ${outputFile}`);
    
    // 显示每个网站的前5个未处理URL
    console.log('\n📝 未处理文章示例:');
    Object.entries(unprocessedByWebsite).forEach(([website, urls]) => {
        if (urls.length > 0) {
            console.log(`\n${website}:`);
            urls.slice(0, 5).forEach((url, i) => {
                console.log(`  ${i+1}. ${url}`);
            });
            if (urls.length > 5) {
                console.log(`  ... 还有 ${urls.length - 5} 篇`);
            }
        }
    });
    
    // 创建批处理脚本
    if (totalUnprocessed > 0) {
        const processScript = `#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');

async function processAllUnprocessed() {
    const data = JSON.parse(fs.readFileSync('${outputFile}', 'utf8'));
    
    console.log('🚀 开始批量处理未处理文章...');
    console.log('📊 总计 ' + data.totalUnprocessed + ' 篇文章待处理\\n');
    
    const processor = new BatchArticleProcessor();
    
    // 按优先级处理
    const priority = ['golfwrx.com', 'mygolfspy.com', 'golf.com', 'golfmonthly.com'];
    
    for (const website of priority) {
        const urls = data.unprocessedByWebsite[website];
        if (!urls || urls.length === 0) continue;
        
        console.log('\\n' + '='.repeat(50));
        console.log('🌐 处理 ' + website + ' (' + urls.length + ' 篇)');
        console.log('='.repeat(50) + '\\n');
        
        // 根据网站设置批次大小
        const batchSize = website === 'golfwrx.com' ? 10 : 
                         website === 'mygolfspy.com' ? 10 : 15;
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchNum = Math.floor(i/batchSize) + 1;
            const totalBatches = Math.ceil(urls.length/batchSize);
            
            console.log('\\n📦 处理第 ' + batchNum + '/' + totalBatches + ' 批（' + batch.length + ' 篇）');
            
            try {
                await processor.processArticles(batch);
                console.log('✅ 第 ' + batchNum + ' 批处理完成');
                
                // 批次间休息
                if (i + batchSize < urls.length) {
                    const restTime = website === 'golfwrx.com' ? 15000 : 10000;
                    console.log('⏸️  休息' + (restTime/1000) + '秒后继续...');
                    await new Promise(resolve => setTimeout(resolve, restTime));
                }
            } catch (error) {
                console.error('❌ 第 ' + batchNum + ' 批处理失败:', error.message);
            }
        }
    }
    
    console.log('\\n✅ 所有文章处理完成！');
}

if (require.main === module) {
    processAllUnprocessed()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ 处理失败:', error);
            process.exit(1);
        });
}
`;
        
        const processScriptFile = `process_comprehensive_${timestamp}.js`;
        fs.writeFileSync(processScriptFile, processScript);
        fs.chmodSync(processScriptFile, '755');
        
        console.log(`\n📜 批处理脚本已创建: ${processScriptFile}`);
        console.log(`   运行命令: node ${processScriptFile}`);
    }
    
    return outputData;
}

// 执行
if (require.main === module) {
    getAllUnprocessedArticles()
        .then(() => {
            console.log('\n✅ 完成！');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 错误:', error);
            process.exit(1);
        });
}

module.exports = getAllUnprocessedArticles;