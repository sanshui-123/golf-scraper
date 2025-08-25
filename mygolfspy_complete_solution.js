// MyGolfSpy完整解决方案 - 基于RSS + 多重策略

const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const fs = require('fs').promises;

class MyGolfSpyRSSProcessor {
    constructor() {
        this.baseUrl = 'https://mygolfspy.com';
        this.rssFeeds = [
            'https://mygolfspy.com/feed/',                    // 主RSS
            'https://mygolfspy.com/reviews/feed/',            // 评测RSS
            'https://mygolfspy.com/news-opinion/feed/',       // 新闻RSS
            'https://mygolfspy.com/instruction/feed/',        // 教学RSS
            'https://mygolfspy.com/fitting-technology/feed/' // 装备RSS
        ];
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader; +http://example.com/bot)',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
            'Accept-Language': 'en-US,en;q=0.9'
        };
    }

    // 主要RSS抓取功能
    async scrapeAllRSSFeeds() {
        console.log('🚀 开始抓取所有MyGolfSpy RSS源...');
        
        const allArticles = [];
        const failedFeeds = [];

        for (const feedUrl of this.rssFeeds) {
            try {
                console.log(`📡 处理RSS: ${feedUrl}`);
                const articles = await this.processSingleRSSFeed(feedUrl);
                
                if (articles.length > 0) {
                    allArticles.push(...articles);
                    console.log(`✅ 成功: ${feedUrl} - 获取 ${articles.length} 篇文章`);
                } else {
                    console.log(`⚠️ 空结果: ${feedUrl}`);
                }
                
                // 避免被限制
                await this.delay(1000);
                
            } catch (error) {
                console.log(`❌ 失败: ${feedUrl} - ${error.message}`);
                failedFeeds.push({ url: feedUrl, error: error.message });
            }
        }

        // 去重处理
        const uniqueArticles = this.deduplicateArticles(allArticles);
        
        console.log(`\n📊 RSS抓取总结:`);
        console.log(`- 总文章数: ${allArticles.length}`);
        console.log(`- 去重后: ${uniqueArticles.length}`);
        console.log(`- 失败RSS源: ${failedFeeds.length}`);
        
        if (failedFeeds.length > 0) {
            console.log('失败的RSS源:', failedFeeds);
        }

        return {
            articles: uniqueArticles,
            stats: {
                total: allArticles.length,
                unique: uniqueArticles.length,
                failed: failedFeeds.length,
                categories: this.categorizeArticles(uniqueArticles)
            },
            failedFeeds
        };
    }

    // 处理单个RSS源
    async processSingleRSSFeed(feedUrl) {
        try {
            const response = await axios.get(feedUrl, {
                headers: this.headers,
                timeout: 15000,
                maxRedirects: 5
            });

            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 解析RSS XML
            const parser = new xml2js.Parser({
                trim: true,
                explicitArray: false,
                ignoreAttrs: false
            });

            const result = await parser.parseStringPromise(response.data);
            
            // 处理RSS格式
            if (result.rss && result.rss.channel && result.rss.channel.item) {
                return this.parseRSSItems(result.rss.channel.item, feedUrl);
            }
            
            // 处理Atom格式
            if (result.feed && result.feed.entry) {
                return this.parseAtomEntries(result.feed.entry, feedUrl);
            }

            console.log(`⚠️ 未识别的RSS格式: ${feedUrl}`);
            return [];

        } catch (error) {
            throw new Error(`RSS解析失败: ${error.message}`);
        }
    }

    // 解析RSS项目
    parseRSSItems(items, feedUrl) {
        const articles = [];
        const itemsArray = Array.isArray(items) ? items : [items];

        itemsArray.forEach((item, index) => {
            try {
                if (!item.link || !item.title) {
                    return;
                }

                const article = {
                    url: this.cleanUrl(item.link),
                    title: this.cleanText(item.title),
                    description: this.cleanText(item.description || ''),
                    category: this.getCategoryFromUrl(item.link),
                    publishDate: this.parseDate(item.pubDate),
                    author: this.cleanText(item.author || item['dc:creator'] || ''),
                    source: 'rss',
                    feedUrl: feedUrl,
                    guid: item.guid || item.link,
                    scrapedAt: new Date().toISOString()
                };

                // 提取更多信息
                if (item.category) {
                    article.tags = Array.isArray(item.category) 
                        ? item.category.map(cat => this.cleanText(cat))
                        : [this.cleanText(item.category)];
                }

                if (item.enclosure && item.enclosure.$) {
                    article.image = item.enclosure.$.url;
                }

                articles.push(article);

            } catch (itemError) {
                console.log(`⚠️ RSS项目解析失败 (${index}): ${itemError.message}`);
            }
        });

        return articles;
    }

    // 解析Atom条目
    parseAtomEntries(entries, feedUrl) {
        const articles = [];
        const entriesArray = Array.isArray(entries) ? entries : [entries];

        entriesArray.forEach((entry, index) => {
            try {
                const link = entry.link && entry.link.$ ? entry.link.$.href : entry.link;
                
                if (!link || !entry.title) {
                    return;
                }

                const article = {
                    url: this.cleanUrl(link),
                    title: this.cleanText(entry.title),
                    description: this.cleanText(entry.summary || entry.content || ''),
                    category: this.getCategoryFromUrl(link),
                    publishDate: this.parseDate(entry.published || entry.updated),
                    author: this.cleanText(entry.author ? entry.author.name : ''),
                    source: 'atom',
                    feedUrl: feedUrl,
                    guid: entry.id || link,
                    scrapedAt: new Date().toISOString()
                };

                articles.push(article);

            } catch (itemError) {
                console.log(`⚠️ Atom条目解析失败 (${index}): ${itemError.message}`);
            }
        });

        return articles;
    }

    // 辅助功能 - 清理URL
    cleanUrl(url) {
        if (!url) return '';
        
        // 处理相对URL
        if (url.startsWith('/')) {
            return this.baseUrl + url;
        }
        
        // 清理URL参数
        try {
            const urlObj = new URL(url);
            return urlObj.origin + urlObj.pathname;
        } catch {
            return url.trim();
        }
    }

    // 辅助功能 - 清理文本
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/<[^>]*>/g, '') // 移除HTML标签
            .replace(/&[^;]+;/g, ' ') // 移除HTML实体
            .replace(/\s+/g, ' ') // 合并空白字符
            .trim();
    }

    // 辅助功能 - 从URL获取分类
    getCategoryFromUrl(url) {
        if (!url) return 'other';
        
        if (url.includes('/reviews/')) return 'reviews';
        if (url.includes('/news/') || url.includes('/news-opinion/')) return 'news';
        if (url.includes('/instruction/')) return 'instruction';
        if (url.includes('/fitting/') || url.includes('/technology/')) return 'fitting';
        if (url.includes('/equipment/')) return 'equipment';
        
        return 'other';
    }

    // 辅助功能 - 解析日期
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            return new Date(dateString).toISOString();
        } catch {
            return null;
        }
    }

    // 去重文章
    deduplicateArticles(articles) {
        const seen = new Set();
        return articles.filter(article => {
            const key = article.url || article.guid;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // 文章分类统计
    categorizeArticles(articles) {
        const categories = {};
        articles.forEach(article => {
            categories[article.category] = (categories[article.category] || 0) + 1;
        });
        return categories;
    }

    // 延迟函数
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 保存结果到文件
    async saveResults(data, filename = 'mygolfspy_rss_results.json') {
        const result = {
            scrapedAt: new Date().toISOString(),
            source: 'MyGolfSpy RSS Feeds',
            ...data
        };

        await fs.writeFile(filename, JSON.stringify(result, null, 2));
        console.log(`💾 结果已保存到: ${filename}`);
        
        return result;
    }

    // 导出URL列表
    async exportUrlList(articles, filename = 'mygolfspy_urls.txt') {
        const urls = articles.map(article => article.url).join('\n');
        await fs.writeFile(filename, urls);
        console.log(`📋 URL列表已保存到: ${filename}`);
        
        return filename;
    }

    // 生成报告
    generateReport(data) {
        const report = `
📊 MyGolfSpy RSS抓取报告
============================
抓取时间: ${data.scrapedAt}
总文章数: ${data.stats.total}
去重后数: ${data.stats.unique}
失败RSS源: ${data.stats.failed}

📈 分类统计:
${Object.entries(data.stats.categories)
    .map(([cat, count]) => `- ${cat}: ${count}篇`)
    .join('\n')}

🔗 最新文章 (前10篇):
${data.articles.slice(0, 10)
    .map((article, i) => `${i+1}. [${article.category}] ${article.title}\n   ${article.url}`)
    .join('\n\n')}

${data.failedFeeds.length > 0 ? `
❌ 失败的RSS源:
${data.failedFeeds.map(f => `- ${f.url}: ${f.error}`).join('\n')}
` : '✅ 所有RSS源都成功处理'}
        `;

        return report.trim();
    }
}

// 主执行函数
async function main() {
    const processor = new MyGolfSpyRSSProcessor();
    
    try {
        console.log('🚀 启动MyGolfSpy RSS处理器...\n');
        
        // 抓取所有RSS
        const data = await processor.scrapeAllRSSFeeds();
        
        // 保存详细结果
        await processor.saveResults(data);
        
        // 导出URL列表
        await processor.exportUrlList(data.articles);
        
        // 生成并显示报告
        const report = processor.generateReport(data);
        console.log('\n' + report);
        
        // 保存报告
        await fs.writeFile('mygolfspy_report.txt', report);
        console.log('\n📄 报告已保存到: mygolfspy_report.txt');
        
        return data;
        
    } catch (error) {
        console.error('❌ 处理失败:', error);
        throw error;
    }
}

// 导出模块
module.exports = {
    MyGolfSpyRSSProcessor,
    main
};

// 直接运行
if (require.main === module) {
    main().catch(console.error);
}