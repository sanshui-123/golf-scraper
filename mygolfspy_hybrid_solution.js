const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

class MyGolfSpyHybridSolution {
    constructor() {
        this.articlesFile = path.join(__dirname, 'mygolfspy_articles.json');
    }

    /**
     * 方案1：使用已知的文章URL直接处理内容
     * 用户需要手动提供文章内容
     */
    async processManualContent(url, content, title) {
        console.log('[MyGolfSpy] 处理手动提供的内容...');
        
        // 从内容中提取图片
        const images = [];
        const imageMatches = content.matchAll(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g);
        let imageCounter = 0;
        
        for (const match of imageMatches) {
            if (!match[1].includes('logo') && !match[1].includes('avatar')) {
                imageCounter++;
                images.push({
                    url: match[1],
                    alt: match[2] || `图片${imageCounter}`
                });
            }
        }
        
        // 清理HTML标签
        let cleanContent = content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // 构建markdown格式
        let markdownContent = `# ${title}\n\n${cleanContent}\n\n`;
        
        // 添加图片占位符
        images.forEach((img, index) => {
            markdownContent += `[IMAGE_${index + 1}:${img.alt}]\n\n`;
        });
        
        return {
            title,
            content: markdownContent,
            images,
            url
        };
    }

    /**
     * 方案2：从其他来源获取MyGolfSpy内容
     * 例如：Google搜索缓存、Archive.org等
     */
    async tryAlternativeSources(url) {
        const alternatives = [];
        
        // 1. Google缓存
        const googleCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
        alternatives.push({
            name: 'Google Cache',
            url: googleCacheUrl
        });
        
        // 2. Wayback Machine
        const waybackUrl = `https://web.archive.org/web/*/${url}`;
        alternatives.push({
            name: 'Wayback Machine',
            url: waybackUrl
        });
        
        // 3. 12ft.io (移除付费墙)
        const twelftUrl = `https://12ft.io/proxy?q=${encodeURIComponent(url)}`;
        alternatives.push({
            name: '12ft.io',
            url: twelftUrl
        });
        
        console.log('[MyGolfSpy] 可尝试的替代来源：');
        alternatives.forEach(alt => {
            console.log(`  - ${alt.name}: ${alt.url}`);
        });
        
        return alternatives;
    }

    /**
     * 方案3：批量处理已保存的MyGolfSpy文章
     * 用户可以手动保存HTML，然后批量处理
     */
    async processSavedHTML(htmlFile) {
        const html = fs.readFileSync(htmlFile, 'utf8');
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        
        const title = $('h1.entry-title, h1.post-title').first().text().trim();
        const contentElement = $('.entry-content, .post-content').first();
        
        let content = `# ${title}\n\n`;
        const images = [];
        let imageCounter = 0;
        
        contentElement.find('p, h2, h3, ul, ol, blockquote, img').each(function() {
            const elem = $(this);
            const tagName = this.tagName.toUpperCase();
            
            if (tagName === 'P') {
                const text = elem.text().trim();
                if (text.length > 20) {
                    content += `${text}\n\n`;
                }
            } else if (tagName === 'H2') {
                content += `\n## ${elem.text().trim()}\n\n`;
            } else if (tagName === 'H3') {
                content += `\n### ${elem.text().trim()}\n\n`;
            } else if (tagName === 'IMG') {
                const src = elem.attr('src');
                const alt = elem.attr('alt') || `图片${imageCounter + 1}`;
                
                if (src && !src.includes('logo')) {
                    imageCounter++;
                    images.push({ url: src, alt });
                    content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                }
            }
        });
        
        return { title, content, images };
    }

    /**
     * 保存处理记录
     */
    saveArticleRecord(url, method, success) {
        const records = fs.existsSync(this.articlesFile) 
            ? JSON.parse(fs.readFileSync(this.articlesFile, 'utf8'))
            : {};
        
        records[url] = {
            method,
            success,
            processedAt: new Date().toISOString()
        };
        
        fs.writeFileSync(this.articlesFile, JSON.stringify(records, null, 2));
    }
}

module.exports = MyGolfSpyHybridSolution;