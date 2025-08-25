#!/usr/bin/env node

// 优化版本的自动抓取脚本 - 使用智能并发提升性能
// 保持与原系统的完全兼容性

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 优化版自动抓取系统启动...');
console.log('⚡ 使用智能并发模式，保持编号唯一性');

// 加载网站配置
const siteConfigPath = path.join(__dirname, 'site_specific_config.json');
const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));

// 编号分配锁
class ArticleNumberLock {
    constructor() {
        this.lockFile = path.join('golf_content', '.article_number.lock');
        this.cacheFile = path.join('golf_content', '.max_article_number');
    }

    async getNextNumber() {
        // 使用文件锁确保原子性
        const startTime = Date.now();
        
        while (fs.existsSync(this.lockFile)) {
            // 如果锁存在超过5秒，强制解锁
            if (Date.now() - startTime > 5000) {
                fs.unlinkSync(this.lockFile);
                break;
            }
            await new Promise(r => setTimeout(r, 50));
        }
        
        // 创建锁
        fs.writeFileSync(this.lockFile, process.pid.toString());
        
        try {
            // 从缓存读取或扫描
            let maxNum = 0;
            
            if (fs.existsSync(this.cacheFile)) {
                const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
                if (Date.now() - cache.timestamp < 300000) {
                    maxNum = cache.maxNumber;
                }
            }
            
            if (maxNum === 0) {
                // 快速扫描
                maxNum = this.quickScan();
            }
            
            const nextNum = maxNum + 1;
            
            // 更新缓存
            fs.writeFileSync(this.cacheFile, JSON.stringify({
                maxNumber: nextNum,
                timestamp: Date.now()
            }));
            
            return nextNum;
            
        } finally {
            // 释放锁
            if (fs.existsSync(this.lockFile)) {
                fs.unlinkSync(this.lockFile);
            }
        }
    }
    
    quickScan() {
        let maxNum = 0;
        const golfDir = path.join(process.cwd(), 'golf_content');
        
        if (fs.existsSync(golfDir)) {
            const dirs = fs.readdirSync(golfDir)
                .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
                
            for (const dir of dirs) {
                const urlsFile = path.join(golfDir, dir, 'article_urls.json');
                if (fs.existsSync(urlsFile)) {
                    try {
                        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                        const nums = Object.keys(urls).map(n => parseInt(n)).filter(n => !isNaN(n));
                        if (nums.length > 0) {
                            maxNum = Math.max(maxNum, ...nums);
                        }
                    } catch (e) {}
                }
            }
        }
        
        return maxNum;
    }
}

// 并发处理器
class ConcurrentProcessor {
    constructor() {
        this.numberLock = new ArticleNumberLock();
        this.urlCache = new Map();
        this.loadUrlCache();
    }
    
    loadUrlCache() {
        const golfDir = path.join(process.cwd(), 'golf_content');
        if (!fs.existsSync(golfDir)) return;
        
        const dirs = fs.readdirSync(golfDir)
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
            
        for (const dir of dirs) {
            const urlsFile = path.join(golfDir, dir, 'article_urls.json');
            if (fs.existsSync(urlsFile)) {
                try {
                    const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                    for (const [num, url] of Object.entries(urls)) {
                        const normalizedUrl = this.normalizeUrl(typeof url === 'string' ? url : url.url);
                        this.urlCache.set(normalizedUrl, { dir, num });
                    }
                } catch (e) {}
            }
        }
    }
    
    normalizeUrl(url) {
        return url.toLowerCase()
            .replace(/\/+$/, '')
            .replace(/^https?:\/\/(www\.)?/, '')
            .replace(/\?.*$/, '')
            .replace(/#.*$/, '');
    }
    
    async processAllSites(sites) {
        console.log('\n📊 阶段1：并发扫描所有网站...');
        
        // 并发扫描所有网站
        const scanPromises = sites.map(site => this.scanSite(site));
        const scanResults = await Promise.all(scanPromises);
        
        // 汇总新文章
        const allNewArticles = [];
        for (let i = 0; i < sites.length; i++) {
            const site = sites[i];
            const articles = scanResults[i];
            console.log(`✓ ${site}: ${articles.length} 篇新文章`);
            allNewArticles.push(...articles.map(a => ({ ...a, site })));
        }
        
        console.log(`\n📊 总计: ${allNewArticles.length} 篇新文章待处理`);
        
        if (allNewArticles.length === 0) {
            console.log('✨ 没有新文章需要处理');
            return;
        }
        
        console.log('\n📊 阶段2：智能批量处理...');
        
        // 分组处理（每组5篇，避免资源耗尽）
        const batchSize = 5;
        for (let i = 0; i < allNewArticles.length; i += batchSize) {
            const batch = allNewArticles.slice(i, i + batchSize);
            console.log(`\n🔄 处理第 ${Math.floor(i/batchSize) + 1}/${Math.ceil(allNewArticles.length/batchSize)} 批次...`);
            
            // 为每篇文章预分配编号
            const articlesWithNumbers = [];
            for (const article of batch) {
                const num = await this.numberLock.getNextNumber();
                articlesWithNumbers.push({ ...article, number: num });
                
                // 立即保存到URL映射
                this.saveUrlMapping(article.url, num, article.site);
            }
            
            // 并发处理这批文章
            await this.processBatch(articlesWithNumbers);
            
            // 批次间短暂休息
            if (i + batchSize < allNewArticles.length) {
                console.log('⏸️  休息3秒后继续下一批次...');
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
        console.log('\n✅ 所有文章处理完成！');
    }
    
    async scanSite(site) {
        try {
            // 使用现有的发现脚本
            const cmd = `node discover_recent_articles.js "${site}" 10`;
            const output = execSync(cmd, { encoding: 'utf8' });
            
            // 解析输出
            const articles = [];
            const lines = output.split('\n');
            let inNewArticles = false;
            
            for (const line of lines) {
                if (line.includes('🆕 新文章列表:')) {
                    inNewArticles = true;
                    continue;
                }
                
                if (inNewArticles && line.match(/^\d+\./)) {
                    const urlMatch = line.match(/https?:\/\/[^\s]+/);
                    if (urlMatch) {
                        const url = urlMatch[0];
                        const normalized = this.normalizeUrl(url);
                        
                        // 快速检查缓存
                        if (!this.urlCache.has(normalized)) {
                            articles.push({ url, title: line.split('\n')[0] });
                        }
                    }
                }
            }
            
            return articles;
            
        } catch (error) {
            console.error(`❌ 扫描 ${site} 失败:`, error.message);
            return [];
        }
    }
    
    saveUrlMapping(url, number, site) {
        const today = new Date().toISOString().split('T')[0];
        const baseDir = path.join('golf_content', today);
        const urlsFile = path.join(baseDir, 'article_urls.json');
        
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        
        let mapping = {};
        if (fs.existsSync(urlsFile)) {
            try {
                mapping = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
            } catch (e) {}
        }
        
        mapping[number] = {
            url,
            timestamp: new Date().toISOString(),
            status: 'processing',
            site
        };
        
        fs.writeFileSync(urlsFile, JSON.stringify(mapping, null, 2));
    }
    
    async processBatch(articles) {
        // 使用现有的批处理脚本，但传入预分配的编号
        const urlsWithNumbers = articles.map(a => `${a.url}|${a.number}`).join('\n');
        const tempFile = path.join(__dirname, `.temp_batch_${Date.now()}.txt`);
        
        fs.writeFileSync(tempFile, urlsWithNumbers);
        
        try {
            // 调用批处理脚本
            execSync(`node batch_process_articles.js --file "${tempFile}"`, {
                stdio: 'inherit'
            });
        } catch (error) {
            console.error('批处理失败:', error.message);
        } finally {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const includeAllSites = args.includes('--all-sites');
    
    // 确定要处理的网站
    let sites = includeAllSites 
        ? ['golf.com', 'golfmonthly.com', 'mygolfspy.com', 'golfwrx.com', 'golfdigest.com']
        : ['golf.com', 'golfmonthly.com', 'mygolfspy.com'];
    
    console.log(`📌 处理网站: ${sites.join(', ')}`);
    
    const processor = new ConcurrentProcessor();
    await processor.processAllSites(sites);
}

// 运行
main().catch(console.error);