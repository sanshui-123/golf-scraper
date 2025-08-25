#!/usr/bin/env node

/**
 * 网站去重检测器
 * 功能：基于网站上的实际文章进行去重，而不是基于本地文件
 * 原则：网站上有的文章就跳过，网站上没有的就处理
 */

const fs = require('fs');
const path = require('path');

class WebsiteDuplicateChecker {
    constructor() {
        this.baseDir = path.join(process.cwd(), 'golf_content');
    }

    // 获取网站上已有的文章URL
    getWebsiteArticleUrls() {
        const websiteUrls = new Set();
        
        if (!fs.existsSync(this.baseDir)) {
            return websiteUrls;
        }
        
        // 扫描所有日期文件夹
        const dateFolders = fs.readdirSync(this.baseDir)
            .filter(folder => folder.match(/^\d{4}-\d{2}-\d{2}$/));
        
        for (const dateFolder of dateFolders) {
            // 方法1：检查wechat_ready文件夹
            const wechatDir = path.join(this.baseDir, dateFolder, 'wechat_ready');
            if (fs.existsSync(wechatDir)) {
                const wechatFiles = fs.readdirSync(wechatDir)
                    .filter(file => file.match(/^wechat_article_\d+\.md$/));
                
                wechatFiles.forEach(file => {
                    const filePath = path.join(wechatDir, file);
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const urlMatch = content.match(/🔗 \*\*原文链接\*\*: \[点击查看原文\]\((https:\/\/www\.golfmonthly\.com[^)]+)\)/);
                        if (urlMatch && urlMatch[1]) {
                            websiteUrls.add(urlMatch[1]);
                        }
                    } catch (err) {}
                });
            }
            
            // 方法2：检查articles文件夹
            const articlesDir = path.join(this.baseDir, dateFolder, 'articles');
            if (fs.existsSync(articlesDir)) {
                const articleFiles = fs.readdirSync(articlesDir)
                    .filter(file => file.match(/^article_\d+\.md$/));
                
                articleFiles.forEach(file => {
                    const filePath = path.join(articlesDir, file);
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const urlMatch = content.match(/🔗 \*\*原文链接\*\*: \[点击查看原文\]\((https:\/\/www\.golfmonthly\.com[^)]+)\)/);
                        if (urlMatch && urlMatch[1]) {
                            websiteUrls.add(urlMatch[1]);
                        }
                    } catch (err) {}
                });
            }
            
            // 方法3：检查article_urls.json文件 - 已禁用
            // 只依据实际存在的MD文件判断，不依据URL映射文件
            // const urlMapFile = path.join(this.baseDir, dateFolder, 'article_urls.json');
            // if (fs.existsSync(urlMapFile)) {
            //     try {
            //         const urlMap = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
            //         Object.values(urlMap).forEach(value => {
            //             // 处理不同格式的URL数据
            //             if (typeof value === 'string' && value.startsWith('https://')) {
            //                 websiteUrls.add(value);
            //             } else if (value && typeof value === 'object' && value.url) {
            //                 websiteUrls.add(value.url);
            //             }
            //         });
            //     } catch (err) {}
            // }
        }
        
        return websiteUrls;
    }

    // 过滤出需要处理的URL（网站上没有的）
    filterNewUrls(inputUrls) {
        const websiteUrls = this.getWebsiteArticleUrls();
        const newUrls = [];
        const existingUrls = [];
        
        for (const url of inputUrls) {
            if (websiteUrls.has(url)) {
                existingUrls.push(url);
            } else {
                newUrls.push(url);
            }
        }
        
        return { newUrls, existingUrls };
    }

    // 显示检测结果
    displayResults(inputUrls) {
        console.log('🔍 网站内容去重检测');
        console.log('====================\n');
        
        const websiteUrls = this.getWebsiteArticleUrls();
        console.log(`📊 网站上现有文章数: ${websiteUrls.size}\n`);
        
        const { newUrls, existingUrls } = this.filterNewUrls(inputUrls);
        
        if (existingUrls.length > 0) {
            console.log('✅ 网站上已存在的文章 (将跳过):');
            existingUrls.forEach((url, i) => {
                console.log(`   ${i + 1}. ${url}`);
            });
            console.log('');
        }
        
        if (newUrls.length > 0) {
            console.log('📝 需要处理的文章:');
            newUrls.forEach((url, i) => {
                console.log(`   ${i + 1}. ${url}`);
            });
            console.log('');
        } else {
            console.log('ℹ️ 所有文章都已在网站上，无需处理\n');
        }
        
        return { newUrls, duplicateUrls: existingUrls };
    }

    // 获取所有已处理的URL（兼容原接口）
    getAllProcessedUrls() {
        return this.getWebsiteArticleUrls();
    }

    // 标记成功（空实现，保持接口兼容）
    markAsSuccess(url) {
        // 基于网站内容的检测器不需要记录成功状态
        // 因为是否成功取决于文件是否真实存在于网站上
    }
}

module.exports = WebsiteDuplicateChecker;

// 命令行测试
if (require.main === module) {
    const checker = new WebsiteDuplicateChecker();
    
    console.log('🔍 检查网站上的文章...\n');
    
    const websiteUrls = checker.getWebsiteArticleUrls();
    console.log(`找到 ${websiteUrls.size} 篇文章在网站上:\n`);
    
    let index = 1;
    for (const url of websiteUrls) {
        console.log(`${index++}. ${url}`);
    }
    
    // 测试去重
    console.log('\n\n📋 测试去重功能:');
    const testUrls = [
        'https://www.golfmonthly.com/buying-advice/arguably-the-best-new-golf-ball-of-2025-is-currently-discounted-at-usd2-66-per-ball-and-it-isnt-a-titleist-pro-v1',
        'https://www.golfmonthly.com/features/im-a-golf-historian-and-these-5-records-blow-my-mind',
        'https://www.golfmonthly.com/tips/stop-digging-and-start-gliding-my-chip-shot-mantra-for-increasing-spin-on-the-golf-ball'
    ];
    
    checker.displayResults(testUrls);
}