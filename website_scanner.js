#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const MultiWebsiteProcessor = require('./multi_website_processor');

// 网站扫描配置
const scanConfigs = {
    'golfmonthly.com': {
        scanUrls: [
            'https://www.golfmonthly.com/news',
            'https://www.golfmonthly.com/tips',
            'https://www.golfmonthly.com/features'
        ],
        linkSelector: 'a[href*="/news/"], a[href*="/tips/"], a[href*="/features/"]',
        maxLinks: 10
    },
    'golf.com': {
        scanUrls: [
            'https://golf.com/instruction/',
            'https://golf.com/news/'
        ],
        linkSelector: 'article a[href*="/instruction/"], article a[href*="/news/"]',
        maxLinks: 10
    },
    'golfdigest.com': {
        scanUrls: [
            'https://www.golfdigest.com/story',
            'https://www.golfdigest.com/gallery'
        ],
        linkSelector: 'a[href*="/story/"], a[href*="/gallery/"]',
        maxLinks: 10
    }
};

class WebsiteScanner {
    constructor() {
        this.processor = new MultiWebsiteProcessor();
        this.historyFile = './scan_history.json';
    }

    // 加载扫描历史
    async loadHistory() {
        try {
            const data = await fs.readFile(this.historyFile, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    }

    // 保存扫描历史
    async saveHistory(history) {
        await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
    }

    // 扫描单个网站
    async scanWebsite(domain, config) {
        console.log(`\n🔍 扫描 ${domain}...`);
        
        const browser = await chromium.launch({
            headless: true,
            executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
            args: ['--no-sandbox']
        });

        const allLinks = new Set();

        try {
            for (const scanUrl of config.scanUrls) {
                console.log(`   扫描页面: ${scanUrl}`);
                const page = await browser.newPage();
                
                try {
                    await page.goto(scanUrl, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 
                    });

                    // 提取链接
                    const links = await page.evaluate((selector) => {
                        const elements = document.querySelectorAll(selector);
                        return Array.from(elements)
                            .map(a => a.href)
                            .filter(href => href && href.startsWith('http'));
                    }, config.linkSelector);

                    links.forEach(link => allLinks.add(link));
                    console.log(`   找到 ${links.length} 个链接`);

                } catch (e) {
                    console.error(`   ❌ 扫描失败: ${e.message}`);
                } finally {
                    await page.close();
                }
            }
        } finally {
            await browser.close();
        }

        // 限制链接数量
        const limitedLinks = Array.from(allLinks).slice(0, config.maxLinks);
        console.log(`   ✅ 总共找到 ${limitedLinks.length} 个唯一链接`);
        
        return limitedLinks;
    }

    // 扫描所有配置的网站
    async scanAll(autoProcess = false) {
        const history = await this.loadHistory();
        const allNewLinks = [];

        console.log('\n🌐 开始扫描网站新内容...');

        for (const [domain, config] of Object.entries(scanConfigs)) {
            try {
                const links = await this.scanWebsite(domain, config);
                
                // 过滤已处理的链接
                const newLinks = links.filter(link => !history[link]);
                
                console.log(`   📊 新文章: ${newLinks.length} 篇`);
                
                // 记录到历史
                const now = new Date().toISOString();
                newLinks.forEach(link => {
                    history[link] = {
                        discoveredAt: now,
                        status: 'pending'
                    };
                });

                allNewLinks.push(...newLinks);

            } catch (e) {
                console.error(`\n❌ 扫描 ${domain} 失败:`, e.message);
            }
        }

        // 保存历史
        await this.saveHistory(history);

        console.log(`\n📊 扫描完成！发现 ${allNewLinks.length} 篇新文章`);

        // 如果设置了自动处理
        if (autoProcess && allNewLinks.length > 0) {
            console.log('\n🚀 开始自动处理新文章...');
            await this.processor.processUrls(allNewLinks);
            
            // 更新历史状态
            const updatedHistory = await this.loadHistory();
            allNewLinks.forEach(link => {
                if (updatedHistory[link]) {
                    updatedHistory[link].status = 'processed';
                    updatedHistory[link].processedAt = new Date().toISOString();
                }
            });
            await this.saveHistory(updatedHistory);
        } else if (allNewLinks.length > 0) {
            // 保存新链接到文件
            const filename = `scan_results_${Date.now()}.json`;
            await fs.writeFile(filename, JSON.stringify(allNewLinks, null, 2));
            console.log(`\n💾 新链接已保存到: ${filename}`);
            console.log('运行以下命令处理:');
            console.log(`node multi_website_processor.js ${allNewLinks.slice(0, 3).map(l => `"${l}"`).join(' ')} ...`);
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const scanner = new WebsiteScanner();
    
    const args = process.argv.slice(2);
    const autoProcess = args.includes('--auto');
    
    if (args.includes('--help')) {
        console.log('\n使用方法:');
        console.log('  node website_scanner.js          # 扫描但不处理');
        console.log('  node website_scanner.js --auto   # 扫描并自动处理');
        process.exit(0);
    }

    scanner.scanAll(autoProcess).catch(console.error);
}

module.exports = WebsiteScanner;