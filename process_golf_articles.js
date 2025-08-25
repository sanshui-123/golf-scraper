#!/usr/bin/env node

const BatchProcessor = require('./batch_process_articles');
const testSingleArticle = require('./test_single_article');
const fs = require('fs');
const path = require('path');

// 🆕 添加URL重复检查功能（增强版：同时检查article_urls.json和HTML原文链接，支持失败重试）
async function filterExistingUrls(inputUrls) {
    console.log(`🔍 检查 ${inputUrls.length} 个URL是否已处理...\n`);
    
    const baseDir = 'golf_content';
    const existingUrls = new Set();
    const urlMapping = new Map(); // URL -> 文件信息映射
    
    // 🆕 读取失败文章列表
    const failedUrls = new Set();
    const failedArticlesFile = 'failed_articles.json';
    
    if (fs.existsSync(failedArticlesFile)) {
        try {
            const failedData = JSON.parse(fs.readFileSync(failedArticlesFile, 'utf8'));
            Object.entries(failedData).forEach(([url, data]) => {
                // 只添加状态不是 success 的URL
                if (data.status !== 'success') {
                    const normalizedUrl = normalizeUrl(url);
                    failedUrls.add(normalizedUrl);
                }
            });
            if (failedUrls.size > 0) {
                console.log(`📋 找到 ${failedUrls.size} 个待重试的失败文章`);
            }
        } catch (e) {
            console.log('⚠️  读取失败文章列表出错');
        }
    }
    
    try {
        if (!fs.existsSync(baseDir)) {
            console.log('📁 golf_content目录不存在，所有URL都是新的');
            return inputUrls;
        }
        
        // 扫描所有日期目录
        const dateDirs = fs.readdirSync(baseDir)
            .filter(dir => {
                const fullPath = path.join(baseDir, dir);
                return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
            })
            .sort().reverse();
        
        console.log(`📂 扫描 ${dateDirs.length} 个日期目录...`);
        
        // 遍历每个日期目录
        for (const dateDir of dateDirs) {
            // 方法1: 检查 article_urls.json
            const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
            if (fs.existsSync(urlsJsonPath)) {
                try {
                    const urlsMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                    for (const [articleNum, articleUrl] of Object.entries(urlsMapping)) {
                        const normalizedUrl = normalizeUrl(articleUrl);
                        existingUrls.add(normalizedUrl);
                        
                        // 如果这个URL还没有记录，或者这是更早的记录，则更新
                        if (!urlMapping.has(normalizedUrl)) {
                            urlMapping.set(normalizedUrl, {
                                date: dateDir,
                                filename: `wechat_article_${articleNum}.html`,
                                source: 'article_urls.json',
                                originalUrl: articleUrl
                            });
                        }
                    }
                } catch (e) {
                    console.log(`⚠️  读取 ${dateDir}/article_urls.json 失败`);
                }
            }
            
            // 方法2: 检查HTML文件中的原文链接
            const htmlDir = path.join(baseDir, dateDir, 'wechat_html');
            if (!fs.existsSync(htmlDir)) continue;
            
            const htmlFiles = fs.readdirSync(htmlDir)
                .filter(file => file.endsWith('.html'));
            
            for (const file of htmlFiles) {
                const filePath = path.join(htmlDir, file);
                const extractedUrl = extractSourceUrlFromHtml(filePath);
                
                if (extractedUrl) {
                    const normalizedUrl = normalizeUrl(extractedUrl);
                    existingUrls.add(normalizedUrl);
                    
                    // 如果这个URL还没有记录，则添加
                    if (!urlMapping.has(normalizedUrl)) {
                        urlMapping.set(normalizedUrl, {
                            date: dateDir,
                            filename: file,
                            source: 'html原文链接',
                            originalUrl: extractedUrl
                        });
                    }
                }
            }
        }
        
        console.log(`📋 找到 ${existingUrls.size} 个已处理的URL（包括article_urls.json和HTML原文链接）\n`);
        
        // 检查输入URL
        const newUrls = [];
        const duplicateUrls = [];
        const retryUrls = []; // 🆕 待重试的URL
        
        inputUrls.forEach((url, index) => {
            const normalizedUrl = normalizeUrl(url);
            
            if (existingUrls.has(normalizedUrl)) {
                // 🆕 检查是否在失败列表中
                if (failedUrls.has(normalizedUrl)) {
                    console.log(`🔄 [${index + 1}] ${url}`);
                    console.log(`   状态: 之前处理失败，允许重试\n`);
                    retryUrls.push(url);
                    newUrls.push(url); // 允许重试
                } else {
                    const existing = urlMapping.get(normalizedUrl);
                    console.log(`❌ [${index + 1}] ${url}`);
                    console.log(`   已存在: ${existing.date}/${existing.filename} (来源: ${existing.source})\n`);
                    duplicateUrls.push(url);
                }
            } else {
                console.log(`✅ [${index + 1}] ${url}`);
                newUrls.push(url);
            }
        });
        
        console.log(`📊 检查结果:`);
        console.log(`   输入URL: ${inputUrls.length}`);
        console.log(`   已存在: ${duplicateUrls.length}`);
        if (retryUrls.length > 0) {
            console.log(`   待重试: ${retryUrls.length}`); // 🆕
        }
        console.log(`   新URL: ${newUrls.length - retryUrls.length}`); // 🆕 修正计算
        console.log(`   总计处理: ${newUrls.length}\n`);
        
        return newUrls;
        
    } catch (error) {
        console.error('❌ URL检查失败:', error.message);
        console.log('⚠️  继续处理所有URL（未过滤重复）\n');
        return inputUrls;
    }
}

// 从HTML文件中提取原文链接
function extractSourceUrlFromHtml(htmlFilePath) {
    try {
        const content = fs.readFileSync(htmlFilePath, 'utf8');
        
        // 多种原文链接查找模式
        const patterns = [
            /原文链接[^>]*?href="([^"]+)"/,
            /查看原文[^>]*?href="([^"]+)"/,
            /原始链接[^>]*?href="([^"]+)"/,
            /source[^>]*?href="([^"]+)"/i,
            /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>.*?原文/,
            /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>.*?source/i,
            /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>.*?查看/,
            /href="(https?:\/\/[^"]*golf[^"]*)"[^>]*>/i,
            /href="(https?:\/\/www\.golf[^"]*)"[^>]*>/i,
            /"(https?:\/\/(?:www\.)?(?:golf\.com|golfmonthly\.com|mygolfspy\.com|golfwrx\.com|golfdigest\.com|pgatour\.com|golfchannel\.com)[^"]*)"/ 
        ];
        
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match && match[1] && match[1].startsWith('http')) {
                return match[1];
            }
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// 标准化URL用于比较
function normalizeUrl(url) {
    try {
        return url
            .toLowerCase()
            .replace(/^https?:\/\//, '')  // 移除协议
            .replace(/^www\./, '')       // 移除www
            .replace(/\/$/, '')          // 移除末尾斜杠
            .replace(/\?.*$/, '')        // 移除查询参数
            .replace(/#.*$/, '');        // 移除锚点
    } catch (error) {
        return url;
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        showHelp();
        return;
    }
    
    if (args[0] === '--test') {
        // 测试模式
        const url = args[1];
        if (!url) {
            console.error('❌ 请提供要测试的URL');
            return;
        }
        await testSingleArticle(url);
    } else {
        // 处理模式
        const urls = args.filter(arg => arg.startsWith('http'));
        
        if (urls.length === 0) {
            console.error('❌ 没有找到有效的URL');
            return;
        }
        
        console.log(`\n准备处理 ${urls.length} 篇文章...\n`);
        
        // 🆕 添加URL重复检查
        const filteredUrls = await filterExistingUrls(urls);
        
        if (filteredUrls.length === 0) {
            console.log('✅ 所有URL都已处理过，无需重复处理');
            console.log('👋 程序退出');
            return;
        }
        
        if (filteredUrls.length < urls.length) {
            console.log(`⏭️ 跳过了 ${urls.length - filteredUrls.length} 个已存在的文章`);
            console.log(`🚀 将处理 ${filteredUrls.length} 个新URL...\n`);
        }
        
        const processor = new BatchProcessor();
        await processor.processArticles(filteredUrls);
    }
}

function showHelp() {
    console.log('\n高尔夫文章处理工具');
    console.log('===================\n');
    
    console.log('使用方法:');
    console.log('  处理文章: node process_golf_articles.js <URL1> <URL2> ...');
    console.log('  测试单篇: node process_golf_articles.js --test <URL>');
    console.log('  显示帮助: node process_golf_articles.js --help\n');
    
    console.log('支持的网站:');
    console.log('  ✅ Golf Monthly (golfmonthly.com)');
    console.log('  ✅ Golf.com');
    console.log('  ✅ MyGolfSpy (mygolfspy.com)');
    console.log('  ✅ GolfWRX (golfwrx.com)');
    console.log('  ✅ Golf Digest (golfdigest.com)');
    console.log('  ✅ PGA Tour (pgatour.com)');
    console.log('  ✅ Golf Channel (golfchannel.com)\n');
    
    console.log('示例:');
    console.log('  # 测试单篇文章');
    console.log('  node process_golf_articles.js --test "https://golf.com/instruction/..."');
    console.log('  \n  # 处理多篇文章');
    console.log('  node process_golf_articles.js "https://golf.com/..." "https://golfdigest.com/..."');
}

if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ 错误:', error.message);
        process.exit(1);
    });
}

module.exports = main;