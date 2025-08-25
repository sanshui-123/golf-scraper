#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const BatchArticleProcessor = require('./batch_process_articles');

class TrulyFailedRetryProcessor {
    constructor() {
        this.failedArticles = [];
        this.siteBatches = {
            'golf.com': [],
            'golfmonthly.com': [],
            'mygolfspy.com': [],
            'golfdigest.com': [],
            'golfwrx.com': []
        };
        this.skippedUrls = []; // URLs to skip
    }

    // Extract domain from URL
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return 'unknown';
        }
    }

    // Scan all article_urls.json files
    scanForFailedArticles() {
        console.log('🔍 扫描所有日期目录查找失败的文章...\n');
        
        const golfContentDir = path.join(process.cwd(), 'golf_content');
        
        if (!fs.existsSync(golfContentDir)) {
            console.error('❌ golf_content目录不存在');
            return;
        }

        // Get all date directories
        const dateDirs = fs.readdirSync(golfContentDir)
            .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
            .sort();

        console.log(`📅 找到 ${dateDirs.length} 个日期目录\n`);

        // Track all failed articles for statistics
        let allFailedArticles = 0;
        let skippedReasons = {
            '404错误': 0,
            '内容过长': 0,
            '处理中断': 0,
            '其他错误': 0
        };

        dateDirs.forEach(dateDir => {
            const urlsFile = path.join(golfContentDir, dateDir, 'article_urls.json');
            
            if (fs.existsSync(urlsFile)) {
                try {
                    const urlMapping = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                    
                    Object.entries(urlMapping).forEach(([articleNum, record]) => {
                        // Handle both old and new format
                        if (typeof record === 'object') {
                            // Count all failed articles
                            if (record.status === 'failed') {
                                allFailedArticles++;
                                
                                // Categorize by error type
                                if (record.error && record.error.includes('404')) {
                                    skippedReasons['404错误']++;
                                } else if (record.error && record.error.includes('Processing interrupted')) {
                                    skippedReasons['处理中断']++;
                                } else if (record.error === 'Processing timeout') {
                                    // Skip URLs that are just category pages
                                    if (record.url.endsWith('/gear/') || 
                                        record.url.endsWith('/news/') ||
                                        record.url.endsWith('/instruction/')) {
                                        skippedReasons['其他错误']++;
                                        this.skippedUrls.push({
                                            url: record.url,
                                            reason: '分类页面URL'
                                        });
                                    } else {
                                        // Only add timeout errors to retry list
                                        const domain = this.extractDomain(record.url);
                                        
                                        this.failedArticles.push({
                                            url: record.url,
                                            articleNum,
                                            dateDir,
                                            domain,
                                            retryCount: record.retryCount || 0,
                                            failedAt: record.failedAt
                                        });

                                        // Add to site-specific batch
                                        if (this.siteBatches[domain]) {
                                            this.siteBatches[domain].push({
                                                url: record.url,
                                                articleNum,
                                                dateDir
                                            });
                                        }
                                    }
                                } else {
                                    skippedReasons['其他错误']++;
                                }
                            } else if (record.status === 'skipped' && record.reason === '内容过长') {
                                skippedReasons['内容过长']++;
                            }
                        }
                    });
                } catch (e) {
                    console.error(`❌ 读取 ${urlsFile} 失败:`, e.message);
                }
            }
        });

        console.log(`\n📊 扫描完成统计：`);
        console.log(`   - 总失败文章数: ${allFailedArticles}`);
        console.log(`   - 404错误: ${skippedReasons['404错误']} 篇（已跳过）`);
        console.log(`   - 内容过长: ${skippedReasons['内容过长']} 篇（已跳过）`);
        console.log(`   - 处理中断: ${skippedReasons['处理中断']} 篇（已跳过）`);
        console.log(`   - 其他错误: ${skippedReasons['其他错误']} 篇（已跳过）`);
        console.log(`   - 处理超时: ${this.failedArticles.length} 篇（将重试）\n`);
        
        if (this.skippedUrls.length > 0) {
            console.log(`⚠️  跳过的URL（分类页面等）：`);
            this.skippedUrls.forEach(item => {
                console.log(`   - ${item.url} (${item.reason})`);
            });
            console.log('');
        }
    }

    // Display summary of failed articles
    displaySummary() {
        console.log('═══════════════════════════════════════════════════');
        console.log('📋 失败文章汇总（仅处理超时）');
        console.log('═══════════════════════════════════════════════════\n');

        if (this.failedArticles.length === 0) {
            console.log('✅ 没有找到处理超时的文章！');
            return false;
        }

        // Group by site
        const siteSummary = {};
        this.failedArticles.forEach(article => {
            if (!siteSummary[article.domain]) {
                siteSummary[article.domain] = [];
            }
            siteSummary[article.domain].push(article);
        });

        // Display by site
        Object.entries(siteSummary).forEach(([domain, articles]) => {
            console.log(`\n🌐 ${domain} (${articles.length} 篇):`);
            articles.forEach(article => {
                console.log(`   📄 文章${article.articleNum} - ${article.dateDir}`);
                console.log(`      URL: ${article.url}`);
                console.log(`      失败时间: ${article.failedAt}`);
                if (article.retryCount > 0) {
                    console.log(`      重试次数: ${article.retryCount}`);
                }
            });
        });

        console.log('\n═══════════════════════════════════════════════════');
        console.log(`📊 总计: ${this.failedArticles.length} 篇文章需要重试`);
        console.log('═══════════════════════════════════════════════════\n');

        return true;
    }

    // Process articles in batches by site
    async processBySite() {
        console.log('🚀 开始按网站批量处理失败的文章...\n');

        const batchConfigs = {
            'golf.com': { batchSize: 2, delay: 10000 },
            'golfmonthly.com': { batchSize: 1, delay: 15000 },
            'mygolfspy.com': { batchSize: 2, delay: 12000 },
            'golfdigest.com': { batchSize: 1, delay: 15000 },
            'golfwrx.com': { batchSize: 2, delay: 10000 }
        };

        for (const [domain, articles] of Object.entries(this.siteBatches)) {
            if (articles.length === 0) continue;

            console.log(`\n📍 处理 ${domain} 的文章 (${articles.length} 篇)`);
            
            const config = batchConfigs[domain] || { batchSize: 2, delay: 10000 };
            const batches = [];
            
            // Create batches
            for (let i = 0; i < articles.length; i += config.batchSize) {
                batches.push(articles.slice(i, i + config.batchSize));
            }

            console.log(`   分成 ${batches.length} 批，每批 ${config.batchSize} 篇`);

            // Process each batch
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const urls = batch.map(a => a.url);
                
                console.log(`\n   🔄 处理第 ${i + 1}/${batches.length} 批 (${urls.length} 篇)`);
                
                try {
                    const processor = new BatchArticleProcessor();
                    await processor.processArticles(urls, { skipDuplicateCheck: true });
                    
                    console.log(`   ✅ 第 ${i + 1} 批处理完成`);
                } catch (error) {
                    console.error(`   ❌ 第 ${i + 1} 批处理失败:`, error.message);
                }

                // Delay between batches
                if (i < batches.length - 1) {
                    console.log(`   ⏳ 等待 ${config.delay / 1000} 秒后继续下一批...`);
                    await new Promise(resolve => setTimeout(resolve, config.delay));
                }
            }
        }

        console.log('\n✅ 所有失败文章处理完成！');
    }

    // Main execution
    async run() {
        // Scan for failed articles
        this.scanForFailedArticles();

        // Display summary
        const hasFailedArticles = this.displaySummary();

        if (!hasFailedArticles) {
            return;
        }

        // Ask for confirmation
        console.log('⚠️  注意事项：');
        console.log('   1. 将按网站分批处理，避免API过载');
        console.log('   2. Golf Monthly每批只处理1篇（最容易超时）');
        console.log('   3. 每批之间会有延迟等待');
        console.log('   4. 请确保 web_server.js 正在运行（端口8080）\n');

        // Wait for user to be ready
        console.log('📌 准备开始处理，按Ctrl+C取消...');
        console.log('⏳ 5秒后开始处理...\n');
        
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Process articles
        await this.processBySite();

        // Final report
        console.log('\n📊 处理完成！请检查结果：');
        console.log('   1. 访问 http://localhost:8080 查看新处理的文章');
        console.log('   2. 检查 failed_articles.json 查看仍然失败的文章');
        console.log('   3. 运行 node clean_duplicate_articles.js 清理可能的重复\n');
    }
}

// Execute if run directly
if (require.main === module) {
    const processor = new TrulyFailedRetryProcessor();
    processor.run().catch(console.error);
}

module.exports = TrulyFailedRetryProcessor;