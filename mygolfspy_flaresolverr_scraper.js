const axios = require('axios');
const cheerio = require('cheerio');

class MyGolfSpyFlareSolverrScraper {
    constructor() {
        this.flaresolverrUrl = 'http://localhost:8191/v1';
    }

    /**
     * 通过FlareSolverr抓取MyGolfSpy文章
     * @param {string} url - 文章URL
     * @returns {Promise<Object>} 返回文章内容对象
     */
    async scrapeArticle(url) {
        console.log('[MyGolfSpy FlareSolverr] 开始抓取:', url);
        
        try {
            // 检查FlareSolverr服务是否运行
            const healthCheck = await this.checkFlareSolverr();
            if (!healthCheck) {
                throw new Error('FlareSolverr服务未运行，请先启动服务');
            }

            // 使用FlareSolverr获取页面内容
            console.log('[MyGolfSpy FlareSolverr] 发送请求到FlareSolverr...');
            console.log('[MyGolfSpy FlareSolverr] 使用加强版配置...');
            
            // 使用浏览器会话以获得更好的成功率
            const response = await axios.post(this.flaresolverrUrl, {
                cmd: 'request.get',
                url: url,
                maxTimeout: 300000,  // 5分钟超时
                session: 'create',   // 创建新会话
                sessionTtlMinutes: 10,
                cookies: [],
                returnOnlyCookies: false,
                proxy: null,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            }, {
                timeout: 330000  // axios超时设置为5.5分钟
            });

            if (response.data.status !== 'ok') {
                throw new Error(`FlareSolverr请求失败: ${response.data.message}`);
            }

            const html = response.data.solution.response;
            return this.parseContent(html, url);

        } catch (error) {
            console.error('[MyGolfSpy FlareSolverr] 抓取失败:', error.message);
            
            // 如果FlareSolverr未运行，提供启动指导
            if (error.message.includes('ECONNREFUSED')) {
                console.log('\n⚠️  请先启动FlareSolverr服务:');
                console.log('docker run -d --name=flaresolverr -p 8191:8191 -e LOG_LEVEL=info --restart unless-stopped ghcr.io/flaresolverr/flaresolverr:latest\n');
            }
            
            throw error;
        }
    }

    /**
     * 检查FlareSolverr服务是否可用
     */
    async checkFlareSolverr() {
        try {
            const response = await axios.get('http://localhost:8191/health', { timeout: 3000 });
            return response.status === 200 && response.data.status === 'ok';
        } catch (error) {
            return false;
        }
    }

    /**
     * 解析HTML内容
     */
    parseContent(html, url) {
        const $ = cheerio.load(html);
        
        // 多种标题选择器
        const title = $('h1.entry-title, h1.jeg_post_title, h1.post-title, .post-header h1, .article-header h1').first().text().trim() || 
                     $('h1').first().text().trim() || 
                     'MyGolfSpy Article';
        
        // 多种内容容器选择器
        const contentElement = $('.entry-content, .jeg_main_content, .post-content, .article-content, article .content').first() ||
                              $('article').first() ||
                              $('main').first();
        
        let content = `# ${title}\n\n`;
        const images = [];
        let imageCounter = 0;
        
        if (contentElement.length > 0) {
            // MyGolfSpy 特定内容处理
            contentElement.find('p, h2, h3, h4, ul, ol, blockquote, img, figure').each(function() {
                const elem = $(this);
                const tagName = this.tagName.toUpperCase();
                
                if (tagName === 'P') {
                    const text = elem.text().trim();
                    // 过滤掉太短的段落和广告文字
                    if (text.length > 20 && 
                        !text.includes('Advertisement') && 
                        !text.includes('Affiliate Disclosure') &&
                        !text.includes('Cookie Policy')) {
                        content += `${text}\n\n`;
                    }
                } else if (tagName === 'H2') {
                    content += `\n## ${elem.text().trim()}\n\n`;
                } else if (tagName === 'H3' || tagName === 'H4') {
                    content += `\n### ${elem.text().trim()}\n\n`;
                } else if (tagName === 'UL' || tagName === 'OL') {
                    elem.find('li').each(function() {
                        content += `• ${$(this).text().trim()}\n`;
                    });
                    content += '\n';
                } else if (tagName === 'BLOCKQUOTE') {
                    content += `> ${elem.text().trim()}\n\n`;
                } else if (tagName === 'IMG' || tagName === 'FIGURE') {
                    const img = tagName === 'FIGURE' ? elem.find('img').first() : elem;
                    if (img.length > 0) {
                        const src = img.attr('src');
                        const alt = img.attr('alt') || elem.find('figcaption').text() || `图片${imageCounter + 1}`;
                        
                        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
                            imageCounter++;
                            images.push({ url: src, alt: alt });
                            content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                        }
                    }
                }
            });
        } else {
            // 如果找不到主要内容容器，尝试获取所有段落
            $('p').each(function() {
                const text = $(this).text().trim();
                if (text.length > 30 && !text.includes('Cookie') && !text.includes('Privacy')) {
                    content += `${text}\n\n`;
                }
            });
            
            // 查找所有图片
            $('img').each(function() {
                const src = $(this).attr('src');
                const alt = $(this).attr('alt') || `图片${images.length + 1}`;
                
                if (src && !src.includes('logo') && !src.includes('avatar')) {
                    images.push({ url: src, alt: alt });
                }
            });
        }
        
        // 如果内容太少，可能是抓取失败
        if (content.length < 200) {
            throw new Error('抓取到的内容太少，可能页面未完全加载');
        }
        
        return { title, content, images, url };
    }

    /**
     * 清理FlareSolverr会话
     */
    async destroySession() {
        // FlareSolverr v3不再需要会话管理
    }
}

module.exports = MyGolfSpyFlareSolverrScraper;