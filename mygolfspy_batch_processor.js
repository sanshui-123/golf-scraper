#!/usr/bin/env node

/**
 * MyGolfSpy批处理器 - 集成RSS和现有批处理系统
 * 完全兼容现有的batch_process_articles.js
 */

const { MyGolfSpyRSSProcessor } = require('./mygolfspy_complete_solution');
const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs').promises;
const path = require('path');

class MyGolfSpyBatchProcessor {
    constructor() {
        this.rssProcessor = new MyGolfSpyRSSProcessor();
        this.batchProcessor = new BatchArticleProcessor();
        this.tempDir = '/tmp';
    }

    /**
     * 主处理函数 - 从RSS获取URL并使用现有系统处理
     * @param {Object} options - 处理选项
     * @param {number} options.limit - 限制处理的文章数量
     * @param {boolean} options.skipFailed - 是否跳过已知会失败的URL
     * @param {boolean} options.testMode - 测试模式，只获取URL不处理
     */
    async processMyGolfSpy(options = {}) {
        const { limit = 10, skipFailed = true, testMode = false } = options;
        
        console.log('🏌️ MyGolfSpy批处理器启动');
        console.log(`📊 选项: 限制=${limit}, 跳过失败=${skipFailed}, 测试模式=${testMode}\n`);

        try {
            // 第一步：通过RSS获取所有可用的URL
            console.log('📡 步骤1: 从RSS获取文章URL...');
            const rssData = await this.rssProcessor.scrapeAllRSSFeeds();
            
            if (rssData.articles.length === 0) {
                console.log('❌ 没有获取到任何文章');
                return { success: false, processed: 0 };
            }

            console.log(`✅ RSS获取成功: ${rssData.articles.length} 篇文章\n`);

            // 第二步：准备URL列表
            const urls = rssData.articles
                .slice(0, limit)
                .map(article => article.url)
                .filter(url => this.isValidArticleUrl(url));

            console.log(`📋 准备处理 ${urls.length} 个URL`);

            if (testMode) {
                // 测试模式：只保存URL列表
                const testFile = path.join(this.tempDir, 'mygolfspy_test_urls.txt');
                await fs.writeFile(testFile, urls.join('\n'));
                
                console.log(`\n✅ 测试模式: URL已保存到 ${testFile}`);
                console.log('📝 URL示例:');
                urls.slice(0, 5).forEach((url, i) => {
                    console.log(`${i + 1}. ${url}`);
                });
                
                return {
                    success: true,
                    testMode: true,
                    urlFile: testFile,
                    urlCount: urls.length
                };
            }

            // 第三步：检查失败记录（如果启用）
            if (skipFailed) {
                const filteredUrls = await this.filterOutFailedUrls(urls);
                console.log(`📊 过滤后: ${filteredUrls.length} 个新URL\n`);
                
                if (filteredUrls.length === 0) {
                    console.log('⚠️  所有URL都在失败记录中，建议使用RSS摘要信息');
                    return this.generateRSSReport(rssData.articles.slice(0, limit));
                }
                
                urls.length = 0;
                urls.push(...filteredUrls);
            }

            // 第四步：使用现有的批处理系统
            console.log('🔄 步骤2: 使用批处理系统处理文章...\n');
            
            // 创建临时URL文件供批处理系统使用
            const tempUrlFile = path.join(this.tempDir, `mygolfspy_batch_${Date.now()}.txt`);
            await fs.writeFile(tempUrlFile, urls.join('\n'));

            // 调用现有的批处理系统
            const result = await this.batchProcessor.processArticles(urls);

            // 清理临时文件
            try {
                await fs.unlink(tempUrlFile);
            } catch (e) {
                // 忽略清理错误
            }

            console.log('\n✅ MyGolfSpy批处理完成！');
            
            return {
                success: true,
                processed: urls.length,
                rssData: rssData,
                result: result
            };

        } catch (error) {
            console.error('❌ 处理失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 检查URL是否有效
     */
    isValidArticleUrl(url) {
        return url && 
               url.includes('mygolfspy.com') && 
               !url.includes('/feed/') &&
               !url.includes('/wp-admin/') &&
               (url.includes('/reviews/') || 
                url.includes('/news/') || 
                url.includes('/instruction/') ||
                url.includes('/news-opinion/'));
    }

    /**
     * 过滤掉失败记录中的URL
     */
    async filterOutFailedUrls(urls) {
        try {
            const failedFile = path.join(process.cwd(), 'failed_articles.json');
            const failedData = await fs.readFile(failedFile, 'utf8');
            const failedArticles = JSON.parse(failedData);
            
            return urls.filter(url => {
                const isInFailed = failedArticles.hasOwnProperty(url);
                if (isInFailed) {
                    const failedInfo = failedArticles[url];
                    // 如果状态是pending_retry，可以重试
                    if (failedInfo.status === 'pending_retry') {
                        return true;
                    }
                    console.log(`⏭️  跳过失败URL: ${url}`);
                    return false;
                }
                return true;
            });
        } catch (error) {
            // 如果读取失败记录失败，返回所有URL
            return urls;
        }
    }

    /**
     * 生成RSS摘要报告（当无法直接访问时的后备方案）
     */
    async generateRSSReport(articles) {
        console.log('\n📄 生成RSS摘要报告...');
        
        const reportContent = articles.map((article, index) => {
            return `
## ${index + 1}. ${article.title}

**链接**: ${article.url}
**分类**: ${article.category}
**发布时间**: ${article.publishDate || 'N/A'}
**作者**: ${article.author || 'N/A'}

**摘要**: ${article.description || '无摘要'}

---
`;
        }).join('\n');

        const reportFile = path.join(process.cwd(), 'mygolfspy_rss_summary.md');
        await fs.writeFile(reportFile, `# MyGolfSpy RSS摘要\n\n${reportContent}`);
        
        console.log(`✅ RSS摘要已保存: ${reportFile}`);
        
        return {
            success: true,
            fallbackMode: true,
            reportFile: reportFile,
            articleCount: articles.length
        };
    }

    /**
     * 智能处理模式 - 自动选择最佳策略
     */
    async smartProcess() {
        console.log('🤖 启动智能处理模式...\n');
        
        // 首先尝试获取RSS
        const rssData = await this.rssProcessor.scrapeAllRSSFeeds();
        
        if (rssData.articles.length === 0) {
            console.log('❌ RSS获取失败');
            return { success: false };
        }

        // 测试第一个URL的可访问性
        console.log('🔍 测试URL可访问性...');
        const testUrl = rssData.articles[0].url;
        const isAccessible = await this.testUrlAccessibility(testUrl);
        
        if (isAccessible) {
            console.log('✅ URL可访问，使用标准处理流程');
            return this.processMyGolfSpy({ limit: 10, skipFailed: true });
        } else {
            console.log('❌ URL不可访问（403），使用RSS摘要模式');
            return this.generateRSSReport(rssData.articles.slice(0, 10));
        }
    }

    /**
     * 测试URL可访问性
     */
    async testUrlAccessibility(url) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            return response.status < 400;
        } catch (error) {
            return false;
        }
    }
}

// 命令行处理
if (require.main === module) {
    const processor = new MyGolfSpyBatchProcessor();
    const args = process.argv.slice(2);
    const command = args[0] || 'smart';
    
    switch (command) {
        case 'process':
            // 标准处理模式
            const limit = parseInt(args[1]) || 10;
            processor.processMyGolfSpy({ limit })
                .then(result => {
                    if (!result.success) {
                        process.exit(1);
                    }
                })
                .catch(error => {
                    console.error('❌ 错误:', error);
                    process.exit(1);
                });
            break;
            
        case 'test':
            // 测试模式 - 只获取URL
            processor.processMyGolfSpy({ limit: 20, testMode: true })
                .then(result => console.log('\n测试完成'))
                .catch(console.error);
            break;
            
        case 'smart':
            // 智能模式 - 自动选择最佳策略
            processor.smartProcess()
                .then(result => console.log('\n智能处理完成'))
                .catch(console.error);
            break;
            
        case 'help':
        default:
            console.log(`
MyGolfSpy批处理器 - 使用说明

命令:
  node mygolfspy_batch_processor.js smart            - 智能模式（推荐）
  node mygolfspy_batch_processor.js process [数量]   - 标准处理模式
  node mygolfspy_batch_processor.js test             - 测试模式（只获取URL）
  node mygolfspy_batch_processor.js help             - 显示帮助

示例:
  node mygolfspy_batch_processor.js smart            - 自动选择最佳处理策略
  node mygolfspy_batch_processor.js process 5        - 处理5篇文章
  node mygolfspy_batch_processor.js test             - 测试RSS获取功能

说明:
  智能模式会自动检测URL可访问性，选择最合适的处理方式。
  如果遇到403错误，会自动切换到RSS摘要模式。
            `);
            break;
    }
}

module.exports = MyGolfSpyBatchProcessor;