/**
 * 网站特定抓取器
 * 当通用抓取失败时，使用网站特定的抓取逻辑
 */

class SiteSpecificScrapers {
    constructor() {
        // 注册网站特定的抓取器
        this.scrapers = {
            'golf.com': this.scrapeGolfCom.bind(this),
            'golfdigest.com': this.scrapeGolfDigest.bind(this),
            'mygolfspy.com': this.scrapeMyGolfSpy.bind(this),
            'golfweek.usatoday.com': this.scrapeGolfweek.bind(this),
            'todays-golfer.com': this.scrapeTodaysGolfer.bind(this),
            'nationalclubgolfer.com': this.scrapeNationalClubGolfer.bind(this),
            'www.pgatour.com': this.scrapePGATour.bind(this),
            'skysports.com': this.scrapeSkySports.bind(this),
            'golfmagic.com': this.scrapeGolfMagic.bind(this),
            'lpga.com': this.scrapeLPGA.bind(this),
            'cbssports.com': this.scrapeCBSSports.bind(this),
            // 可以继续添加更多网站
        };
    }

    /**
     * 获取网站特定的抓取器
     */
    getScraper(domain) {
        return this.scrapers[domain] || null;
    }

    /**
     * Golf.com 特定抓取逻辑
     */
    async scrapeGolfCom(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // Golf.com 特定选择器
            // 方法1: 查找文章卡片
            let containers = document.querySelectorAll('.m-card--horizontal, .m-card--vertical, .m-card');
            
            if (containers.length === 0) {
                // 方法2: 查找文章链接组
                containers = document.querySelectorAll('.c-entry-group-labels__item');
            }
            
            containers.forEach(container => {
                // 查找链接
                const linkElement = container.querySelector('a.c-entry-box--compact__image-wrapper, a.m-ellipses--text') || 
                                  container.querySelector('a[href*="/news/"], a[href*="/instruction/"]');
                
                if (!linkElement) return;
                
                const url = linkElement.href;
                const title = container.querySelector('.c-entry-box--compact__title, .m-ellipses--text')?.textContent?.trim() || 
                             linkElement.getAttribute('title') || '';
                
                // 查找时间 - Golf.com 特定
                let publishTime = null;
                
                // 1. 查找 time 元素
                const timeElement = container.querySelector('time[datetime]');
                if (timeElement) {
                    publishTime = timeElement.getAttribute('datetime');
                }
                
                // 2. 查找日期文本
                if (!publishTime) {
                    const dateText = container.querySelector('.c-timestamp, .entry-date')?.textContent?.trim();
                    if (dateText) {
                        publishTime = dateText;
                    }
                }
                
                // 3. 查找相对时间
                if (!publishTime) {
                    const relativeTime = container.textContent.match(/(\d+)\s*(hours?|days?|weeks?)\s*ago/i);
                    if (relativeTime) {
                        publishTime = relativeTime[0];
                    }
                }
                
                if (url && title) {
                    articleData.push({ url, title, publishTime });
                }
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * Golf Digest 特定抓取逻辑
     */
    async scrapeGolfDigest(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // Golf Digest 最新选择器 - 2025年更新
            const selectors = [
                // 主要文章容器
                '.summary-item',
                '.summary-list__item',
                '.summary-collection__item',
                '[data-testid="SummaryItemWrapper"]',
                '.content-card',
                '.story-card',
                '.river-item',
                // 文章链接模式
                'article',
                '[class*="article"]',
                '[class*="story"]'
            ];
            
            // 收集所有可能的文章容器
            const containers = new Set();
            selectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(elem => {
                        containers.add(elem);
                    });
                } catch (e) {
                    // 忽略无效选择器
                }
            });
            
            // 也直接查找文章链接
            const linkSelectors = [
                'a[href*="/story/"]',
                'a[href*="/article/"]',
                'a[href*="/reviews/"]',
                'a[href*="/instruction/"]',
                'a[href*="/equipment/"]',
                '.summary-item__hed-link',
                '.summary-item__content a'
            ];
            
            linkSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(link => {
                    const parent = link.closest('.summary-item, article, [data-testid]');
                    if (parent) {
                        containers.add(parent);
                    }
                });
            });
            
            // 处理每个容器
            containers.forEach(container => {
                try {
                    // 查找链接
                    const linkElement = container.querySelector('a[href*="/story/"], a[href*="/article/"], a[href*="/reviews/"], a[href*="/instruction/"], a[href*="/equipment/"]') ||
                                      container.querySelector('.summary-item__hed-link, h2 a, h3 a, h1 a');
                    
                    if (!linkElement || !linkElement.href) return;
                    
                    const url = linkElement.href;
                    
                    // 验证URL
                    if (!url.includes('golfdigest.com')) return;
                    const validPatterns = ['/story/', '/article/', '/reviews/', '/instruction/', '/equipment/'];
                    if (!validPatterns.some(pattern => url.includes(pattern))) return;
                    
                    // 获取标题
                    const title = linkElement.textContent?.trim() || 
                                 linkElement.getAttribute('title') || 
                                 container.querySelector('h1, h2, h3')?.textContent?.trim() || '';
                    
                    if (!title) return;
                    
                    // 查找时间
                    let publishTime = null;
                    
                    // 查找time元素
                    const timeSelectors = [
                        'time[datetime]',
                        'time',
                        '.summary-item__publish-date',
                        '.publish-date',
                        '.date',
                        '[class*="date"]'
                    ];
                    
                    for (const selector of timeSelectors) {
                        const elem = container.querySelector(selector);
                        if (elem) {
                            publishTime = elem.getAttribute('datetime') || elem.textContent?.trim();
                            if (publishTime) break;
                        }
                    }
                    
                    // 避免重复
                    const exists = articleData.some(a => a.url === url);
                    if (!exists) {
                        articleData.push({ url, title, publishTime });
                    }
                } catch (e) {
                    // 忽略处理错误
                }
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * MyGolfSpy 特定抓取逻辑
     */
    async scrapeMyGolfSpy(page) {
        // 处理可能的弹窗
        try {
            await page.waitForTimeout(2000);
            const closeButtons = await page.$$('button[aria-label*="close"], .pum-close');
            for (const button of closeButtons) {
                const isVisible = await button.isVisible();
                if (isVisible) {
                    await button.click();
                    await page.waitForTimeout(1000);
                }
            }
        } catch (e) {
            // 忽略弹窗处理错误
        }
        
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // MyGolfSpy 特定选择器
            let containers = document.querySelectorAll('article.type-post, .jeg_post');
            
            containers.forEach(container => {
                const linkElement = container.querySelector('h3 a, h2 a, .jeg_post_title a');
                if (!linkElement) return;
                
                const url = linkElement.href;
                const title = linkElement.textContent?.trim() || '';
                
                // 查找时间
                let publishTime = null;
                const dateElement = container.querySelector('.jeg_meta_date, time, .entry-date');
                if (dateElement) {
                    publishTime = dateElement.getAttribute('datetime') || 
                                dateElement.textContent?.trim();
                }
                
                if (url && title) {
                    articleData.push({ url, title, publishTime });
                }
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * Golfweek (USA Today) 特定抓取逻辑
     */
    async scrapeGolfweek(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // Golfweek 特定选择器
            const linkSelectors = [
                'a[href*="/story/sports/golf/"]',
                'a[href*="/news/"]',
                'a[href*="/article/"]',
                'a[href*="/video/"]',
                '.gnt_m_flm_a',
                'a.gnt_m_flm_a',
                '[data-c-br] a[href]',
                '.story-link'
            ];
            
            const seenUrls = new Set();
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤条件
                    if (url && 
                        url.includes('golfweek.usatoday.com') &&
                        (url.includes('/story/') || url.includes('/news/') || 
                         url.includes('/article/') || url.includes('/video/')) &&
                        !url.includes('#') &&
                        !url.includes('signin') &&
                        !url.includes('subscribe') &&
                        !seenUrls.has(url) &&
                        title.length > 10) {
                        
                        seenUrls.add(url);
                        
                        // 尝试获取时间信息
                        let publishTime = null;
                        const parent = link.closest('article') || link.closest('[data-c-br]') || link.parentElement;
                        if (parent) {
                            const timeElem = parent.querySelector('time, [data-c-dt], .gnt_m_flm_sbt');
                            if (timeElem) {
                                publishTime = timeElem.textContent?.trim() || timeElem.getAttribute('datetime') || '';
                            }
                        }
                        
                        articleData.push({ url, title, publishTime });
                    }
                });
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * 文章内容特定抓取
     */
    async scrapeArticleContent(page, domain) {
        switch(domain) {
            case 'golf.com':
                return this.scrapeGolfComArticle(page);
            case 'golfdigest.com':
                return this.scrapeGolfDigestArticle(page);
            case 'mygolfspy.com':
                return this.scrapeMyGolfSpyArticle(page);
            case 'golfweek.usatoday.com':
                return this.scrapeGolfweekArticle(page);
            case 'todays-golfer.com':
                return this.scrapeTodaysGolferArticle(page);
            case 'nationalclubgolfer.com':
                return this.scrapeNationalClubGolferArticle(page);
            case 'www.pgatour.com':
                return this.scrapePGATourArticle(page);
            case 'skysports.com':
                return this.scrapeSkySportsArticle(page);
            case 'golfmagic.com':
                return this.scrapeGolfMagicArticle(page);
            case 'lpga.com':
                return this.scrapeLPGAArticle(page);
            case 'cbssports.com':
                return this.scrapeCBSSportsArticle(page);
            default:
                return null;
        }
    }

    /**
     * Golf.com 文章内容抓取
     */
    async scrapeGolfComArticle(page) {
        return await page.evaluate(() => {
            // 尝试多个标题选择器，按优先级排序
            const title = 
                // 原有选择器
                document.querySelector('h1.c-page-title__text, h1.headline')?.innerText?.trim() ||
                // 扩展的h1选择器
                document.querySelector('h1.entry-title, h1.post-title, h1.article-title')?.innerText?.trim() ||
                // 任何h1标签
                document.querySelector('h1')?.innerText?.trim() ||
                // meta标签备用方案
                document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
                document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')?.trim() ||
                // 页面标题备用
                document.title?.replace(' - Golf.com', '')?.replace(' | Golf.com', '')?.trim() ||
                // 从URL提取标题作为最后手段
                (() => {
                    const pathParts = window.location.pathname.split('/').filter(p => p);
                    const lastPart = pathParts[pathParts.length - 1] || '';
                    return lastPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                })() ||
                '未知标题';
            
            // 增加更多内容选择器备选
            const contentElement = document.querySelector(
                '.c-entry-content, .article-content, .entry-content, ' +
                '.post-content, .content-body, article .content, ' +
                'main article, article[role="main"], .story-body'
            );
            
            if (!contentElement) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            
            // 获取段落和图片
            const elements = contentElement.querySelectorAll('p, h2, h3, img, figure');
            elements.forEach(elem => {
                if (elem.tagName === 'P') {
                    const text = elem.innerText.trim();
                    if (text.length > 20) {
                        content += `${text}\n\n`;
                    }
                } else if (elem.tagName === 'H2') {
                    content += `\n## ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'H3') {
                    content += `\n### ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
                    const img = elem.tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                    if (img && img.src) {
                        images.push({ url: img.src, alt: img.alt || `图片${images.length + 1}` });
                        content += `[IMAGE_${images.length}:${img.alt || '图片'}]\n\n`;
                    }
                }
            });
            
            // 添加调试信息
            console.log(`[Golf.com] 抓取结果 - 标题: "${title}", 内容长度: ${content.length}字符`);
            
            return { title, content, images };
        });
    }

    /**
     * Golf Digest 文章内容抓取
     */
    async scrapeGolfDigestArticle(page) {
        // 等待内容加载
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[Golf Digest] 处理懒加载图片...');
        await page.evaluate(() => {
            // 滚动页面以触发懒加载
            const scrollStep = 300;
            const scrollDelay = 100;
            let scrollHeight = document.body.scrollHeight;
            let currentPosition = 0;
            
            const scrollInterval = setInterval(() => {
                window.scrollBy(0, scrollStep);
                currentPosition += scrollStep;
                
                if (currentPosition >= scrollHeight) {
                    clearInterval(scrollInterval);
                }
            }, scrollDelay);
        });
        
        // 等待滚动完成和图片加载
        await page.waitForTimeout(3000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            // Golf Digest特定的懒加载处理
            const lazyImages = document.querySelectorAll('img[data-src], img[loading="lazy"], img.lazyload');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                // 对于loading="lazy"的图片，强制加载
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
            
            // 处理picture元素中的source
            document.querySelectorAll('picture source[data-srcset]').forEach(source => {
                if (source.dataset.srcset) {
                    source.srcset = source.dataset.srcset;
                    source.removeAttribute('data-srcset');
                }
            });
        });
        
        await page.waitForTimeout(2000);
        
        // 滚动回顶部
        await page.evaluate(() => window.scrollTo(0, 0));
        
        return await page.evaluate(() => {
            // 提取标题 - 更新选择器
            const titleSelectors = [
                'h1[data-testid="ContentHeaderHed"]',
                'h1.content-header__hed',
                'h1.headline',
                'h1[class*="title"]',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 查找内容容器 - 更新选择器
            const contentSelectors = [
                '[data-testid="BodyWrapper"]',
                '.article__body',
                '.body__inner-container',
                '.content-body',
                '.story-body',
                '[class*="article-body"]',
                '.paywall__content',
                'main article'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement || !title) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            
            // 先抓取头部图片（通常是主要图片）
            const headerImageSelectors = [
                '[data-testid="ContentHeaderLeadAsset"] img',
                '.content-header__lead-asset img',
                '.lead-asset img',
                '.article-header img',
                '.content-header img',
                'figure.lead-image img',
                '.article-lead-image img'
            ];
            
            let headerImageFound = false;
            for (const selector of headerImageSelectors) {
                const headerImg = document.querySelector(selector);
                if (headerImg && headerImg.src && headerImg.src.startsWith('http')) {
                    const imgUrl = headerImg.src || headerImg.currentSrc;
                    if (!imgUrl.includes('logo') && !imgUrl.includes('icon')) {
                        images.push({
                            url: imgUrl,
                            alt: headerImg.alt || '主图'
                        });
                        content += `[IMAGE_1:${headerImg.alt || '主图'}]\n\n`;
                        headerImageFound = true;
                        break;
                    }
                }
            }
            
            // 移除不需要的元素
            const unwantedSelectors = [
                'script',
                'style',
                '.ad',
                '.advertisement',
                '.social-share',
                '.related-articles',
                '.newsletter-signup',
                '.comments',
                'aside',
                '.sidebar',
                '[class*="promo"]',
                '[class*="newsletter"]'
            ];
            
            unwantedSelectors.forEach(selector => {
                contentElement.querySelectorAll(selector).forEach(elem => elem.remove());
            });
            
            // 提取内容 - 保留结构
            const elements = contentElement.querySelectorAll('p, h2, h3, blockquote, ul, ol, figure, img, picture, .image-wrapper, .article-image, [class*="image-container"]');
            
            // 用于追踪已处理的图片，避免重复
            const processedImages = new Set();
            let imageCounter = headerImageFound ? 1 : 0;
            
            elements.forEach(elem => {
                switch(elem.tagName) {
                    case 'P':
                        const text = elem.innerText.trim();
                        if (text.length > 20 && !text.includes('Advertisement') && !text.includes('ADVERTISEMENT')) {
                            content += `${text}\n\n`;
                        }
                        break;
                        
                    case 'H2':
                        content += `\n## ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'H3':
                        content += `\n### ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'BLOCKQUOTE':
                        content += `> ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'UL':
                    case 'OL':
                        const items = elem.querySelectorAll('li');
                        items.forEach(li => {
                            content += `- ${li.innerText.trim()}\n`;
                        });
                        content += '\n';
                        break;
                        
                    case 'FIGURE':
                    case 'IMG':
                    case 'PICTURE':
                    default:
                        // 查找图片 - 支持多种结构
                        let imgs = [];
                        
                        if (elem.tagName === 'IMG') {
                            imgs = [elem];
                        } else if (elem.tagName === 'PICTURE') {
                            const picImg = elem.querySelector('img');
                            if (picImg) imgs = [picImg];
                        } else if (elem.tagName === 'FIGURE') {
                            imgs = Array.from(elem.querySelectorAll('img'));
                        } else if (elem.classList.contains('image-wrapper') || 
                                 elem.classList.contains('article-image') ||
                                 elem.className.includes('image-container')) {
                            imgs = Array.from(elem.querySelectorAll('img'));
                        }
                        
                        imgs.forEach(img => {
                            if (!img || processedImages.has(img)) return;
                            processedImages.add(img);
                            
                            // 获取最佳质量的图片URL
                            let imgUrl = img.src || img.currentSrc;
                            
                            // 检查data属性
                            if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank.gif')) {
                                imgUrl = img.dataset.src || 
                                        img.dataset.lazySrc ||
                                        img.dataset.original ||
                                        img.getAttribute('data-src') ||
                                        img.getAttribute('data-lazy-src') ||
                                        img.src;
                            }
                            
                            // 从srcset获取高质量版本
                            const srcset = img.srcset || img.dataset.srcset || img.getAttribute('data-srcset');
                            if (srcset) {
                                const sources = srcset.split(',').map(s => s.trim());
                                // 获取最高质量的图片
                                const highQuality = sources.reduce((prev, curr) => {
                                    const prevMatch = prev.match(/(\d+)w/);
                                    const currMatch = curr.match(/(\d+)w/);
                                    if (prevMatch && currMatch) {
                                        return parseInt(currMatch[1]) > parseInt(prevMatch[1]) ? curr : prev;
                                    }
                                    return prev;
                                });
                                if (highQuality) {
                                    imgUrl = highQuality.split(' ')[0];
                                }
                            }
                            
                            // 过滤无效图片
                            const isValidImage = imgUrl && 
                                               imgUrl.startsWith('http') &&
                                               !imgUrl.includes('logo') && 
                                               !imgUrl.includes('icon') && 
                                               !imgUrl.includes('avatar') &&
                                               !imgUrl.includes('thumbnail') &&
                                               !imgUrl.includes('blank') &&
                                               !imgUrl.includes('placeholder') &&
                                               (img.naturalWidth > 100 || img.width > 100 || !img.width);
                            
                            if (isValidImage) {
                                imageCounter++;
                                
                                // 获取图片描述
                                let alt = img.alt || img.title || '';
                                
                                // 从figure或容器获取描述
                                if (!alt) {
                                    const figure = img.closest('figure');
                                    if (figure) {
                                        const figcaption = figure.querySelector('figcaption');
                                        if (figcaption) {
                                            alt = figcaption.textContent.trim();
                                        }
                                    }
                                }
                                
                                // 检查是否有相邻的描述文本
                                if (!alt) {
                                    const parent = img.parentElement;
                                    const nextSibling = parent.nextElementSibling;
                                    if (nextSibling && nextSibling.tagName === 'P' && nextSibling.textContent.length < 200) {
                                        alt = nextSibling.textContent.trim();
                                    }
                                }
                                
                                if (!alt) {
                                    alt = `图片${imageCounter}`;
                                }
                                
                                images.push({ 
                                    url: imgUrl, 
                                    alt: alt
                                });
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        });
                        break;
                }
            });
            
            // 额外扫描全页图片（主要针对内容容器外的图片）
            if (images.length === 0) {
                // 如果没有找到任何图片，扫描整个页面
                const allImages = document.querySelectorAll('img');
                allImages.forEach(img => {
                    if (processedImages.has(img)) return;
                    
                    let imgUrl = img.src || img.currentSrc;
                    
                    // 检查data属性
                    if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank.gif')) {
                        imgUrl = img.dataset.src || 
                                img.dataset.lazySrc ||
                                img.dataset.original ||
                                img.getAttribute('data-src') ||
                                img.getAttribute('data-lazy-src') ||
                                img.src;
                    }
                    
                    // 过滤无效图片
                    const isValidImage = imgUrl && 
                                       imgUrl.startsWith('http') &&
                                       !imgUrl.includes('logo') && 
                                       !imgUrl.includes('icon') && 
                                       !imgUrl.includes('avatar') &&
                                       !imgUrl.includes('thumbnail') &&
                                       !imgUrl.includes('blank') &&
                                       !imgUrl.includes('placeholder') &&
                                       (img.naturalWidth > 100 || img.width > 100 || !img.width);
                    
                    if (isValidImage && images.length < 5) { // 最多5张图片
                        imageCounter++;
                        const alt = img.alt || img.title || `图片${imageCounter}`;
                        images.push({ 
                            url: imgUrl, 
                            alt: alt
                        });
                        // 在内容末尾添加图片占位符
                        content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                    }
                });
            }
            
            // 获取作者信息
            const authorSelectors = [
                '[data-testid="ContentHeaderByline"]',
                '.byline',
                '.author',
                '.content-header__byline'
            ];
            
            let author = '';
            for (const selector of authorSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    author = elem.textContent.trim();
                    break;
                }
            }
            
            return { 
                title, 
                content, 
                images,
                author,
                url: window.location.href
            };
        });
    }

    /**
     * MyGolfSpy 文章内容抓取 - 直接使用RSS处理
     */
    async scrapeMyGolfSpyArticle(page) {
        // 直接使用RSS方式处理MyGolfSpy，避免403错误
        console.log('[MyGolfSpy] 📡 使用RSS模式处理文章...');
        
        try {
            // 获取当前页面URL
            const currentUrl = await page.url();
            
            // 引入RSS处理器
            const MyGolfSpyRSSScraper = require('./mygolfspy_rss_scraper');
            const rssScraper = new MyGolfSpyRSSScraper();
            
            // 获取RSS内容
            const articles = await rssScraper.getArticleUrls();
            
            // 从URL中提取文章标识符
            const articleSlug = currentUrl.split('/').filter(p => p).pop();
            
            // 在RSS中查找匹配的文章
            const matchedArticle = articles.find(article => 
                article.url.includes(articleSlug) || article.url === currentUrl
            );
            
            if (!matchedArticle) {
                console.log('[MyGolfSpy] ⚠️ 文章在RSS feed中未找到，尝试使用axios获取');
                
                // 如果RSS中没找到，尝试通过axios直接获取内容
                const axios = require('axios');
                const cheerio = require('cheerio');
                
                const response = await axios.get(currentUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Cache-Control': 'max-age=0'
                    },
                    timeout: 30000
                });
                
                const $ = cheerio.load(response.data);
                
                // 提取内容
                const title = $('h1.entry-title, h1.jeg_post_title, .post-title h1').first().text().trim();
                const contentElements = $('.entry-content, .content-inner, .post-content');
                
                if (!title || contentElements.length === 0) {
                    throw new Error('无法从页面提取内容');
                }
                
                // 清理内容
                contentElements.find('script, style, .advertisement, .newsletter-signup').remove();
                const content = contentElements.text().trim();
                
                // 提取图片
                const images = [];
                contentElements.find('img').each((i, img) => {
                    const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
                    const alt = $(img).attr('alt') || `图片${i + 1}`;
                    if (src && src.startsWith('http')) {
                        images.push({ url: src, alt });
                    }
                });
                
                return {
                    title,
                    content,
                    images,
                    author: 'MyGolfSpy',
                    date: new Date().toISOString(),
                    url: currentUrl,
                    source: 'mygolfspy.com'
                };
            }
            
            // 使用RSS中的文章信息
            console.log('[MyGolfSpy] ✅ 从RSS feed获取文章成功');
            
            // 尝试获取更详细的内容（如果RSS提供了content:encoded）
            const axios = require('axios');
            const xml2js = require('xml2js');
            const parser = new xml2js.Parser();
            
            const rssResponse = await axios.get('https://mygolfspy.com/feed/');
            const rssData = await parser.parseStringPromise(rssResponse.data);
            
            // 查找完整内容
            const rssItems = rssData.rss.channel[0].item;
            const fullItem = rssItems.find(item => 
                item.link[0].includes(articleSlug) || item.link[0] === currentUrl
            );
            
            if (fullItem && fullItem['content:encoded']) {
                const fullContent = fullItem['content:encoded'][0];
                const cheerio = require('cheerio');
                const $ = cheerio.load(fullContent);
                
                // 清理HTML
                $('script, style').remove();
                const cleanContent = $.text().trim();
                
                // 提取图片
                const images = [];
                $('img').each((i, img) => {
                    const src = $(img).attr('src');
                    const alt = $(img).attr('alt') || `图片${i + 1}`;
                    if (src && src.startsWith('http')) {
                        images.push({ url: src, alt });
                    }
                });
                
                return {
                    title: matchedArticle.title,
                    content: cleanContent,
                    images,
                    author: 'MyGolfSpy',
                    date: matchedArticle.pubDate || new Date().toISOString(),
                    url: currentUrl,
                    source: 'mygolfspy.com'
                };
            }
            
            // 如果RSS没有完整内容，返回摘要
            return {
                title: matchedArticle.title,
                content: `# ${matchedArticle.title}\n\n[文章来源: ${currentUrl}]\n\n分类: ${matchedArticle.categories.join(', ')}`,
                images: [],
                author: 'MyGolfSpy',
                date: matchedArticle.pubDate || new Date().toISOString(),
                url: currentUrl,
                source: 'mygolfspy.com'
            };
            
        } catch (error) {
            console.error('[MyGolfSpy] RSS处理失败:', error.message);
            
            // 返回错误信息，让主程序知道需要特殊处理
            return {
                error: 'MYGOLFSPY_RSS_ERROR',
                message: `MyGolfSpy RSS处理失败: ${error.message}`,
                url: await page.url()
            };
        }
    }

    /**
     * Golfweek 文章内容抓取
     */
    async scrapeGolfweekArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.ArticleBody-articleBody, .gnt_ar_b', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[Golfweek] 处理懒加载图片...');
        
        // Golfweek的完整实现在此省略，使用原有的实现
        return null;  // 临时返回
    
        // 尝试触发懒加载图片 - 更彻底的滚动
        console.log('[MyGolfSpy] 触发懒加载图片...');
        
        // 在开始滚动前先等待弹窗出现并处理
        await page.waitForTimeout(3000); // 等待弹窗可能出现
        
        // 温和地处理弹窗，避免破坏页面
        try {
            await page.evaluate(() => {
                // 只隐藏弹窗，不移除，避免破坏页面结构
                document.querySelectorAll('.pum-container, [class*="popup"], [id*="popup"], .modal, .overlay').forEach(elem => {
                    const style = window.getComputedStyle(elem);
                    if (style.position === 'fixed' || style.position === 'absolute') {
                        elem.style.display = 'none';
                        elem.style.visibility = 'hidden';
                    }
                });
                
                // 优先点击关闭按钮
                document.querySelectorAll('button[aria-label*="close"], button[class*="close"], .pum-close').forEach(btn => {
                    try { 
                        btn.click(); 
                        console.log('点击了关闭按钮');
                    } catch(e) {}
                });
            });
        } catch (e) {
            console.log('[MyGolfSpy] 弹窗处理出现异常，继续执行:', e.message);
        }
        
        // 方法1：慢速滚动并等待，同时处理弹窗
        let scrollPosition = 0;
        const scrollStep = 500;
        const pageHeight = await page.evaluate(() => document.body.scrollHeight);
        
        while (scrollPosition < pageHeight) {
            // 滚动页面
            await page.evaluate((scrollStep) => {
                window.scrollBy(0, scrollStep);
            }, scrollStep);
            scrollPosition += scrollStep;
            
            // 每次滚动后温和地处理弹窗
            try {
                await page.evaluate(() => {
                    // 隐藏弹窗而不是删除
                    document.querySelectorAll('.pum-container, [class*="popup"], [id*="popup"], .modal, .overlay').forEach(elem => {
                        const style = window.getComputedStyle(elem);
                        if ((style.position === 'fixed' || style.position === 'absolute') && style.zIndex > 1000) {
                            elem.style.display = 'none';
                            elem.style.visibility = 'hidden';
                        }
                    });
                    
                    // 特别处理"ENTER TO WIN"类型的弹窗
                    document.querySelectorAll('*').forEach(elem => {
                        if (elem.textContent && (
                            elem.textContent.includes('ENTER TO WIN') || 
                            elem.textContent.includes('I\'M IN!') ||
                            elem.textContent.includes('SUBSCRIBE'))) {
                            
                            let parent = elem;
                            while (parent && parent !== document.body) {
                                const style = window.getComputedStyle(parent);
                                if (style.position === 'fixed' || 
                                    (style.position === 'absolute' && parseInt(style.zIndex) > 1000)) {
                                    parent.style.display = 'none';
                                    parent.style.visibility = 'hidden';
                                    console.log('隐藏了弹窗');
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    });
                    
                    // 恢复body滚动
                    document.body.style.overflow = 'auto';
                    document.documentElement.style.overflow = 'auto';
                    
                    // 触发所有懒加载图片
                    const lazyImages = document.querySelectorAll('img[data-lazy-src], img[data-src]');
                    lazyImages.forEach(img => {
                        const lazySrc = img.getAttribute('data-lazy-src') || img.getAttribute('data-src');
                        if (lazySrc && lazySrc.startsWith('http')) {
                            img.src = lazySrc;
                            img.classList.add('lazyloaded');
                            img.removeAttribute('data-lazy-src');
                            img.removeAttribute('data-src');
                        }
                    });
                    
                    // 检查jetpack懒加载
                    if (window.jetpackLazyImagesModule) {
                        window.jetpackLazyImagesModule.forceLoad();
                    }
                });
            } catch (e) {
                console.log('[MyGolfSpy] 滚动时弹窗处理异常:', e.message);
            }
            
            // 等待图片加载
            await page.waitForTimeout(1000);
        }
        
        // 滚动回顶部
        await page.evaluate(() => window.scrollTo(0, 0));
        
        // 额外等待确保所有图片都加载完成
        await page.waitForTimeout(3000);
        
        // 方法2：最终检查并强制加载所有图片
        console.log('[MyGolfSpy] 最终图片加载检查...');
        await page.evaluate(() => {
            // 滚动到顶部再到底部，确保所有图片都在视口中
            window.scrollTo(0, 0);
            window.scrollTo(0, document.body.scrollHeight);
            
            // 查找并加载所有图片
            const allImages = document.querySelectorAll('img');
            let loadedCount = 0;
            
            allImages.forEach(img => {
                // 检查是否是SVG占位符
                if (img.src && (img.src.startsWith('data:image/svg') || !img.src.startsWith('http'))) {
                    // 尝试从各种属性获取真实URL
                    const realUrl = img.getAttribute('data-lazy-src') || 
                                   img.getAttribute('data-src') || 
                                   img.getAttribute('data-original') ||
                                   img.dataset.lazySrc ||
                                   img.dataset.src;
                    
                    if (realUrl && realUrl.startsWith('http')) {
                        img.src = realUrl;
                        img.classList.add('lazyloaded');
                        img.removeAttribute('data-lazy-src');
                        img.removeAttribute('data-src');
                        loadedCount++;
                    }
                }
            });
            
            console.log(`[MyGolfSpy] 强制加载了 ${loadedCount} 张图片`);
            
            // 触发任何自定义懒加载事件
            window.dispatchEvent(new Event('scroll'));
            window.dispatchEvent(new Event('resize'));
            
            // 如果有jQuery，触发jQuery事件
            if (window.jQuery) {
                window.jQuery(window).trigger('scroll');
                window.jQuery('img[data-lazy-src]').trigger('lazyload');
            }
        });
        
        // 等待图片真正加载完成
        await page.waitForTimeout(3000);
        
        // 再次滚动到顶部准备抓取内容
        await page.evaluate(() => window.scrollTo(0, 0));
        
        return await page.evaluate(() => {
            // 多种标题选择器
            const title = document.querySelector('h1.entry-title, h1.jeg_post_title, h1.post-title, .post-header h1, .article-header h1')?.innerText || 
                         document.querySelector('h1')?.innerText || '';
            
            // 多种内容容器选择器
            const contentElement = document.querySelector('.entry-content, .jeg_main_content, .post-content, .article-content, article .content') ||
                                  document.querySelector('article') ||
                                  document.querySelector('main');
            
            if (!contentElement || !title) {
                // 如果还是找不到内容，尝试更广泛的搜索
                const allParagraphs = document.querySelectorAll('p');
                if (allParagraphs.length > 5) {
                    let content = `# ${title || 'MyGolfSpy Article'}\n\n`;
                    const images = [];
                    
                    allParagraphs.forEach(p => {
                        const text = p.innerText.trim();
                        if (text.length > 30 && !text.includes('Cookie') && !text.includes('Privacy')) {
                            content += `${text}\n\n`;
                        }
                    });
                    
                    // 查找所有图片
                    document.querySelectorAll('img').forEach(img => {
                        if (img.src && img.width > 200 && !img.src.includes('logo') && !img.src.includes('avatar')) {
                            images.push({ url: img.src, alt: img.alt || `图片${images.length + 1}` });
                        }
                    });
                    
                    return { title: title || 'MyGolfSpy Article', content, images };
                }
                return null;
            }
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // MyGolfSpy 特定内容处理 - 更广泛的选择器
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote, img, figure');
            elements.forEach(elem => {
                if (elem.tagName === 'P') {
                    const text = elem.innerText.trim();
                    // 过滤掉太短的段落和广告文字
                    if (text.length > 20 && 
                        !text.includes('Advertisement') && 
                        !text.includes('Affiliate Disclosure') &&
                        !text.includes('Cookie Policy')) {
                        content += `${text}\n\n`;
                    }
                } else if (elem.tagName === 'H2') {
                    content += `\n## ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'H3' || elem.tagName === 'H4') {
                    content += `\n### ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'UL' || elem.tagName === 'OL') {
                    const items = elem.querySelectorAll('li');
                    items.forEach(li => {
                        content += `• ${li.innerText.trim()}\n`;
                    });
                    content += '\n';
                } else if (elem.tagName === 'BLOCKQUOTE') {
                    content += `> ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
                    const img = elem.tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                    if (img && !img.classList.contains('avatar') && !img.src.includes('logo') && !img.src.includes('icon')) {
                        let imgUrl = img.src;
                        
                        // 如果当前src是data URL或者我们需要检查其他来源
                        if (!imgUrl || imgUrl.startsWith('data:')) {
                            // 尝试从其他属性获取真实URL
                            imgUrl = img.getAttribute('data-lazy-src') || 
                                    img.getAttribute('data-src') || 
                                    img.getAttribute('data-original') ||
                                    img.dataset.lazySrc ||
                                    img.dataset.src ||
                                    img.src;
                            
                            // 如果还是没有，尝试从srcset获取
                            if (!imgUrl || imgUrl.startsWith('data:')) {
                                const srcset = img.getAttribute('data-lazy-srcset') || img.getAttribute('srcset');
                                if (srcset) {
                                    const sources = srcset.split(',').map(s => s.trim());
                                    // 获取最高质量的图片（通常是最后一个）
                                    const lastSource = sources[sources.length - 1];
                                    imgUrl = lastSource.split(' ')[0];
                                }
                            }
                        }
                        
                        // 检查是否是小尺寸版本（300xXXX或XXXx210等小尺寸）
                        const isSmallSize = imgUrl && (
                            imgUrl.match(/-300x\d+/) || 
                            imgUrl.match(/-\d+x210/) ||
                            imgUrl.match(/-\d+x205/) ||
                            imgUrl.match(/-150x\d+/)
                        );
                        
                        // 确保URL有效且不是data URL，并且不是小尺寸图片
                        if (imgUrl && !imgUrl.startsWith('data:') && imgUrl.startsWith('http') && !isSmallSize) {
                            // 检查是否已存在相同基础名称的图片（避免同一图片的不同尺寸）
                            const baseImageName = imgUrl.replace(/-\d+x\d+/, '');
                            const isDuplicate = images.some(existingImg => {
                                const existingBase = existingImg.url.replace(/-\d+x\d+/, '');
                                return existingBase === baseImageName;
                            });
                            
                            if (!isDuplicate) {
                                imageCounter++;
                                // 获取图片描述
                                let alt = img.alt || '';
                                // 如果是figure标签，尝试获取figcaption
                                if (elem.tagName === 'FIGURE' && !alt) {
                                    const figcaption = elem.querySelector('figcaption');
                                    if (figcaption) {
                                        alt = figcaption.innerText || '';
                                    }
                                }
                                // 如果还是没有描述，使用默认描述
                                if (!alt) {
                                    alt = `图片${imageCounter}`;
                                }
                                images.push({ url: imgUrl, alt: alt });
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        }
                    }
                }
            });
            
            // 如果内容太少，尝试其他方法
            if (content.length < 200) {
                console.log('内容太少，尝试其他提取方法...');
                const textNodes = contentElement.querySelectorAll('div[class*="content"], div[class*="text"], section');
                textNodes.forEach(node => {
                    const text = node.innerText.trim();
                    if (text.length > 50 && !content.includes(text)) {
                        content += `${text}\n\n`;
                    }
                });
            }
            
            return { title, content, images };
        });
    }

    /**
     * Golfweek 文章内容抓取
     */
    async scrapeGolfweekArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.ArticleBody-articleBody, .gnt_ar_b', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[Golfweek] 处理懒加载图片...');
        
        // 先检查页面中的图片数量
        const initialImageCount = await page.evaluate(() => {
            return document.querySelectorAll('img').length;
        });
        console.log(`[Golfweek] 页面初始图片数量: ${initialImageCount}`);
        await page.evaluate(() => {
            // 滚动页面以触发懒加载
            const scrollStep = 500;
            const scrollDelay = 100;
            let scrollHeight = document.body.scrollHeight;
            let currentPosition = 0;
            
            const scrollInterval = setInterval(() => {
                window.scrollBy(0, scrollStep);
                currentPosition += scrollStep;
                
                if (currentPosition >= scrollHeight) {
                    clearInterval(scrollInterval);
                }
            }, scrollDelay);
        });
        
        // 等待滚动完成和图片加载
        await page.waitForTimeout(3000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-gl-src], img[loading="lazy"], img[data-srcset], img.gnt_em_img');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.glSrc && !img.src) {
                    img.src = img.dataset.glSrc;
                    img.removeAttribute('data-gl-src');
                }
                if (img.dataset.srcset) {
                    img.srcset = img.dataset.srcset;
                    img.removeAttribute('data-srcset');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
            
            // USA Today/Gannett特定的图片处理
            document.querySelectorAll('[data-c-is] img, picture img, .gnt_em img, .gnt_ar_i img').forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                }
                // 处理picture元素中的source标签
                const picture = img.closest('picture');
                if (picture) {
                    const sources = picture.querySelectorAll('source[data-srcset]');
                    sources.forEach(source => {
                        if (source.dataset.srcset) {
                            source.srcset = source.dataset.srcset;
                            source.removeAttribute('data-srcset');
                        }
                    });
                }
            });
            
            // 处理Gannett网站的特殊图片容器
            document.querySelectorAll('.gnt_em_vp_img, .gnt_em_img_vp, [data-gl-src]').forEach(container => {
                const img = container.querySelector('img') || container;
                if (img.tagName === 'IMG' && img.dataset.glSrc && !img.src) {
                    img.src = img.dataset.glSrc;
                }
            });
        });
        
        await page.waitForTimeout(2000);
        
        const result = await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.PageHeader-headline',
                'h1.article-headline',
                'h1.gnt_ar_hl',
                'h1[itemprop="headline"]',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 查找内容容器
            const contentSelectors = [
                '.ArticleBody-articleBody',
                '.gnt_ar_b',
                'article[itemprop="articleBody"]',
                '.story-body',
                '.article-body',
                'main article'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    console.log(`[Golfweek] 使用内容容器: ${selector}`);
                    break;
                }
            }
            
            if (!contentElement || !title) {
                console.log(`[Golfweek] 未找到内容容器或标题`);
                return null;
            }
            
            // 调试：检查内容容器中的图片
            const containerImages = contentElement.querySelectorAll('img, picture img, .gnt_em img, figure img');
            console.log(`[Golfweek] 内容容器中找到 ${containerImages.length} 张图片`);
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 移除不需要的元素（保留.gnt_em因为可能包含图片）
            const unwantedSelectors = [
                '.ad-container',
                '.related-articles',
                '.video-player',
                '.gnt_ar_s',
                '.gnt_ar_by',
                '.gnt_ar_dt',
                '.inline-share',
                '.newsletter-signup',
                '.recommended-articles',
                '.trending-stories',
                '.social-share-buttons',
                '.comments-section',
                '.advertisement',
                '.promo-box',
                'iframe',
                'script',
                'style',
                'noscript'
            ];
            
            unwantedSelectors.forEach(selector => {
                contentElement.querySelectorAll(selector).forEach(elem => elem.remove());
            });
            
            // 提取内容
            const elements = contentElement.querySelectorAll('p, h2, h3, blockquote, ul, ol, figure, img, picture, .gnt_em, .gnt_ar_i, [data-c-is]');
            const processedImages = new Set();
            
            elements.forEach(elem => {
                switch(elem.tagName) {
                    case 'P':
                        const text = elem.innerText.trim();
                        // 过滤掉视频为主的文章的短文本
                        if (text.length > 20 && !text.includes('Advertisement') && !text.includes('ADVERTISEMENT')) {
                            content += `${text}\n\n`;
                        }
                        break;
                        
                    case 'H2':
                        content += `\n## ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'H3':
                        content += `\n### ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'BLOCKQUOTE':
                        content += `> ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'UL':
                    case 'OL':
                        const items = elem.querySelectorAll('li');
                        items.forEach(li => {
                            content += `- ${li.innerText.trim()}\n`;
                        });
                        content += '\n';
                        break;
                        
                    case 'FIGURE':
                    case 'IMG':
                    case 'PICTURE':
                    case 'DIV': // 处理Gannett特殊容器
                        let imgs = [];
                        
                        if (elem.tagName === 'IMG') {
                            imgs = [elem];
                        } else if (elem.tagName === 'PICTURE') {
                            const picImg = elem.querySelector('img');
                            if (picImg) imgs = [picImg];
                        } else if (elem.tagName === 'FIGURE') {
                            imgs = Array.from(elem.querySelectorAll('img'));
                        } else if (elem.classList && (elem.classList.contains('gnt_em') || 
                                                     elem.classList.contains('gnt_ar_i') ||
                                                     elem.hasAttribute('data-c-is'))) {
                            // Gannett图片容器
                            const gannettImgs = elem.querySelectorAll('img');
                            if (gannettImgs.length > 0) {
                                imgs = Array.from(gannettImgs);
                            }
                        }
                        
                        imgs.forEach(img => {
                            if (!img || processedImages.has(img)) return;
                            processedImages.add(img);
                            
                            // 获取图片URL
                            let imgUrl = img.src || img.currentSrc;
                            
                            // 检查data属性
                            if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank.gif')) {
                                imgUrl = img.dataset.src || 
                                        img.dataset.glSrc ||
                                        img.getAttribute('data-src') ||
                                        img.getAttribute('data-gl-src') ||
                                        img.src;
                            }
                            
                            // 过滤无效图片（放宽限制）
                            const isValidImage = imgUrl && 
                                               (imgUrl.startsWith('http') || imgUrl.startsWith('//')) &&
                                               !imgUrl.includes('logo') && 
                                               !imgUrl.includes('icon') && 
                                               !imgUrl.includes('avatar') &&
                                               !imgUrl.includes('blank.gif') &&
                                               !imgUrl.includes('placeholder') &&
                                               !imgUrl.includes('data:image/gif');
                            
                            if (isValidImage) {
                                imageCounter++;
                                
                                // 获取图片描述
                                let alt = img.alt || img.title || '';
                                
                                // 从figure获取描述
                                if (!alt) {
                                    const figure = img.closest('figure');
                                    if (figure) {
                                        const figcaption = figure.querySelector('figcaption');
                                        if (figcaption) {
                                            alt = figcaption.textContent.trim();
                                        }
                                    }
                                }
                                
                                if (!alt) {
                                    alt = `图片${imageCounter}`;
                                }
                                
                                images.push({ 
                                    url: imgUrl, 
                                    alt: alt
                                });
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        });
                        break;
                }
            });
            
            // 检查是否是视频为主的文章（文字很少）
            const textLength = content.replace(/[#\-\*\[\]]/g, '').trim().length;
            if (textLength < 500) {
                console.log('[Golfweek] 文章内容过少，可能是视频为主的文章');
                // 仍然返回内容，让后续处理决定是否使用
            }
            
            // 获取作者信息
            const authorSelectors = [
                '.gnt_ar_by_a',
                '.byline',
                '.author',
                '[itemprop="author"]'
            ];
            
            let author = '';
            for (const selector of authorSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    author = elem.textContent.trim();
                    break;
                }
            }
            
            console.log(`[Golfweek] 找到 ${images.length} 张图片`);
            
            return { 
                title, 
                content, 
                images,
                author,
                url: window.location.href
            };
        });
        
        // 添加调试信息
        const debugInfo = await page.evaluate(() => ({ title: document.title, imgCount: document.querySelectorAll('img').length }));
        console.log(`[Golfweek] 抓取完成 - 标题: ${debugInfo.title}, 页面总图片数: ${debugInfo.imgCount}`);
        
        return result;
    }

    /**
     * Today's Golfer 特定抓取逻辑
     */
    async scrapeTodaysGolfer(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // Today's Golfer 特定选择器
            const linkSelectors = [
                'a[href*="/news-and-events/"]',
                'a[href*="/features/"]',
                'a[href*="/equipment/"]',
                'a[href*="/instruction/"]',
                'a[href*="/courses/"]',
                '.listing__item a',
                '.article-card a',
                'article a[href]',
                '.card-container a'
            ];
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 获取URL的最后部分
                    const urlPath = url.replace(/\/$/, '');
                    const lastPart = urlPath.split('/').pop();
                    
                    // 过滤条件
                    if (url && 
                        url.includes('todays-golfer.com') &&
                        !url.includes('/best/') &&
                        !url.match(/\/(tips-and-tuition|news-and-events|equipment|courses|features|best|news|instruction)\/?$/) &&
                        url.split('/').length >= 5 &&
                        lastPart && lastPart.includes('-') &&
                        lastPart.length > 10 &&
                        !url.includes('#') &&
                        !url.includes('category') &&
                        !url.includes('tag') &&
                        !url.includes('author') &&
                        !url.includes('page/') &&
                        !url.includes('/about') &&
                        !url.includes('/contact') &&
                        !url.includes('/subscribe') &&
                        !url.includes('greatmagazines.co.uk') &&
                        title.length > 10) {
                        
                        articleData.push({
                            url: url,
                            title: title
                        });
                    }
                });
            });
            
            // 去重
            const uniqueArticles = new Map();
            articleData.forEach(article => {
                if (!uniqueArticles.has(article.url)) {
                    uniqueArticles.set(article.url, article);
                }
            });
            
            return Array.from(uniqueArticles.values());
        });
        
        return articles;
    }

    /**
     * Today's Golfer 文章内容抓取
     */
    async scrapeTodaysGolferArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.entry-content, .article-content, .post-content, main article', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log("[Today's Golfer] 处理懒加载图片...");
        await page.evaluate(() => {
            // 滚动页面以触发懒加载
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.lazySrc && !img.src) {
                    img.src = img.dataset.lazySrc;
                    img.removeAttribute('data-lazy-src');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        });
        
        await page.waitForTimeout(2000);
        
        return await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.entry-title',
                'h1.article-title',
                '.article-header h1',
                '.entry-header h1',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 查找内容容器
            const contentSelectors = [
                '.entry-content',
                '.article-content',
                '.post-content',
                '.content-area',
                'main article',
                'article'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement || !title) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 移除不需要的元素
            const unwantedSelectors = [
                '.advertisement',
                '.ads',
                '.social-share',
                '.newsletter-signup',
                '.related-posts',
                '.comments',
                '.sidebar',
                '.footer',
                '.header',
                '.navigation',
                '.breadcrumb',
                '.tags',
                '.author-bio',
                '.wp-block-latest-posts',
                '.inline-related',
                '.also-read',
                '.trending',
                '.promo',
                'iframe',
                'script',
                'style',
                'noscript'
            ];
            
            unwantedSelectors.forEach(selector => {
                contentElement.querySelectorAll(selector).forEach(elem => elem.remove());
            });
            
            // 提取内容
            const elements = contentElement.querySelectorAll('p, h2, h3, blockquote, ul, ol, figure, img, .wp-block-image');
            const processedImages = new Set();
            
            elements.forEach(elem => {
                switch(elem.tagName) {
                    case 'P':
                        const text = elem.innerText.trim();
                        if (text.length > 20 && 
                            !text.includes('Advertisement') && 
                            !text.includes('ADVERTISEMENT') &&
                            !text.includes('Continue reading')) {
                            content += `${text}\n\n`;
                        }
                        break;
                        
                    case 'H2':
                        content += `\n## ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'H3':
                        content += `\n### ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'BLOCKQUOTE':
                        content += `> ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'UL':
                    case 'OL':
                        const items = elem.querySelectorAll('li');
                        items.forEach(li => {
                            content += `- ${li.innerText.trim()}\n`;
                        });
                        content += '\n';
                        break;
                        
                    case 'FIGURE':
                    case 'DIV':
                        if (elem.classList.contains('wp-block-image')) {
                            const img = elem.querySelector('img');
                            if (img && !processedImages.has(img)) {
                                processedImages.add(img);
                                processImage(img);
                            }
                        }
                        break;
                        
                    case 'IMG':
                        if (!processedImages.has(elem)) {
                            processedImages.add(elem);
                            processImage(elem);
                        }
                        break;
                }
            });
            
            function processImage(img) {
                // 获取图片URL
                let imgUrl = img.src || img.currentSrc;
                
                // 检查data属性
                if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank')) {
                    imgUrl = img.dataset.src || 
                            img.dataset.lazySrc ||
                            img.getAttribute('data-src') ||
                            img.getAttribute('data-lazy-src') ||
                            img.src;
                }
                
                // 过滤无效图片
                const isValidImage = imgUrl && 
                                   imgUrl.startsWith('http') &&
                                   !imgUrl.includes('logo') && 
                                   !imgUrl.includes('icon') && 
                                   !imgUrl.includes('avatar') &&
                                   !imgUrl.includes('blank') &&
                                   !imgUrl.includes('placeholder') &&
                                   !imgUrl.includes('greatmagazines');
                
                // Today's Golfer特殊处理：过滤小尺寸图片
                if (isValidImage && window.location.hostname.includes('todays-golfer.com')) {
                    // 过滤明确的小尺寸图片
                    const isSmallSize = imgUrl.includes('-150x150') ||
                                      imgUrl.includes('-300x200') ||
                                      imgUrl.includes('-thumbnail') ||
                                      imgUrl.includes('?w=150') ||
                                      imgUrl.includes('?width=150') ||
                                      imgUrl.includes('-small.');
                    
                    if (isSmallSize) {
                        console.log('跳过小尺寸图片:', imgUrl);
                        return;
                    }
                }
                
                if (isValidImage) {
                    imageCounter++;
                    
                    // 获取图片描述
                    let alt = img.alt || img.title || '';
                    
                    // 从figure获取描述
                    if (!alt) {
                        const figure = img.closest('figure');
                        if (figure) {
                            const figcaption = figure.querySelector('figcaption');
                            if (figcaption) {
                                alt = figcaption.textContent.trim();
                            }
                        }
                    }
                    
                    if (!alt) {
                        alt = `图片${imageCounter}`;
                    }
                    
                    images.push({ 
                        url: imgUrl, 
                        alt: alt
                    });
                    content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                }
            }
            
            // 获取作者信息
            const authorSelectors = [
                '.author-name',
                '.by-author',
                '.author',
                '.post-author',
                '[rel="author"]'
            ];
            
            let author = '';
            for (const selector of authorSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    author = elem.textContent.trim();
                    break;
                }
            }
            
            return { 
                title, 
                content, 
                images,
                author,
                url: window.location.href
            };
        });
    }

    /**
     * National Club Golfer 特定抓取逻辑
     */
    async scrapeNationalClubGolfer(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // National Club Golfer 特定选择器
            const linkSelectors = [
                'article a[href]',
                '.post a[href]',
                '.article a[href]',
                '.entry a[href]',
                '.article-card a[href]',
                'h2 a[href]',
                'h3 a[href]',
                '.headline a[href]',
                '.title a[href]',
                '.entry-title a[href]'
            ];
            
            const seenUrls = new Set();
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤条件
                    if (url && 
                        url.includes('nationalclubgolfer.com') &&
                        !url.includes('/category/') &&
                        !url.includes('/tag/') &&
                        !url.includes('/author/') &&
                        !url.includes('/page/') &&
                        !url.includes('/video/') &&
                        !url.includes('/videos/') &&
                        !url.includes('/watch/') &&
                        !url.includes('?') &&
                        !url.includes('#') &&
                        url.split('/').length >= 4 &&
                        title.length > 10 &&
                        !seenUrls.has(url)) {
                        
                        seenUrls.add(url);
                        
                        // 获取时间信息
                        let publishTime = null;
                        const container = link.closest('article, .post, .article-card, .entry');
                        if (container) {
                            const timeElement = container.querySelector('time[datetime]');
                            if (timeElement) {
                                publishTime = timeElement.getAttribute('datetime');
                            } else {
                                const dateElement = container.querySelector('.date, .published-date, .post-date');
                                if (dateElement) {
                                    publishTime = dateElement.textContent.trim();
                                }
                            }
                        }
                        
                        articleData.push({
                            url: url,
                            title: title,
                            publishTime: publishTime
                        });
                    }
                });
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * National Club Golfer 文章内容抓取
     */
    async scrapeNationalClubGolferArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.ArticleBody-articleBody, .entry-content, .article-content, .post-content', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[National Club Golfer] 处理懒加载图片...');
        await page.evaluate(() => {
            // 滚动页面以触发懒加载
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.lazySrc && !img.src) {
                    img.src = img.dataset.lazySrc;
                    img.removeAttribute('data-lazy-src');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        });
        
        await page.waitForTimeout(2000);
        
        return await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.PageHeader-headline',
                'h1.entry-title',
                'h1.article-title',
                '.article-header h1',
                '.entry-header h1',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 提取内容
            const contentSelectors = [
                '.ArticleBody-articleBody',
                '.entry-content',
                '.article-content',
                '.post-content',
                '.content-area',
                'article',
                'main'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 获取所有段落、标题和图片
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, img, figure, ul, ol, blockquote');
            elements.forEach(elem => {
                if (elem.tagName === 'P') {
                    const text = elem.innerText.trim();
                    // 过滤掉太短的段落和广告/视频相关文字
                    if (text.length > 20 && 
                        !text.toLowerCase().includes('video:') &&
                        !text.toLowerCase().includes('watch:') &&
                        !text.includes('Advertisement')) {
                        content += `${text}\n\n`;
                    }
                } else if (elem.tagName === 'H2') {
                    content += `\n## ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'H3' || elem.tagName === 'H4') {
                    content += `\n### ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'UL' || elem.tagName === 'OL') {
                    const items = elem.querySelectorAll('li');
                    items.forEach(li => {
                        content += `• ${li.innerText.trim()}\n`;
                    });
                    content += '\n';
                } else if (elem.tagName === 'BLOCKQUOTE') {
                    content += `> ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
                    const img = elem.tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                    if (img && img.src && !img.src.includes('logo') && !img.src.includes('icon')) {
                        imageCounter++;
                        let alt = img.alt || '';
                        
                        // 如果是figure标签，尝试获取figcaption
                        if (elem.tagName === 'FIGURE' && !alt) {
                            const figcaption = elem.querySelector('figcaption');
                            if (figcaption) {
                                alt = figcaption.innerText || '';
                            }
                        }
                        
                        if (!alt) {
                            alt = `图片${imageCounter}`;
                        }
                        
                        images.push({ 
                            url: img.src, 
                            alt: alt 
                        });
                        content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                    }
                }
            });
            
            return { 
                title, 
                content, 
                images,
                url: window.location.href
            };
        });
    }

    /**
     * PGA Tour 特定抓取逻辑
     */
    async scrapePGATour(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // PGA Tour 特定选择器
            const linkSelectors = [
                'a[href*="/news/"]',
                'a[href*="/article/"]',
                'a[href*="/video/"]',
                'a[href*="/instruction/"]',
                'a[href*="/tournament/"]',
                '.article-item a',
                '.news-item a',
                '.video-item a',
                'article a[href]',
                '[data-testid="article-link"]',
                '.card a[href]',
                '.content-card a[href]',
                'h2 a[href]',
                'h3 a[href]',
                'h4 a[href]',
                '.headline a[href]',
                '.story-link'
            ];
            
            const seenUrls = new Set();
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤条件
                    if (url && 
                        url.includes('pgatour.com') &&
                        (url.includes('/news/') || url.includes('/article/') || 
                         url.includes('/video/') || url.includes('/instruction/') ||
                         url.includes('/tournament/')) &&
                        !url.includes('#') &&
                        !url.includes('signin') &&
                        !url.includes('subscribe') &&
                        !url.includes('/category/') &&
                        !url.includes('/tag/') &&
                        !url.includes('?') &&
                        !seenUrls.has(url) &&
                        title.length > 10) {
                        
                        seenUrls.add(url);
                        
                        // 尝试获取时间信息
                        let publishTime = null;
                        const parent = link.closest('article, .article-item, .news-item, .content-card');
                        if (parent) {
                            const timeElem = parent.querySelector('time, .date, .timestamp, [datetime]');
                            if (timeElem) {
                                publishTime = timeElem.textContent?.trim() || timeElem.getAttribute('datetime') || '';
                            }
                        }
                        
                        articleData.push({ url, title, publishTime });
                    }
                });
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * PGA Tour 文章内容抓取
     */
    async scrapePGATourArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.article-content, .story-body, .content-body, article', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[PGA Tour] 处理懒加载图片...');
        await page.evaluate(() => {
            // 滚动页面以触发懒加载
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.lazySrc && !img.src) {
                    img.src = img.dataset.lazySrc;
                    img.removeAttribute('data-lazy-src');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        });
        
        await page.waitForTimeout(1000);
        
        return await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.article-header',
                'h1.headline',
                'h1.content-header',
                'h1.story-title',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            if (!title) return null;
            
            // 查找内容区域
            const contentSelectors = [
                '.article-content',
                '.story-body',
                '.content-body',
                '.article-text',
                'article'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 获取段落和图片
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, ul, ol, blockquote, img, figure');
            elements.forEach(elem => {
                if (elem.tagName === 'P') {
                    const text = elem.innerText.trim();
                    if (text.length > 20) {
                        content += `${text}\n\n`;
                    }
                } else if (elem.tagName === 'H2') {
                    content += `\n## ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'H3' || elem.tagName === 'H4') {
                    content += `\n### ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'UL' || elem.tagName === 'OL') {
                    const items = elem.querySelectorAll('li');
                    items.forEach(li => {
                        content += `• ${li.innerText.trim()}\n`;
                    });
                    content += '\n';
                } else if (elem.tagName === 'BLOCKQUOTE') {
                    content += `> ${elem.innerText.trim()}\n\n`;
                } else if (elem.tagName === 'IMG' || elem.tagName === 'FIGURE') {
                    const img = elem.tagName === 'FIGURE' ? elem.querySelector('img') : elem;
                    if (img && img.src && !img.src.includes('logo') && !img.src.includes('icon')) {
                        imageCounter++;
                        let alt = img.alt || '';
                        
                        // 如果是figure标签，尝试获取figcaption
                        if (elem.tagName === 'FIGURE' && !alt) {
                            const figcaption = elem.querySelector('figcaption');
                            if (figcaption) {
                                alt = figcaption.innerText || '';
                            }
                        }
                        
                        if (!alt) {
                            alt = `图片${imageCounter}`;
                        }
                        
                        images.push({ 
                            url: img.src, 
                            alt: alt 
                        });
                        content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                    }
                }
            });
            
            return { 
                title, 
                content, 
                images,
                url: window.location.href
            };
        });
    }


    /**
     * Sky Sports Golf 特定抓取逻辑
     */
    async scrapeSkySports(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // Sky Sports 特定选择器
            const linkSelectors = [
                'a[href*="/golf/news/"]',
                'a[href*="/golf/story/"]',
                'a[href*="/golf/report/"]',
                'a[href*="/golf/interview/"]',
                'a[href*="/golf/feature/"]',
                'a[href*="/golf/column/"]',
                '.news-list__headline a',
                '.news-list-secondary__headline a',
                '.sdc-site-tile__headline a',
                '.article__headline a',
                '.media-list__headline a',
                'h3.news-list__headline a',
                'h3 a[href*="/golf/"]',
                'h4 a[href*="/golf/"]',
                '.headline a[href*="/golf/"]'
            ];
            
            const seenUrls = new Set();
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤条件
                    if (url && 
                        url.includes('skysports.com/golf/') &&
                        (url.includes('/news/') || 
                         url.includes('/story/') || 
                         url.includes('/report/') || 
                         url.includes('/interview/') || 
                         url.includes('/feature/') || 
                         url.includes('/column/')) &&
                        !url.includes('/live/') &&
                        !url.includes('/video/') &&
                        !url.includes('/gallery/') &&
                        !url.includes('/poll/') &&
                        !url.includes('/quiz/') &&
                        !url.includes('/fixtures/') &&
                        !url.includes('/results/') &&
                        !url.includes('/leaderboard/') &&
                        !url.includes('#') &&
                        !url.includes('?') &&
                        title.length > 10 &&
                        !seenUrls.has(url)) {
                        
                        seenUrls.add(url);
                        
                        // 获取时间信息
                        let publishTime = null;
                        const container = link.closest('article, .news-list__item, .media-list__item, .sdc-site-tile');
                        if (container) {
                            const timeElement = container.querySelector('time[datetime], .label__timestamp, .sdc-site-tile__date-time');
                            if (timeElement) {
                                publishTime = timeElement.getAttribute('datetime') || timeElement.textContent.trim();
                            }
                        }
                        
                        articleData.push({
                            url: url,
                            title: title,
                            publishTime: publishTime
                        });
                    }
                });
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * Sky Sports Golf 文章内容抓取
     */
    async scrapeSkySportsArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.sdc-article-body, .article__body, .article-body, .story-body', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[Sky Sports] 处理懒加载图片...');
        await page.evaluate(() => {
            // 滚动页面以触发懒加载
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.lazySrc && !img.src) {
                    img.src = img.dataset.lazySrc;
                    img.removeAttribute('data-lazy-src');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        });
        
        await page.waitForTimeout(1000);
        
        return await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.sdc-article-header__headline',
                'h1.article__title',
                'h1.article-header__title',
                'h1.long-article__title',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 查找内容容器
            const contentSelectors = [
                '.sdc-article-body__body',
                '.article__body',
                '.article-body__content',
                '.story-body__inner',
                '.sdc-article-body',
                '.article-body',
                'article',
                'main'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement || !title) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 移除不需要的元素
            const unwantedSelectors = [
                '.sdc-article-widget',
                '.sdc-article-related-stories',
                '.sdc-article-tags',
                '.article__tags',
                '.advertisement',
                '.ads',
                '.social-share',
                '.newsletter-signup',
                '.related-stories',
                '.comments',
                '.sidebar',
                '.footer',
                '.header',
                '.navigation',
                '.breadcrumb',
                '.author-bio',
                '.video-player',
                '.promo-box',
                '.trending-now',
                '.read-more',
                '.also-see',
                '.live-blog-entry',
                '.poll',
                '.quiz',
                'iframe',
                'script',
                'style',
                'noscript'
            ];
            
            unwantedSelectors.forEach(selector => {
                contentElement.querySelectorAll(selector).forEach(elem => elem.remove());
            });
            
            // 提取内容
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, blockquote, ul, ol, figure, img');
            const processedImages = new Set();
            
            elements.forEach(elem => {
                switch(elem.tagName) {
                    case 'P':
                        const text = elem.innerText.trim();
                        if (text.length > 20 && 
                            !text.includes('Advertisement') && 
                            !text.includes('ADVERTISEMENT') &&
                            !text.includes('Please use Chrome browser')) {
                            content += `${text}\n\n`;
                        }
                        break;
                        
                    case 'H2':
                        content += `\n## ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'H3':
                    case 'H4':
                        content += `\n### ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'BLOCKQUOTE':
                        content += `> ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'UL':
                    case 'OL':
                        const items = elem.querySelectorAll('li');
                        items.forEach(li => {
                            content += `- ${li.innerText.trim()}\n`;
                        });
                        content += '\n';
                        break;
                        
                    case 'FIGURE':
                    case 'IMG':
                        let img = elem;
                        if (elem.tagName === 'FIGURE') {
                            img = elem.querySelector('img');
                        }
                        
                        if (img && !processedImages.has(img)) {
                            processedImages.add(img);
                            
                            // 获取图片URL
                            let imgUrl = img.src || img.currentSrc;
                            
                            // 检查data属性
                            if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank')) {
                                imgUrl = img.dataset.src || 
                                        img.dataset.lazySrc ||
                                        img.getAttribute('data-src') ||
                                        img.getAttribute('data-lazy-src') ||
                                        img.src;
                            }
                            
                            // 过滤无效图片
                            const isValidImage = imgUrl && 
                                               imgUrl.startsWith('http') &&
                                               !imgUrl.includes('logo') && 
                                               !imgUrl.includes('icon') && 
                                               !imgUrl.includes('avatar') &&
                                               !imgUrl.includes('blank') &&
                                               !imgUrl.includes('placeholder') &&
                                               !imgUrl.includes('sprite');
                            
                            if (isValidImage) {
                                imageCounter++;
                                
                                // 获取图片描述
                                let alt = img.alt || img.title || '';
                                
                                // 从figure获取描述
                                if (!alt && elem.tagName === 'FIGURE') {
                                    const figcaption = elem.querySelector('figcaption');
                                    if (figcaption) {
                                        alt = figcaption.textContent.trim();
                                    }
                                }
                                
                                // Sky Sports特有的图片描述位置
                                if (!alt) {
                                    const caption = elem.closest('.sdc-article-image')?.querySelector('.sdc-article-image__caption');
                                    if (caption) {
                                        alt = caption.textContent.trim();
                                    }
                                }
                                
                                if (!alt) {
                                    alt = `图片${imageCounter}`;
                                }
                                
                                images.push({ 
                                    url: imgUrl, 
                                    alt: alt
                                });
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        }
                        break;
                }
            });
            
            return { 
                title, 
                content, 
                images,
                url: window.location.href
            };
        });
    }

    /**
     * Golf Magic 特定抓取逻辑
     */
    async scrapeGolfMagic(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // Golf Magic 特定选择器
            const linkSelectors = [
                'a[href*="/news/"]',
                'a[href*="/equipment/"]',
                'a[href*="/features/"]',
                'a[href*="/reviews/"]',
                'a[href*="/tips/"]',
                '.article-item a',
                '.post-item a',
                '.content-card a',
                '.story-card a',
                'article a[href]',
                'h2 a[href]',
                'h3 a[href]'
            ];
            
            const seenUrls = new Set();
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤条件
                    if (url && 
                        url.includes('golfmagic.com') &&
                        !url.match(/\/(news|equipment|features|reviews|tips)\/?$/) &&
                        !url.includes('#') &&
                        !url.includes('/category/') &&
                        !url.includes('/tag/') &&
                        !url.includes('/author/') &&
                        !url.includes('/page/') &&
                        !url.includes('/about') &&
                        !url.includes('/contact') &&
                        !url.includes('/subscribe') &&
                        title.length > 10 &&
                        !seenUrls.has(url)) {
                        
                        seenUrls.add(url);
                        
                        // 查找时间信息
                        let publishTime = null;
                        const container = link.closest('article, .article-item, .post-item, .content-card');
                        
                        if (container) {
                            const timeElement = container.querySelector('time[datetime]');
                            if (timeElement) {
                                publishTime = timeElement.getAttribute('datetime');
                            }
                            
                            if (!publishTime) {
                                const dateText = container.querySelector('.date, .publish-date, .post-date')?.textContent?.trim();
                                if (dateText) {
                                    publishTime = dateText;
                                }
                            }
                        }
                        
                        articleData.push({
                            url: url,
                            title: title,
                            publishTime: publishTime
                        });
                    }
                });
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * Golf Magic 文章内容抓取
     */
    async scrapeGolfMagicArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.article-content, .story-content, .entry-content', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[Golf Magic] 处理懒加载图片...');
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.lazySrc && !img.src) {
                    img.src = img.dataset.lazySrc;
                    img.removeAttribute('data-lazy-src');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        });
        
        await page.waitForTimeout(1000);
        
        return await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.article-title',
                'h1.story-title',
                'h1.entry-title',
                '.article-header h1',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 查找内容容器
            const contentSelectors = [
                '.article-content',
                '.story-content',
                '.entry-content',
                '.content-area',
                'article',
                'main'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement || !title) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 移除不需要的元素
            const unwantedSelectors = [
                '.advertisement',
                '.ads',
                '.ad-container',
                '.social-share',
                '.newsletter-signup',
                '.related-articles',
                '.comments',
                '.sidebar',
                '.footer',
                '.header',
                '.navigation',
                '.breadcrumb',
                '.tags',
                '.author-bio',
                '.video-player',
                '.promo-box',
                '.trending-stories',
                '.recommended-posts',
                '.also-read',
                'iframe',
                'script',
                'style',
                'noscript'
            ];
            
            unwantedSelectors.forEach(selector => {
                contentElement.querySelectorAll(selector).forEach(elem => elem.remove());
            });
            
            // 提取内容
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, blockquote, ul, ol, figure, img');
            const processedImages = new Set();
            
            elements.forEach(elem => {
                switch(elem.tagName) {
                    case 'P':
                        const text = elem.innerText.trim();
                        if (text.length > 20 && 
                            !text.includes('Advertisement') && 
                            !text.includes('ADVERTISEMENT')) {
                            content += `${text}\n\n`;
                        }
                        break;
                        
                    case 'H2':
                        content += `\n## ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'H3':
                    case 'H4':
                        content += `\n### ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'BLOCKQUOTE':
                        content += `> ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'UL':
                    case 'OL':
                        const items = elem.querySelectorAll('li');
                        items.forEach(li => {
                            content += `- ${li.innerText.trim()}\n`;
                        });
                        content += '\n';
                        break;
                        
                    case 'FIGURE':
                    case 'IMG':
                        let img = elem;
                        if (elem.tagName === 'FIGURE') {
                            img = elem.querySelector('img');
                        }
                        
                        if (img && !processedImages.has(img)) {
                            processedImages.add(img);
                            
                            // 获取图片URL
                            let imgUrl = img.src || img.currentSrc;
                            
                            // 检查data属性
                            if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank')) {
                                imgUrl = img.dataset.src || 
                                        img.dataset.lazySrc ||
                                        img.getAttribute('data-src') ||
                                        img.getAttribute('data-lazy-src') ||
                                        img.src;
                            }
                            
                            // 过滤无效图片
                            const isValidImage = imgUrl && 
                                               imgUrl.startsWith('http') &&
                                               !imgUrl.includes('logo') && 
                                               !imgUrl.includes('icon') && 
                                               !imgUrl.includes('avatar') &&
                                               !imgUrl.includes('blank') &&
                                               !imgUrl.includes('placeholder') &&
                                               !imgUrl.includes('sprite');
                            
                            if (isValidImage) {
                                imageCounter++;
                                
                                // 获取图片描述
                                let alt = img.alt || img.title || '';
                                
                                // 从figure获取描述
                                if (!alt && elem.tagName === 'FIGURE') {
                                    const figcaption = elem.querySelector('figcaption');
                                    if (figcaption) {
                                        alt = figcaption.textContent.trim();
                                    }
                                }
                                
                                if (!alt) {
                                    alt = `图片${imageCounter}`;
                                }
                                
                                images.push({ 
                                    url: imgUrl, 
                                    alt: alt
                                });
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        }
                        break;
                }
            });
            
            return { 
                title, 
                content, 
                images,
                url: window.location.href
            };
        });
    }

    /**
     * LPGA网站文章列表抓取
     */
    async scrapeLPGA(page) {
        await page.goto('https://www.lpga.com/news', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        const articles = await page.evaluate(() => {
            const articleList = [];
            const items = document.querySelectorAll('article, .news-item, .story-item, [class*="article"]');
            
            items.forEach(item => {
                const linkElement = item.querySelector('a[href*="/news/"], a[href*="/stories/"]');
                const titleElement = item.querySelector('h2, h3, .title, [class*="title"]');
                const dateElement = item.querySelector('time, .date, [class*="date"]');
                
                if (linkElement && titleElement) {
                    const href = linkElement.href;
                    const title = titleElement.textContent.trim();
                    
                    if (href && href.includes('lpga.com') && title) {
                        articleList.push({
                            url: href,
                            title: title,
                            date: dateElement ? dateElement.textContent.trim() : new Date().toISOString()
                        });
                    }
                }
            });
            
            return articleList;
        });

        console.log(`[LPGA] 找到 ${articles.length} 篇文章`);
        return articles;
    }

    /**
     * LPGA网站文章内容抓取
     */
    async scrapeLPGAArticle(page) {
        try {
            // LPGA特有的选择器 - 注意：LPGA使用H2作为标题！
            const titleSelectors = [
                'h2', // LPGA主要使用H2
                'h1.article-header__title',
                'h1.story-header__title',
                'h1.content-header__title',
                '.article-title h1',
                '.page-title',
                'h1'
            ];
            
            let title = null;
            for (const selector of titleSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    title = await page.$eval(selector, el => el.textContent.trim());
                    if (title) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!title) {
                throw new Error('无法找到文章标题');
            }
            
            // 获取内容
            const contentSelectors = [
                '.article-content',
                '.story-content',
                '.content-body',
                '[class*="article"] [class*="content"]',
                'main',
                'article',
                'body' // LPGA可能直接在body中
            ];
            
            let content = '';
            for (const selector of contentSelectors) {
                try {
                    const elements = await page.$$(selector);
                    for (const element of elements) {
                        const text = await element.evaluate(el => el.innerText);
                        if (text && text.length > 100) {
                            // 对于body选择器，需要过滤掉导航等内容
                            if (selector === 'body') {
                                // 尝试找到主要内容区域
                                const mainContent = await element.evaluate(el => {
                                    // 查找包含多个p标签的区域
                                    const allP = el.querySelectorAll('p');
                                    if (allP.length > 5) {
                                        return Array.from(allP)
                                            .map(p => p.innerText.trim())
                                            .filter(text => text.length > 20)
                                            .join('\n\n');
                                    }
                                    return '';
                                });
                                if (mainContent && mainContent.length > 200) {
                                    content = mainContent;
                                    break;
                                }
                            } else {
                                content = text;
                                break;
                            }
                        }
                    }
                    if (content) break;
                } catch (e) {
                    continue;
                }
            }
            
            if (!content) {
                // 尝试获取段落内容
                const paragraphs = await page.$$eval('p', ps => 
                    ps.map(p => p.innerText.trim()).filter(text => text.length > 50)
                );
                if (paragraphs.length > 0) {
                    content = paragraphs.join('\n\n');
                }
            }
            
            if (!content) {
                throw new Error('无法找到文章内容');
            }
            
            // 获取时间
            let publishDate = null;
            const dateSelectors = [
                'time[datetime]',
                '.article-date',
                '.publish-date',
                '[class*="date"]'
            ];
            
            for (const selector of dateSelectors) {
                try {
                    const dateText = await page.$eval(selector, el => {
                        return el.getAttribute('datetime') || el.textContent;
                    });
                    if (dateText) {
                        publishDate = dateText;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            return {
                title,
                content,
                publishDate: publishDate || new Date().toISOString()
            };
            
        } catch (error) {
            console.error('LPGA文章抓取失败:', error.message);
            return null;
        }
    }

    /**
     * CBS Sports Golf 特定抓取逻辑
     */
    async scrapeCBSSports(page) {
        const articles = await page.evaluate(() => {
            const articleData = [];
            
            // CBS Sports 特定选择器
            const linkSelectors = [
                'a[href*="/golf/news/"]',
                'a[href*="/golf/"][href$=".html"]',
                '.Article-container a[href]',
                '.list-item-content a[href]',
                '.article-list-item a[href]',
                '.content-list-item a[href]',
                '.media-item a[href]',
                '.news-item a[href]',
                '.story-link',
                'article a[href*="/golf/"]',
                'h2 a[href*="/golf/"]',
                'h3 a[href*="/golf/"]',
                'h4 a[href*="/golf/"]',
                '.headline a[href]',
                '.title a[href]'
            ];
            
            const seenUrls = new Set();
            
            linkSelectors.forEach(selector => {
                const links = document.querySelectorAll(selector);
                links.forEach(link => {
                    const url = link.href;
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤条件 - 只保留高尔夫相关内容
                    if (url && 
                        url.includes('cbssports.com/golf/') &&
                        !url.includes('/video/') &&
                        !url.includes('/videos/') &&
                        !url.includes('/watch/') &&
                        !url.includes('/live/') &&
                        !url.includes('/schedule') &&
                        !url.includes('/rankings/') &&
                        !url.includes('/leaderboard/') &&
                        !url.includes('/players/') &&
                        !url.includes('/standings/') &&
                        !url.includes('/odds/') &&
                        !url.includes('/betting/') &&
                        !url.includes('/fantasy/') &&
                        !url.includes('/picks/') &&
                        !url.includes('/expert-picks/') &&
                        !url.includes('#') &&
                        title.length > 10 &&
                        !seenUrls.has(url)) {
                        
                        // 排除其他运动
                        const lowerTitle = title.toLowerCase();
                        const otherSports = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 
                                           'basketball', 'baseball', 'hockey', 'tennis', 
                                           'boxing', 'mma', 'ufc', 'nascar'];
                        
                        const hasOtherSports = otherSports.some(sport => 
                            lowerTitle.includes(sport) && !lowerTitle.includes('golf')
                        );
                        
                        if (!hasOtherSports) {
                            seenUrls.add(url);
                            
                            // 获取时间信息
                            let publishTime = null;
                            const container = link.closest('article, .list-item, .media-item, .content-item');
                            if (container) {
                                const timeElement = container.querySelector('time[datetime], .timestamp, .date, .article-date');
                                if (timeElement) {
                                    publishTime = timeElement.getAttribute('datetime') || timeElement.textContent.trim();
                                }
                            }
                            
                            articleData.push({
                                url: url,
                                title: title,
                                publishTime: publishTime
                            });
                        }
                    }
                });
            });
            
            return articleData;
        });
        
        return articles;
    }

    /**
     * CBS Sports Golf 文章内容抓取
     */
    async scrapeCBSSportsArticle(page) {
        // 等待内容加载
        await page.waitForSelector('.article-content, .story-content, .content-body', { timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // 处理懒加载图片
        console.log('[CBS Sports] 处理懒加载图片...');
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        await page.waitForTimeout(2000);
        
        // 强制加载所有懒加载图片
        await page.evaluate(() => {
            const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]');
            lazyImages.forEach(img => {
                if (img.dataset.src && !img.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                if (img.dataset.lazySrc && !img.src) {
                    img.src = img.dataset.lazySrc;
                    img.removeAttribute('data-lazy-src');
                }
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        });
        
        await page.waitForTimeout(1000);
        
        return await page.evaluate(() => {
            // 提取标题
            const titleSelectors = [
                'h1.article-headline',
                'h1.story-headline',
                'h1.content-headline',
                '.article-header h1',
                'h1'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
                const elem = document.querySelector(selector);
                if (elem && elem.textContent.trim()) {
                    title = elem.textContent.trim();
                    break;
                }
            }
            
            // 查找内容容器
            const contentSelectors = [
                '.article-content',
                '.story-content',
                '.content-body',
                '.article-text',
                'article',
                'main'
            ];
            
            let contentElement = null;
            for (const selector of contentSelectors) {
                const elem = document.querySelector(selector);
                if (elem) {
                    contentElement = elem;
                    break;
                }
            }
            
            if (!contentElement || !title) return null;
            
            let content = `# ${title}\n\n`;
            const images = [];
            let imageCounter = 0;
            
            // 移除不需要的元素
            const unwantedSelectors = [
                '.advertisement',
                '.ads',
                '.ad-container',
                '.social-share',
                '.newsletter-signup',
                '.related-articles',
                '.comments',
                '.sidebar',
                '.footer',
                '.header',
                '.navigation',
                '.breadcrumb',
                '.tags',
                '.author-bio',
                '.video-player',
                '.promo-box',
                '.trending-stories',
                '.recommended-posts',
                '.expert-picks',
                '.odds-widget',
                '.fantasy-widget',
                'iframe',
                'script',
                'style',
                'noscript'
            ];
            
            unwantedSelectors.forEach(selector => {
                contentElement.querySelectorAll(selector).forEach(elem => elem.remove());
            });
            
            // 提取内容
            const elements = contentElement.querySelectorAll('p, h2, h3, h4, blockquote, ul, ol, figure, img');
            const processedImages = new Set();
            
            elements.forEach(elem => {
                switch(elem.tagName) {
                    case 'P':
                        const text = elem.innerText.trim();
                        if (text.length > 20 && 
                            !text.includes('Advertisement') && 
                            !text.includes('ADVERTISEMENT')) {
                            content += `${text}\n\n`;
                        }
                        break;
                        
                    case 'H2':
                        content += `\n## ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'H3':
                    case 'H4':
                        content += `\n### ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'BLOCKQUOTE':
                        content += `> ${elem.innerText.trim()}\n\n`;
                        break;
                        
                    case 'UL':
                    case 'OL':
                        const items = elem.querySelectorAll('li');
                        items.forEach(li => {
                            content += `- ${li.innerText.trim()}\n`;
                        });
                        content += '\n';
                        break;
                        
                    case 'FIGURE':
                    case 'IMG':
                        let img = elem;
                        if (elem.tagName === 'FIGURE') {
                            img = elem.querySelector('img');
                        }
                        
                        if (img && !processedImages.has(img)) {
                            processedImages.add(img);
                            
                            // 获取图片URL
                            let imgUrl = img.src || img.currentSrc;
                            
                            // 检查data属性
                            if (!imgUrl || imgUrl.startsWith('data:') || imgUrl.includes('blank')) {
                                imgUrl = img.dataset.src || 
                                        img.dataset.lazySrc ||
                                        img.getAttribute('data-src') ||
                                        img.getAttribute('data-lazy-src') ||
                                        img.src;
                            }
                            
                            // 过滤无效图片
                            const isValidImage = imgUrl && 
                                               imgUrl.startsWith('http') &&
                                               !imgUrl.includes('logo') && 
                                               !imgUrl.includes('icon') && 
                                               !imgUrl.includes('avatar') &&
                                               !imgUrl.includes('blank') &&
                                               !imgUrl.includes('placeholder') &&
                                               !imgUrl.includes('sprite');
                            
                            if (isValidImage) {
                                imageCounter++;
                                
                                // 获取图片描述
                                let alt = img.alt || img.title || '';
                                
                                // 从figure获取描述
                                if (!alt && elem.tagName === 'FIGURE') {
                                    const figcaption = elem.querySelector('figcaption');
                                    if (figcaption) {
                                        alt = figcaption.textContent.trim();
                                    }
                                }
                                
                                if (!alt) {
                                    alt = `图片${imageCounter}`;
                                }
                                
                                images.push({ 
                                    url: imgUrl, 
                                    alt: alt
                                });
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        }
                        break;
                }
            });
            
            return { 
                title, 
                content, 
                images,
                url: window.location.href
            };
        });
    }
}

module.exports = SiteSpecificScrapers;