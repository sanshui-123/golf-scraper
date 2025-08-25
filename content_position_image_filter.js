#!/usr/bin/env node

/**
 * 基于内容位置的智能图片过滤系统
 * 优先考虑图片在网页中的位置，而不仅仅是尺寸
 * 针对每个网站的特点进行个性化过滤
 */

class ContentPositionImageFilter {
    constructor() {
        // 网站特定的图片过滤配置
        this.websiteConfigs = {
            'golf.com': {
                name: 'Golf.com',
                mainContentSelectors: [
                    '.c-entry-content',
                    '.article-body',
                    '.story-body',
                    '.content-body'
                ],
                excludeContainers: [
                    '.social-share',
                    '.newsletter',
                    '.ad-container',
                    '.related-articles',
                    '.author-bio',
                    '.comments'
                ],
                excludeImageClasses: [
                    'avatar',
                    'logo',
                    'social-icon',
                    'ad-image'
                ],
                excludeImageSrcPatterns: [
                    'logo',
                    'avatar',
                    'social',
                    'ad-',
                    'banner'
                ],
                minImageSize: {
                    width: 400,
                    height: 250
                },
                maxImages: 6, // Golf.com通常图片较多且质量高
                prioritizeSelectors: [
                    '.featured-image',
                    '.hero-image',
                    'figure img'
                ]
            },
            'golfmonthly.com': {
                name: 'Golf Monthly',
                mainContentSelectors: [
                    '.entry-content',
                    '.article-content',
                    '.post-content',
                    '.content-area'
                ],
                excludeContainers: [
                    '.wp-block-latest-posts',
                    '.related-posts',
                    '.sidebar',
                    '.navigation',
                    '.social-share',
                    '.advertisement'
                ],
                excludeImageClasses: [
                    'thumbnail',
                    'thumb',
                    'avatar',
                    'wp-post-image'
                ],
                excludeImageSrcPatterns: [
                    'thumb',
                    'thumbnail',
                    '150x150',
                    '300x200',
                    'avatar'
                ],
                minImageSize: {
                    width: 250,
                    height: 200
                },
                maxImages: 5,
                prioritizeSelectors: [
                    '.wp-block-image img',
                    'figure img',
                    '.featured-image img'
                ]
            },
            'mygolfspy.com': {
                name: 'MyGolfSpy',
                mainContentSelectors: [
                    '.entry-content',
                    '.post-content',
                    '.article-content',
                    '.content-area',
                    '.post-body'
                ],
                excludeContainers: [
                    '.yarpp-related',
                    '.social-share',
                    '.newsletter-signup',
                    '.related-posts',
                    '.comments',
                    '.widget'
                ],
                excludeImageClasses: [
                    'yarpp-thumbnail',
                    'avatar',
                    'social-icon',
                    'thumbnail'
                ],
                excludeImageSrcPatterns: [
                    'yarpp',
                    'thumbnail',
                    'social',
                    'avatar',
                    'logo'
                ],
                minImageSize: {
                    width: 350,
                    height: 250
                },
                maxImages: 4, // MyGolfSpy通常图片质量很高但数量适中
                prioritizeSelectors: [
                    '.wp-block-image img',
                    'figure img',
                    '.post-content img'
                ]
            },
            'golfwrx.com': {
                name: 'GolfWRX',
                mainContentSelectors: [
                    '#mvp-content-body',
                    '.mvp-content-body',
                    '.mvp-post-content',
                    '.td-post-content',
                    '.entry-content',
                    '.post-content'
                ],
                excludeContainers: [
                    '.td-post-sharing',
                    '.td-post-author-name',
                    '.td-related-posts',
                    '.yarpp-related',
                    '.mvp-related-posts',
                    '.wp-block-group',
                    '.td-post-source-tags',
                    '.mvp-post-soc-wrap'
                ],
                excludeImageClasses: [
                    'avatar',
                    'yarpp-thumbnail',
                    'td-retina-data',
                    'thumbnail'
                ],
                excludeImageSrcPatterns: [
                    'avatar',
                    'yarpp',
                    'thumbnail',
                    '400x240',  // 特定的缩略图尺寸
                    '150x',
                    'x150',
                    'logo',
                    'banner'
                ],
                minImageSize: {
                    width: 300,
                    height: 200
                },
                maxImages: 2, // 论坛类网站，通常只需要1-2张主要图片
                prioritizeSelectors: [
                    '.td-post-featured-image img',
                    '.mvp-post-feat-img img',
                    '#mvp-content-body img'
                ],
                // GolfWRX特殊规则：优先选择大图
                preferLargeImages: true,
                largeImageThreshold: 800
            },
            'golfdigest.com': {
                name: 'Golf Digest',
                mainContentSelectors: [
                    '[data-testid="BodyWrapper"]',
                    '.article__body',
                    '.body__inner-container',
                    '.content-body',
                    '.story-body'
                ],
                excludeContainers: [
                    '.related-stories',
                    '.social-icons',
                    '[class*="promo"]',
                    '[class*="newsletter"]',
                    '.ad-container',
                    '.byline-share'
                ],
                excludeImageClasses: [
                    'social-icon',
                    'promo-image',
                    'ad-image'
                ],
                excludeImageSrcPatterns: [
                    'social',
                    'promo',
                    'ad-',
                    'logo',
                    'icon'
                ],
                minImageSize: {
                    width: 400,
                    height: 300
                },
                maxImages: 5, // 杂志类网站，图片质量高
                prioritizeSelectors: [
                    '.responsive-asset img',
                    'figure img',
                    'picture img'
                ]
            }
        };
    }

    /**
     * 获取网站配置
     */
    getWebsiteConfig(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return this.websiteConfigs[domain] || this.websiteConfigs['golfmonthly.com'];
        } catch (e) {
            return this.websiteConfigs['golfmonthly.com'];
        }
    }

    /**
     * 在页面中识别主要内容区域
     */
    identifyMainContentArea(page, config) {
        return page.evaluate((config) => {
            // 尝试找到主要内容区域
            let mainContent = null;
            
            for (const selector of config.mainContentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    mainContent = element;
                    break;
                }
            }
            
            // 如果没找到特定的内容区域，使用article或main标签
            if (!mainContent) {
                mainContent = document.querySelector('article') || 
                             document.querySelector('main') || 
                             document.body;
            }
            
            return {
                found: !!mainContent,
                selector: mainContent ? mainContent.tagName.toLowerCase() + (mainContent.className ? '.' + mainContent.className.split(' ')[0] : '') : null
            };
        }, config);
    }

    /**
     * 智能图片过滤 - 基于位置和内容相关性
     */
    async filterImagesByPosition(page, url) {
        const config = this.getWebsiteConfig(url);
        
        console.log(`🔍 使用${config.name}的图片过滤规则`);
        
        // 识别主要内容区域
        const contentArea = await this.identifyMainContentArea(page, config);
        console.log(`📍 识别到主内容区域: ${contentArea.selector}`);
        
        return await page.evaluate((config) => {
            const validImages = [];
            const rejectedImages = [];
            
            // 在页面上下文中定义分析方法
            const analyzeImagePosition = (img, config, mainContentArea) => {
                const analysis = {
                    isValid: false,
                    priority: 0,
                    position: 'unknown',
                    validReasons: [],
                    rejectionReasons: [],
                    generatedAlt: ''
                };

                // 1. 基础存在性检查
                if (!img.src || img.src.startsWith('data:')) {
                    analysis.rejectionReasons.push('无效的图片源');
                    return analysis;
                }

                // 2. 位置验证 - 最重要的过滤条件
                const inMainContent = mainContentArea.contains(img);
                if (!inMainContent) {
                    analysis.rejectionReasons.push('不在主内容区域');
                    return analysis;
                }
                
                // 确定具体位置
                let position = 'content';
                if (config.prioritizeSelectors) {
                    for (const selector of config.prioritizeSelectors) {
                        try {
                            if (img.matches(selector) || img.closest(selector)) {
                                position = 'featured';
                                break;
                            }
                        } catch (e) {} // 忽略无效选择器
                    }
                }
                if (img.closest('p')) position = 'inline';
                if (img.closest('figure')) position = 'figure';
                
                analysis.position = position;
                analysis.validReasons.push('位于主内容区域');

                // 3. 排除容器检查
                for (const excludeSelector of config.excludeContainers) {
                    try {
                        if (img.closest(excludeSelector)) {
                            analysis.rejectionReasons.push(`位于排除容器: ${excludeSelector}`);
                            return analysis;
                        }
                    } catch (e) {} // 忽略无效选择器
                }

                // 4. 超链接检查 - 排除链接内的图片
                const linkParent = img.closest('a[href]');
                if (linkParent) {
                    const href = linkParent.href;
                    const currentUrl = window.location.href;
                    
                    if (href !== currentUrl && !href.startsWith('#')) {
                        analysis.rejectionReasons.push('位于外部链接内');
                        return analysis;
                    }
                }

                // 5. 图片类名检查
                for (const excludeClass of config.excludeImageClasses) {
                    if (img.classList.contains(excludeClass)) {
                        analysis.rejectionReasons.push(`包含排除类名: ${excludeClass}`);
                        return analysis;
                    }
                }

                // 6. 图片源路径检查
                for (const pattern of config.excludeImageSrcPatterns) {
                    if (img.src.toLowerCase().includes(pattern.toLowerCase())) {
                        analysis.rejectionReasons.push(`URL包含排除模式: ${pattern}`);
                        return analysis;
                    }
                }

                // 7. 尺寸验证（最后检查）
                const width = img.naturalWidth || img.width || 0;
                const height = img.naturalHeight || img.height || 0;
                
                if (width < config.minImageSize.width || height < config.minImageSize.height) {
                    analysis.rejectionReasons.push(`尺寸过小: ${width}x${height}`);
                    return analysis;
                }
                analysis.validReasons.push(`尺寸合适: ${width}x${height}`);

                // 8. 计算优先级
                let priority = 10; // 基础分数
                
                // 尺寸加分
                if (width >= 800) priority += 30;
                else if (width >= 600) priority += 20;
                else if (width >= 400) priority += 10;
                
                // 位置加分
                if (config.prioritizeSelectors) {
                    for (const selector of config.prioritizeSelectors) {
                        try {
                            if (img.matches(selector) || img.closest(selector)) {
                                priority += 25;
                                break;
                            }
                        } catch (e) {} // 忽略无效选择器
                    }
                }
                
                // figure标签加分
                if (img.closest('figure')) priority += 15;
                
                // 特殊网站规则
                if (config.preferLargeImages && width >= config.largeImageThreshold) {
                    priority += 20;
                }
                
                // Alt文本加分
                if (img.alt && img.alt.trim().length > 10) {
                    priority += 5;
                }
                
                analysis.priority = priority;
                analysis.validReasons.push(`优先级: ${priority}`);

                // 9. 生成替代文本
                if (img.alt && img.alt.trim()) {
                    analysis.generatedAlt = img.alt.trim();
                } else {
                    // 尝试从周围文本生成
                    const figure = img.closest('figure');
                    if (figure) {
                        const caption = figure.querySelector('figcaption');
                        if (caption && caption.textContent.trim()) {
                            analysis.generatedAlt = caption.textContent.trim();
                        }
                    }
                    
                    if (!analysis.generatedAlt) {
                        const positionMap = {
                            'featured': '特色图片',
                            'inline': '文章配图',
                            'figure': '插图',
                            'content': '内容图片'
                        };
                        analysis.generatedAlt = positionMap[position] || '图片';
                    }
                }

                // 通过所有检查
                analysis.isValid = true;
                return analysis;
            };
            
            // 找到主要内容区域
            let mainContentArea = null;
            for (const selector of config.mainContentSelectors) {
                mainContentArea = document.querySelector(selector);
                if (mainContentArea) break;
            }
            
            if (!mainContentArea) {
                mainContentArea = document.querySelector('article') || 
                                 document.querySelector('main') || 
                                 document.body;
            }
            
            // 获取主内容区域内的所有图片
            const allImages = mainContentArea.querySelectorAll('img');
            
            allImages.forEach((img, index) => {
                const analysis = analyzeImagePosition(img, config, mainContentArea);
                
                if (analysis.isValid) {
                    validImages.push({
                        src: img.src,
                        alt: img.alt || analysis.generatedAlt,
                        width: img.naturalWidth || img.width,
                        height: img.naturalHeight || img.height,
                        position: analysis.position,
                        priority: analysis.priority,
                        reasons: analysis.validReasons
                    });
                } else {
                    rejectedImages.push({
                        src: img.src,
                        reasons: analysis.rejectionReasons
                    });
                }
            });
            
            // 按优先级排序
            validImages.sort((a, b) => b.priority - a.priority);
            
            // 限制图片数量
            const limitedImages = validImages.slice(0, config.maxImages);
            
            return {
                validImages: limitedImages,
                rejectedImages,
                totalFound: allImages.length,
                totalValid: limitedImages.length,
                config: config.name
            };
        }, config);
    }

    /**
     * 分析单个图片的位置和有效性
     */
    analyzeImagePosition(img, config, mainContentArea) {
        const analysis = {
            isValid: false,
            priority: 0,
            position: 'unknown',
            validReasons: [],
            rejectionReasons: [],
            generatedAlt: ''
        };

        // 1. 基础存在性检查
        if (!img.src || img.src.startsWith('data:')) {
            analysis.rejectionReasons.push('无效的图片源');
            return analysis;
        }

        // 2. 位置验证 - 最重要的过滤条件
        const positionCheck = this.checkImagePosition(img, config, mainContentArea);
        if (!positionCheck.inMainContent) {
            analysis.rejectionReasons.push('不在主内容区域');
            return analysis;
        }
        analysis.position = positionCheck.position;
        analysis.validReasons.push('位于主内容区域');

        // 3. 排除容器检查
        for (const excludeSelector of config.excludeContainers) {
            if (img.closest(excludeSelector)) {
                analysis.rejectionReasons.push(`位于排除容器: ${excludeSelector}`);
                return analysis;
            }
        }

        // 4. 超链接检查 - 排除链接内的图片
        const linkParent = img.closest('a[href]');
        if (linkParent) {
            // 检查链接是否指向其他文章或外部链接
            const href = linkParent.href;
            const currentUrl = window.location.href;
            
            if (href !== currentUrl && !href.startsWith('#')) {
                analysis.rejectionReasons.push('位于外部链接内');
                return analysis;
            }
        }

        // 5. 图片类名检查
        for (const excludeClass of config.excludeImageClasses) {
            if (img.classList.contains(excludeClass)) {
                analysis.rejectionReasons.push(`包含排除类名: ${excludeClass}`);
                return analysis;
            }
        }

        // 6. 图片源路径检查
        for (const pattern of config.excludeImageSrcPatterns) {
            if (img.src.toLowerCase().includes(pattern.toLowerCase())) {
                analysis.rejectionReasons.push(`URL包含排除模式: ${pattern}`);
                return analysis;
            }
        }

        // 7. 尺寸验证（最后检查）
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        
        if (width < config.minImageSize.width || height < config.minImageSize.height) {
            analysis.rejectionReasons.push(`尺寸过小: ${width}x${height}`);
            return analysis;
        }
        analysis.validReasons.push(`尺寸合适: ${width}x${height}`);

        // 8. 计算优先级
        analysis.priority = this.calculateImagePriority(img, config, width, height);
        analysis.validReasons.push(`优先级: ${analysis.priority}`);

        // 9. 生成替代文本
        analysis.generatedAlt = this.generateAltText(img, analysis.position);

        // 通过所有检查
        analysis.isValid = true;
        return analysis;
    }

    /**
     * 检查图片位置
     */
    checkImagePosition(img, config, mainContentArea) {
        // 检查是否在主内容区域内
        const inMainContent = mainContentArea.contains(img);
        
        // 确定具体位置
        let position = 'content';
        
        // 检查是否是特色图片
        if (config.prioritizeSelectors) {
            for (const selector of config.prioritizeSelectors) {
                if (img.matches(selector) || img.closest(selector)) {
                    position = 'featured';
                    break;
                }
            }
        }
        
        // 检查是否在段落中
        if (img.closest('p')) {
            position = 'inline';
        }
        
        // 检查是否在figure中
        if (img.closest('figure')) {
            position = 'figure';
        }
        
        return {
            inMainContent,
            position
        };
    }

    /**
     * 计算图片优先级
     */
    calculateImagePriority(img, config, width, height) {
        let priority = 0;
        
        // 基础分数
        priority += 10;
        
        // 尺寸加分
        if (width >= 800) priority += 30;
        else if (width >= 600) priority += 20;
        else if (width >= 400) priority += 10;
        
        // 位置加分
        if (config.prioritizeSelectors) {
            for (const selector of config.prioritizeSelectors) {
                if (img.matches(selector) || img.closest(selector)) {
                    priority += 25;
                    break;
                }
            }
        }
        
        // figure标签加分
        if (img.closest('figure')) {
            priority += 15;
        }
        
        // 特殊网站规则
        if (config.preferLargeImages && width >= config.largeImageThreshold) {
            priority += 20;
        }
        
        // Alt文本加分
        if (img.alt && img.alt.trim().length > 10) {
            priority += 5;
        }
        
        return priority;
    }

    /**
     * 生成替代文本
     */
    generateAltText(img, position) {
        if (img.alt && img.alt.trim()) {
            return img.alt.trim();
        }
        
        // 尝试从周围文本生成
        const figure = img.closest('figure');
        if (figure) {
            const caption = figure.querySelector('figcaption');
            if (caption && caption.textContent.trim()) {
                return caption.textContent.trim();
            }
        }
        
        // 根据位置生成默认文本
        const positionMap = {
            'featured': '特色图片',
            'inline': '文章配图',
            'figure': '插图',
            'content': '内容图片'
        };
        
        return positionMap[position] || '图片';
    }

    /**
     * 为页面执行图片过滤（注入到页面中执行）
     */
    injectImageFilter() {
        return `
        // 将ContentPositionImageFilter的核心方法注入到页面中
        window.analyzeImagePosition = ${this.analyzeImagePosition.toString()};
        window.checkImagePosition = ${this.checkImagePosition.toString()};
        window.calculateImagePriority = ${this.calculateImagePriority.toString()};
        window.generateAltText = ${this.generateAltText.toString()};
        `;
    }
}

module.exports = ContentPositionImageFilter;