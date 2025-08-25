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

// 从现有文件中读取URL
function getUrlsFromFile(filename) {
    if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename, 'utf8');
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('http'))
            .filter(line => !line.includes('localhost'));
    }
    return [];
}

async function getAllUnprocessedArticles() {
    console.log('🔍 获取4个网站的未处理文章...\n');
    
    const processedUrls = getProcessedUrls();
    console.log(`📊 已处理文章总数: ${processedUrls.size}\n`);
    
    // 从现有的URL文件中读取
    const files = {
        'golf.com': ['golf_urls.txt', 'golf_urls_clean.txt', 'golf_valid_urls.txt', 'clean_golf_urls.txt'],
        'golfmonthly.com': ['golfmonthly_urls.txt', 'golfmonthly_urls_clean.txt', 'golfmonthly_valid_urls.txt', 'clean_golfmonthly_urls.txt'],
        'mygolfspy.com': ['valid_mygolfspy_urls.txt', 'new_all_urls.txt'],
        'golfwrx.com': ['golfwrx_unprocessed.json']
    };
    
    const unprocessedByWebsite = {};
    
    // 处理每个网站
    for (const [website, fileList] of Object.entries(files)) {
        let allUrls = new Set();
        
        for (const file of fileList) {
            if (file.endsWith('.json') && fs.existsSync(file)) {
                // 处理JSON文件
                try {
                    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                    if (data.unprocessedUrls) {
                        data.unprocessedUrls.forEach(url => allUrls.add(url));
                    }
                } catch (e) {}
            } else {
                // 处理文本文件
                const urls = getUrlsFromFile(file);
                urls.forEach(url => {
                    if (url.includes(website)) {
                        allUrls.add(url);
                    }
                });
            }
        }
        
        // 过滤未处理的
        const unprocessed = Array.from(allUrls).filter(url => {
            const cleanUrl = url.split('?')[0].replace(/\/$/, '');
            return !processedUrls.has(cleanUrl);
        });
        
        unprocessedByWebsite[website] = unprocessed;
        console.log(`${website}: 找到 ${allUrls.size} 个URL，未处理 ${unprocessed.length} 个`);
    }
    
    // 汇总统计
    console.log('\n📊 未处理文章汇总:');
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
    const outputFile = `unprocessed_all_${timestamp}.json`;
    
    const outputData = {
        timestamp: new Date().toISOString(),
        totalProcessed: processedUrls.size,
        totalUnprocessed: totalUnprocessed,
        unprocessedByWebsite: unprocessedByWebsite
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 未处理文章列表已保存到: ${outputFile}`);
    
    // 创建批处理脚本
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
    
    const processScriptFile = `process_all_unprocessed_${timestamp}.js`;
    fs.writeFileSync(processScriptFile, processScript);
    fs.chmodSync(processScriptFile, '755');
    
    console.log(`\n📜 批处理脚本已创建: ${processScriptFile}`);
    console.log(`   运行命令: node ${processScriptFile}`);
    
    // 显示每个网站的前5个未处理URL
    console.log('\n📝 未处理文章示例:');
    Object.entries(unprocessedByWebsite).forEach(([website, urls]) => {
        if (urls.length > 0) {
            console.log(`\n${website}:`);
            urls.slice(0, 5).forEach((url, i) => {
                console.log(`  ${i+1}. ${url.split('?')[0]}`);
            });
            if (urls.length > 5) {
                console.log(`  ... 还有 ${urls.length - 5} 篇`);
            }
        }
    });
    
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