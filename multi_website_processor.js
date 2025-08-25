#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const BatchProcessor = require('./batch_process_articles');

// 加载网站配置
const websiteConfigs = JSON.parse(fs.readFileSync('./website_configs.json', 'utf8'));

class MultiWebsiteProcessor {
    constructor() {
        this.batchProcessor = new BatchProcessor();
    }

    // 从URL中提取域名
    getDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (e) {
            return null;
        }
    }

    // 检查URL是否支持
    isSupported(url) {
        const domain = this.getDomain(url);
        return domain && websiteConfigs.hasOwnProperty(domain);
    }

    // 获取网站配置
    getWebsiteConfig(url) {
        const domain = this.getDomain(url);
        return websiteConfigs[domain] || null;
    }

    // 处理多个URL（可能来自不同网站）
    async processUrls(urls) {
        // 分组URL按网站
        const groupedUrls = {};
        const unsupportedUrls = [];

        for (const url of urls) {
            const domain = this.getDomain(url);
            if (domain && websiteConfigs[domain]) {
                if (!groupedUrls[domain]) {
                    groupedUrls[domain] = [];
                }
                groupedUrls[domain].push(url);
            } else {
                unsupportedUrls.push(url);
            }
        }

        // 显示分组信息
        console.log('\n📊 URL分组统计:');
        for (const [domain, urls] of Object.entries(groupedUrls)) {
            console.log(`   ${websiteConfigs[domain].name}: ${urls.length} 篇`);
        }
        if (unsupportedUrls.length > 0) {
            console.log(`   ⚠️ 不支持的网站: ${unsupportedUrls.length} 篇`);
            unsupportedUrls.forEach(url => console.log(`      - ${url}`));
        }

        // 处理支持的URL
        const allSupportedUrls = Object.values(groupedUrls).flat();
        if (allSupportedUrls.length > 0) {
            console.log(`\n开始处理 ${allSupportedUrls.length} 篇文章...`);
            await this.batchProcessor.processArticles(allSupportedUrls);
        }
    }

    // 显示支持的网站列表
    showSupportedWebsites() {
        console.log('\n📌 支持的网站:');
        for (const [domain, config] of Object.entries(websiteConfigs)) {
            console.log(`   - ${config.name} (${domain})`);
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const processor = new MultiWebsiteProcessor();
    
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0] === '--help') {
        console.log('\n使用方法:');
        console.log('  node multi_website_processor.js [URLs...]');
        console.log('  node multi_website_processor.js --supported');
        console.log('\n示例:');
        console.log('  node multi_website_processor.js "https://www.golf.com/..." "https://www.golfdigest.com/..."');
        processor.showSupportedWebsites();
        process.exit(0);
    }

    if (args[0] === '--supported') {
        processor.showSupportedWebsites();
        process.exit(0);
    }

    // 处理URL
    processor.processUrls(args).then(() => {
        console.log('\n✅ 处理完成！');
    }).catch(error => {
        console.error('\n❌ 处理出错:', error);
    });
}

module.exports = MultiWebsiteProcessor;