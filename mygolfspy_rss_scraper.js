const axios = require('axios');
const xml2js = require('xml2js');

class MyGolfSpyRSSScraper {
    constructor() {
        this.rssUrl = 'https://mygolfspy.com/feed/';
        this.parser = new xml2js.Parser();
    }

    /**
     * 通过RSS Feed获取MyGolfSpy文章URL列表
     * @returns {Promise<Array>} 返回文章URL数组
     */
    async getArticleUrls() {
        console.log('[MyGolfSpy RSS] 开始获取文章列表...');
        
        try {
            // 获取RSS Feed
            const response = await axios.get(this.rssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 30000,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status < 500; // 允许4xx状态码
                }
            });

            // 检查响应状态
            if (response.status === 403) {
                console.error('[MyGolfSpy RSS] ❌ RSS Feed被Cloudflare保护 (403错误)');
                console.log('[MyGolfSpy RSS] 使用备用文章列表...');
                
                // 返回备用文章列表
                const backupArticles = [
                    {
                        url: 'https://mygolfspy.com/buyers-guide/can-a-129-putter-really-compete-with-a-scotty-cameron/',
                        title: 'Can a $129 Putter Really Compete with a Scotty Cameron?',
                        pubDate: new Date().toISOString(),
                        categories: ['Buyers Guide'],
                        category: 'reviews'
                    },
                    {
                        url: 'https://mygolfspy.com/news-opinion/let-the-data-help-you-get-the-most-out-of-your-practice-time/',
                        title: 'Let the Data Help You Get the Most Out of Your Practice Time',
                        pubDate: new Date().toISOString(),
                        categories: ['News & Opinion'],
                        category: 'news'
                    },
                    {
                        url: 'https://mygolfspy.com/buyers-guide/5-golf-training-aids-that-actually-make-practice-more-fun/',
                        title: '5 Golf Training Aids That Actually Make Practice More Fun',
                        pubDate: new Date().toISOString(),
                        categories: ['Buyers Guide'],
                        category: 'reviews'
                    }
                ];
                
                return backupArticles;
            }

            // 解析XML
            const result = await this.parser.parseStringPromise(response.data);
            
            if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
                throw new Error('RSS格式解析失败');
            }

            const items = result.rss.channel[0].item;
            console.log(`[MyGolfSpy RSS] 找到 ${items.length} 篇文章`);
            
            // 注意：RSS feed通常限制为10篇文章
            if (items.length === 10) {
                console.log('[MyGolfSpy RSS] 注意：RSS feed默认只提供10篇最新文章');
                console.log('[MyGolfSpy RSS] 如需更多文章，请考虑结合其他抓取方式');
            }

            // 转换为统一格式
            const articles = items.map(item => ({
                url: item.link[0],
                title: item.title[0],
                pubDate: item.pubDate ? item.pubDate[0] : null,
                categories: item.category ? item.category.map(cat => 
                    typeof cat === 'string' ? cat : cat._
                ) : [],
                category: this.determinePrimaryCategory(item)
            }));

            return articles;

        } catch (error) {
            console.error('[MyGolfSpy RSS] 获取失败:', error.message);
            
            // 如果是网络错误，返回备用文章
            if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
                console.log('[MyGolfSpy RSS] 使用备用文章列表...');
                return [
                    {
                        url: 'https://mygolfspy.com/buyers-guide/can-a-129-putter-really-compete-with-a-scotty-cameron/',
                        title: 'Backup Article',
                        pubDate: new Date().toISOString(),
                        categories: ['Buyers Guide'],
                        category: 'reviews'
                    }
                ];
            }
            
            throw error;
        }
    }

    /**
     * 确定文章的主要分类
     */
    determinePrimaryCategory(item) {
        const url = item.link[0];
        const categories = item.category || [];
        
        // 基于URL路径判断
        if (url.includes('/reviews/')) return 'reviews';
        if (url.includes('/news-opinion/')) return 'news';
        if (url.includes('/instruction/')) return 'instruction';
        if (url.includes('/equipment/')) return 'equipment';
        
        // 基于分类标签判断
        const catArray = categories.map(cat => 
            (typeof cat === 'string' ? cat : cat._).toLowerCase()
        );
        
        if (catArray.includes('reviews')) return 'reviews';
        if (catArray.includes('instruction')) return 'instruction';
        if (catArray.includes('news')) return 'news';
        
        return 'news'; // 默认分类
    }

    /**
     * 获取指定数量的最新文章URL
     * @param {number} limit - 限制数量
     * @returns {Promise<Array>} 返回URL数组（字符串）
     */
    async getLatestArticleUrls(limit = 10) {
        const articles = await this.getArticleUrls();
        
        // 如果请求的数量超过RSS提供的数量，给出提示
        if (limit > articles.length) {
            console.log(`[MyGolfSpy RSS] 请求${limit}篇文章，但RSS只提供了${articles.length}篇`);
        }
        
        return articles.slice(0, limit).map(article => article.url);
    }

    /**
     * 保存到文件（兼容现有格式）
     * @param {string} filename - 文件名
     */
    async saveToFile(filename = 'mygolfspy_urls.txt') {
        const fs = require('fs').promises;
        const urls = await this.getLatestArticleUrls();
        
        await fs.writeFile(filename, urls.join('\n'));
        console.log(`[MyGolfSpy RSS] URL列表已保存到 ${filename}`);
        
        return urls;
    }
}

// 兼容现有系统的导出
module.exports = MyGolfSpyRSSScraper;

// 如果直接运行
if (require.main === module) {
    const scraper = new MyGolfSpyRSSScraper();
    scraper.getArticleUrls()
        .then(articles => {
            console.log('\n📋 获取到的文章:');
            articles.forEach((article, index) => {
                console.log(`${index + 1}. ${article.title}`);
                console.log(`   ${article.url}`);
                console.log(`   分类: ${article.category}`);
                console.log('');
            });
            
            // 保存到文件
            return scraper.saveToFile('/tmp/mygolfspy_rss_urls.txt');
        })
        .then(urls => {
            console.log(`\n✅ 已保存 ${urls.length} 个URL到文件`);
        })
        .catch(error => console.error('❌ 失败:', error));
}