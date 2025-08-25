#!/usr/bin/env node

/**
 * MyGolfSpy RSS处理器
 * 使用RSS Feed获取文章URL，然后调用现有的批处理系统
 */

const MyGolfSpyRSSScraper = require('./mygolfspy_rss_scraper');
const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');
const path = require('path');

// 动态加载混合抓取器（如果需要）
let MyGolfSpyHybridScraper;
try {
    MyGolfSpyHybridScraper = require('./mygolfspy_hybrid_scraper');
} catch (e) {
    // 如果混合抓取器不存在，继续使用RSS抓取器
}

async function processMyGolfSpyViaRSS(limit = 10) {
    console.log('🚀 MyGolfSpy RSS处理器启动\n');
    
    try {
        let urls;
        
        // 如果需要超过10篇文章且混合抓取器可用，使用混合抓取器
        if (limit > 10 && MyGolfSpyHybridScraper) {
            console.log('📡 步骤1: 使用混合模式获取文章URL（RSS + 网页抓取）...');
            const hybridScraper = new MyGolfSpyHybridScraper();
            urls = await hybridScraper.getArticleUrls(limit);
        } else {
            // 否则使用原有的RSS抓取器
            console.log('📡 步骤1: 从RSS Feed获取文章URL...');
            const rssScraper = new MyGolfSpyRSSScraper();
            urls = await rssScraper.getLatestArticleUrls(limit);
        }
        
        if (urls.length === 0) {
            console.log('❌ 没有获取到任何URL');
            return;
        }
        
        console.log(`✅ 成功获取 ${urls.length} 个文章URL\n`);
        
        // 显示获取到的URL
        console.log('📋 获取到的URL列表:');
        urls.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });
        console.log('');
        
        // 第二步：使用现有的批处理系统处理这些URL
        console.log('🔄 步骤2: 使用批处理系统处理文章...\n');
        
        const processor = new BatchArticleProcessor();
        // MyGolfSpy的文章总是处理，不进行跨日期重复检查
        await processor.processArticles(urls, { skipDuplicateCheck: true });
        
        console.log('\n✅ MyGolfSpy RSS处理完成！');
        
    } catch (error) {
        console.error('❌ 处理失败:', error.message);
        process.exit(1);
    }
}

// 命令行参数处理
if (require.main === module) {
    const args = process.argv.slice(2);
    
    // 检查是否为--urls-only模式（与其他网站脚本兼容）
    if (args.includes('--urls-only')) {
        const limitIndex = args.findIndex(arg => !isNaN(parseInt(arg)));
        const limit = limitIndex >= 0 ? parseInt(args[limitIndex]) : 50;
        
        // 静默模式：只输出URL，不输出其他信息
        if (limit > 10 && MyGolfSpyHybridScraper) {
            const hybridScraper = new MyGolfSpyHybridScraper();
            hybridScraper.getArticleUrls(limit)
                .then(urls => {
                    urls.forEach(url => console.log(url));
                })
                .catch(error => {
                    console.error('❌ 获取失败:', error);
                    process.exit(1);
                });
        } else {
            const rssScraper = new MyGolfSpyRSSScraper();
            rssScraper.getLatestArticleUrls(limit)
                .then(urls => {
                    urls.forEach(url => console.log(url));
                })
                .catch(error => {
                    console.error('❌ 获取失败:', error);
                    process.exit(1);
                });
        }
        return;
    }
    
    const command = args[0] || 'process';
    
    switch (command) {
        case 'process':
            // 处理指定数量的文章（默认10篇）
            const limit = parseInt(args[1]) || 10;
            console.log(`📊 将处理最新的 ${limit} 篇文章\n`);
            processMyGolfSpyViaRSS(limit);
            break;
            
        case 'list':
            // 仅列出URL，不处理
            const listLimit = parseInt(args[1]) || 10;
            console.log(`📋 获取MyGolfSpy最新 ${listLimit} 篇文章URL...\n`);
            
            if (listLimit > 10 && MyGolfSpyHybridScraper) {
                console.log('使用混合模式（RSS + 网页抓取）...\n');
                const hybridScraper = new MyGolfSpyHybridScraper();
                hybridScraper.getArticleUrls(listLimit)
                    .then(urls => {
                        urls.forEach((url, index) => {
                            console.log(`${index + 1}. ${url}`);
                        });
                    })
                    .catch(error => console.error('❌ 获取失败:', error));
            } else {
                const rssScraper = new MyGolfSpyRSSScraper();
                rssScraper.getArticleUrls()
                    .then(articles => {
                        articles.slice(0, listLimit).forEach((article, index) => {
                            console.log(`${index + 1}. ${article.title}`);
                            console.log(`   ${article.url}`);
                            console.log(`   分类: ${article.category}`);
                            console.log(`   发布时间: ${article.pubDate}`);
                            console.log('');
                        });
                    })
                    .catch(error => console.error('❌ 获取失败:', error));
            }
            break;
            
        case 'save':
            // 保存URL到文件
            const filename = args[1] || 'mygolfspy_urls.txt';
            console.log(`💾 保存MyGolfSpy URL到文件: ${filename}\n`);
            const scraper = new MyGolfSpyRSSScraper();
            scraper.saveToFile(filename)
                .then(urls => console.log(`✅ 已保存 ${urls.length} 个URL`))
                .catch(error => console.error('❌ 保存失败:', error));
            break;
            
        case 'help':
        default:
            console.log(`
MyGolfSpy RSS处理器 - 使用说明

命令:
  node process_mygolfspy_rss.js process [数量]   - 处理指定数量的最新文章（默认10篇）
                                                   注：超过10篇将自动使用混合模式（RSS+网页抓取）
  node process_mygolfspy_rss.js list [数量]      - 列出最新文章（不处理）
  node process_mygolfspy_rss.js save [文件名]    - 保存URL列表到文件
  node process_mygolfspy_rss.js help             - 显示此帮助信息

说明:
  - RSS Feed默认只提供10篇最新文章
  - 如需获取超过10篇文章，系统会自动使用混合抓取模式
  - 混合模式结合RSS和网页抓取，可获取更多文章

示例:
  node process_mygolfspy_rss.js process 5        - 处理最新的5篇文章
  node process_mygolfspy_rss.js list             - 查看最新文章列表
  node process_mygolfspy_rss.js save urls.txt    - 保存URL到urls.txt

说明:
  这个工具通过RSS Feed获取MyGolfSpy的最新文章URL，
  然后使用现有的批处理系统进行处理，完全兼容现有代码。
            `);
            break;
    }
}

module.exports = processMyGolfSpyViaRSS;