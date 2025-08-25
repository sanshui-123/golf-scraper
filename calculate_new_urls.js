#!/usr/bin/env node

/**
 * 计算实际需要处理的新URL数量
 * 对每个deep_urls_*.txt文件进行去重检查
 */

const fs = require('fs').promises;
const path = require('path');

async function calculateNewUrls() {
    const results = {};
    
    // 获取所有URL文件
    const urlFiles = [
        'deep_urls_golf_com.txt',
        'deep_urls_golfmonthly_com.txt',
        'deep_urls_mygolfspy_com.txt',
        'deep_urls_www_golfwrx_com.txt',
        'deep_urls_www_golfdigest_com.txt',
        'deep_urls_todays_golfer_com.txt'
    ];
    
    // 读取所有日期的article_urls.json获取已处理的URL
    let processedUrls = new Set();
    
    // 获取golf_content目录下的所有日期文件夹
    try {
        const golfContentDir = path.join(__dirname, 'golf_content');
        const dateDirs = await fs.readdir(golfContentDir);
        
        for (const dateDir of dateDirs) {
            // 跳过非日期格式的文件夹
            if (!dateDir.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
            
            const articleUrlsPath = path.join(golfContentDir, dateDir, 'article_urls.json');
            try {
                const articleData = await fs.readFile(articleUrlsPath, 'utf8');
                const articles = JSON.parse(articleData);
                
                // 收集所有URL（不管状态）
                Object.values(articles).forEach(article => {
                    if (article.url) {
                        processedUrls.add(article.url);
                    }
                });
            } catch (e) {
                // 某个日期的文件不存在，继续
            }
        }
        
        console.log(`📚 已收集 ${processedUrls.size} 个历史URL`);
        
    } catch (e) {
        console.error('无法读取golf_content目录');
    }
    
    // 计算每个网站的新URL数量
    for (const file of urlFiles) {
        try {
            const content = await fs.readFile(file, 'utf8');
            const urls = content.trim().split('\n').filter(line => line.startsWith('http'));
            
            // 统计新URL
            let newCount = 0;
            for (const url of urls) {
                if (!processedUrls.has(url)) {
                    newCount++;
                }
            }
            
            const siteName = file.replace('deep_urls_', '').replace('.txt', '').replace(/_/g, '.');
            results[siteName] = {
                total: urls.length,
                processed: urls.length - newCount,
                new: newCount
            };
            
        } catch (e) {
            // 文件不存在
        }
    }
    
    // 保存结果
    await fs.writeFile('url_statistics.json', JSON.stringify(results, null, 2));
    
    // 输出统计
    console.log('\n📊 URL统计结果：');
    console.log('=====================================');
    
    let totalUrls = 0;
    let totalNew = 0;
    
    for (const [site, stats] of Object.entries(results)) {
        console.log(`\n${site}:`);
        console.log(`  总URL数: ${stats.total}`);
        console.log(`  已处理: ${stats.processed}`);
        console.log(`  🆕 新URL: ${stats.new}`);
        
        totalUrls += stats.total;
        totalNew += stats.new;
    }
    
    console.log('\n=====================================');
    console.log(`总计: ${totalUrls} URLs, 其中 ${totalNew} 个是新的`);
    
    return results;
}

// 执行
if (require.main === module) {
    calculateNewUrls().catch(console.error);
}

module.exports = calculateNewUrls;