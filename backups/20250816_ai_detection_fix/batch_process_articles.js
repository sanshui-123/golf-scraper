#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');
const ImageProcessorFinal = require('./image_processor_final');
// const WebsiteDuplicateChecker = require('./website_duplicate_checker'); // 🔧 不再使用本地检查
const APIFailureHandler = require('./api_failure_handler');
const generateEnhancedHTML = require('./enhanced_html_template');
const SiteSpecificScrapers = require('./site_specific_scrapers');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

// 加载稳定性配置
let stabilityConfig = {};
try {
    stabilityConfig = require('./stability_config.json');
} catch (e) {
    console.log('⚠️  未找到stability_config.json，使用默认配置');
}

// 智能浏览器管理器
class BackgroundBrowserManager {
    constructor() {
        this.isHeadless = true;
        this.retryWithHeadful = false;
    }

    async launchBrowser(url = '', options = {}) {
        const requiresSpecialHandling = this.needsSpecialHandling(url);
        
        try {
            console.log(`🌐 尝试后台模式启动浏览器...`);
            
            const browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ],
                executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
            });

            if (requiresSpecialHandling) {
                const success = await this.testHeadlessMode(browser, url);
                if (!success) {
                    console.log(`⚠️  后台模式不适用，切换到最小化界面模式`);
                    await browser.close();
                    return await this.launchHeadfulBrowser(options);
                }
            }

            console.log(`✅ 后台模式启动成功`);
            return browser;

        } catch (error) {
            console.log(`⚠️  后台模式启动失败: ${error.message}`);
            
            if (requiresSpecialHandling) {
                return await this.launchHeadfulBrowser(options);
            }
            throw error;
        }
    }

    async launchHeadfulBrowser(options = {}) {
        console.log(`🖥️  启动最小化界面模式...`);
        
        const browser = await chromium.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-minimized',
                '--window-size=800,600',
                '--window-position=9999,9999',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security'
            ],
            executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
        });

        console.log(`✅ 最小化界面模式启动成功`);
        return browser;
    }

    needsSpecialHandling(url) {
        const specialSites = ['golfwrx.com', 'mygolfspy.com', 'cloudflare'];
        return specialSites.some(site => url.toLowerCase().includes(site));
    }

    async testHeadlessMode(browser, testUrl = '') {
        if (!testUrl) return true;
        
        try {
            console.log(`🧪 测试后台模式访问...`);
            
            const page = await browser.newPage();
            page.setDefaultTimeout(10000);
            
            await page.goto(testUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 10000 
            });
            
            const title = await page.title();
            const isBlocked = title.includes('Cloudflare') || 
                             title.includes('Protection') ||
                             title.includes('Challenge');
            
            await page.close();
            
            if (isBlocked) {
                console.log(`🚫 检测到反爬保护，后台模式不可用`);
                return false;
            }
            
            console.log(`✅ 后台模式测试通过`);
            return true;
            
        } catch (error) {
            console.log(`❌ 后台模式测试失败: ${error.message}`);
            return false;
        }
    }
}

class BatchArticleProcessor {
    constructor() {
        this.browser = null;
        this.browserManager = new BackgroundBrowserManager(); // 添加浏览器管理器
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.rewriter = new ArticleRewriterEnhanced();
        this.imageProcessor = new ImageProcessorFinal(this.baseDir);
        this.apiFailureHandler = new APIFailureHandler();
        this.siteSpecificScrapers = new SiteSpecificScrapers();
        this.aiDetector = null; // AI检测器，延迟初始化
        this.processingStartTime = Date.now(); // 记录开始时间
        this.ensureDirectories();
        
        // 加载网站配置
        try {
            this.websiteConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, 'website_configs.json'), 'utf8'));
        } catch (e) {
            // 如果配置文件不存在，使用默认配置
            this.websiteConfigs = {
                'golfmonthly.com': {
                    selectors: {
                        title: 'h1.entry-title, h1.article-title, .article-header h1, .entry-header h1, h1',
                        article: 'article, .article-content, .entry-content, main',
                        content: 'p, h2, h3',
                        heroImage: '.image-hero__padding img, article img:first-of-type',
                        contentImages: 'figure img'
                    }
                }
            };
        }
    }

    ensureDirectories() {
        ['images', 'wechat_ready', 'wechat_html'].forEach(dir => {
            const fullPath = path.join(this.baseDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }
    
    getWebsiteConfig(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return this.websiteConfigs[domain] || this.websiteConfigs['golfmonthly.com'];
        } catch (e) {
            return this.websiteConfigs['golfmonthly.com'];
        }
    }

    // 🔧 修改1: 原子性的文章编号分配 - 解决并发冲突
    getOrAssignArticleNumber(url) {
        const urlMapFile = path.join(this.baseDir, 'article_urls.json');
        let urlMapping = {};
        
        // 读取现有映射
        if (fs.existsSync(urlMapFile)) {
            try {
                urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
            } catch (err) {
                console.log('⚠️ URL映射文件读取失败，创建新文件');
            }
        } else {
            // 如果是新文件，先获取全局最大编号
            console.log('📁 创建新的URL映射文件，先扫描全局最大编号...');
        }
        
        // 检查URL是否已有编号
        for (const [num, data] of Object.entries(urlMapping)) {
            const mappedUrl = typeof data === 'string' ? data : data.url;
            if (mappedUrl === url) {
                // 如果是失败状态，先检查是否在其他日期已成功
                if (typeof data === 'object' && (data.status === 'failed' || data.status === 'processing')) {
                    // 全局去重检查
                    const { checkGlobalDuplicate } = require('./check_global_duplicates');
                    const globalCheck = checkGlobalDuplicate(url);
                    
                    if (globalCheck && globalCheck.hasContent && globalCheck.date !== todayDate) {
                        console.log(`⏭️ 跳过失败文章 ${num}：已在 ${globalCheck.date}/文章${globalCheck.articleNum} 成功处理`);
                        // 更新状态为已在其他日期完成
                        urlMapping[num] = {
                            url: url,
                            timestamp: data.timestamp,
                            status: 'duplicate',
                            duplicateInfo: {
                                date: globalCheck.date,
                                articleNum: globalCheck.articleNum
                            },
                            skippedAt: new Date().toISOString()
                        };
                        fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                        return null; // 返回null表示跳过此URL
                    }
                    
                    console.log(`♻️ 复用失败/处理中文章编号: ${num} (状态: ${data.status})`);
                    urlMapping[num] = {
                        url: url,
                        timestamp: new Date().toISOString(),
                        status: 'retrying',
                        previousError: data.error,
                        retryCount: (data.retryCount || 0) + 1
                    };
                    fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                } else {
                    console.log(`♻️ URL已有编号: ${num}`);
                }
                return String(num).padStart(2, '0');
            }
        }
        
        // 分配新编号
        let maxNum = 0;
        
        // 从URL映射获取最大编号
        const nums = Object.keys(urlMapping).map(n => parseInt(n)).filter(n => !isNaN(n));
        if (nums.length > 0) {
            maxNum = Math.max(...nums);
        }
        
        // 检查所有日期目录中的最大编号（全局扫描）
        // 优化：使用缓存避免重复扫描
        const golfContentDir = path.join(process.cwd(), 'golf_content');
        const cacheFile = path.join(golfContentDir, '.max_article_number');
        
        // 尝试从缓存读取
        let cachedMax = 0;
        if (fs.existsSync(cacheFile)) {
            try {
                const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                // 缓存有效期：5分钟
                if (Date.now() - cacheData.timestamp < 300000) {
                    cachedMax = cacheData.maxNumber;
                    console.log(`📁 使用缓存的最大编号: ${cachedMax}`);
                    maxNum = Math.max(maxNum, cachedMax);
                }
            } catch (e) {
                // 忽略缓存错误
            }
        }
        
        // 如果缓存无效，执行扫描
        if (cachedMax === 0) {
            console.log(`📁 扫描目录: ${golfContentDir}`);
            
            if (fs.existsSync(golfContentDir)) {
                const dateDirs = fs.readdirSync(golfContentDir)
                    .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
                console.log(`📁 找到日期目录: ${dateDirs.join(', ')}`);
                
                for (const dateDir of dateDirs) {
                    const wechatDir = path.join(golfContentDir, dateDir, 'wechat_ready');
                    if (fs.existsSync(wechatDir)) {
                        const files = fs.readdirSync(wechatDir)
                            .filter(f => f.match(/wechat_article_(\d+)\.md/))
                            .map(f => parseInt(f.match(/wechat_article_(\d+)\.md/)[1]));
                        if (files.length > 0) {
                            const dirMax = Math.max(...files);
                            console.log(`📁 ${dateDir}/wechat_ready: 最大编号 ${dirMax}`);
                            maxNum = Math.max(maxNum, ...files);
                        }
                    }
                
                // 同时检查URL映射文件
                const urlMapPath = path.join(golfContentDir, dateDir, 'article_urls.json');
                if (fs.existsSync(urlMapPath)) {
                    try {
                        const urlMap = JSON.parse(fs.readFileSync(urlMapPath, 'utf8'));
                        const urlNums = Object.keys(urlMap).map(n => parseInt(n)).filter(n => !isNaN(n));
                        if (urlNums.length > 0) {
                            maxNum = Math.max(maxNum, ...urlNums);
                        }
                    } catch (e) {
                        // 忽略
                    }
                }
            }
            
            // 保存缓存
            try {
                fs.writeFileSync(cacheFile, JSON.stringify({
                    maxNumber: maxNum,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // 忽略缓存写入错误
            }
        }
        }
        
        console.log(`📊 最终maxNum: ${maxNum}`);
        const newNum = maxNum + 1;
        const paddedNum = String(newNum).padStart(2, '0');
        
        // 立即保存映射，防止并发冲突
        urlMapping[newNum] = {
            url: url,
            timestamp: new Date().toISOString(),
            status: 'processing'
        };
        
        try {
            fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
            console.log(`🆕 分配新编号: ${paddedNum}`);
        } catch (err) {
            console.error('❌ 保存URL映射失败:', err.message);
        }
        
        return paddedNum;
    }

    // 🔧 修改2: 增强Claude输出验证
    validateClaudeOutput(stdout) {
        // 验证输出是否包含中文
        const hasChineseChars = /[\u4e00-\u9fa5]/.test(stdout);
        if (!hasChineseChars) {
            throw new Error('改写结果不包含中文内容');
        }
        
        // 验证是否有标题（以#开头）
        let processedContent = stdout.trim();
        const hasTitle = /^#\s+.+/m.test(processedContent);
        
        if (!hasTitle) {
            // 尝试修复：如果第一行不是标题格式，但有内容，则添加#
            const lines = processedContent.split('\n');
            if (lines.length > 0 && lines[0].trim()) {
                // 如果第一行不是空的，假设它是标题
                const firstLine = lines[0].trim();
                // 检查是否已经有其他级别的标题标记
                if (!firstLine.startsWith('#')) {
                    lines[0] = `# ${firstLine}`;
                    processedContent = lines.join('\n');
                    
                    // 再次验证
                    if (/^#\s+.+/m.test(processedContent)) {
                        return processedContent; // 返回修复后的内容
                    }
                }
            }
            throw new Error('改写结果缺少标题（应以#开头）');
        }
        
        return processedContent; // 返回验证后的内容（可能被修复过）
    }

    // 🆕 新增：调用Web服务器的URL检查API
    // 🔧 重要规则：先进行本地检查，再进行Web服务器检查，避免重复处理
    async checkUrlsForDuplicates(urls, skipDuplicateCheck = false) {
        try {
            // 如果跳过重复检查，直接返回所有URL为新URL
            if (skipDuplicateCheck) {
                console.log(`⚡ 跳过重复检查，将处理所有 ${urls.length} 个URL`);
                return {
                    success: true,
                    total: urls.length,
                    existing: 0,
                    new: urls.length,
                    results: urls.map(url => ({ url, exists: false })),
                    newUrls: urls,
                    duplicateUrls: []
                };
            }
            
            console.log(`🔍 开始URL重复检查（${urls.length} 个URL）...`);
            
            // 🔧 第一步：先进行本地检查，避免重复处理已经抓取过的文章
            console.log('📁 第1步：检查本地是否已处理...');
            const localDuplicates = [];
            const localNewUrls = [];
            
            // 标准化URL的函数
            const normalizeUrl = (url) => {
                return url
                    .toLowerCase()
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .replace(/\/$/, '')
                    .replace(/\?.*$/, '')
                    .replace(/#.*$/, '');
            };
            
            // 使用内存缓存加速URL检查
            const urlCache = new Map();
            const baseDir = 'golf_content';
            
            // 预加载所有URL到内存
            if (fs.existsSync(baseDir)) {
                const dateDirs = fs.readdirSync(baseDir)
                    .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
                
                for (const dateDir of dateDirs) {
                    const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
                    if (fs.existsSync(urlsJsonPath)) {
                        try {
                            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                            for (const [articleNum, recordedUrl] of Object.entries(urlMapping)) {
                                const normalizedUrl = normalizeUrl(typeof recordedUrl === 'string' ? recordedUrl : recordedUrl.url);
                                urlCache.set(normalizedUrl, { dateDir, articleNum });
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
            
            // 检查每个URL（从内存缓存）
            for (const url of urls) {
                const normalizedUrl = normalizeUrl(url);
                const cached = urlCache.get(normalizedUrl);
                
                if (cached) {
                    // 检查是否为失败状态，失败的可以重试
                    const urlsJsonPath = path.join(baseDir, cached.dateDir, 'article_urls.json');
                    let shouldRetry = false;
                    
                    if (fs.existsSync(urlsJsonPath)) {
                        try {
                            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                            const record = urlMapping[cached.articleNum];
                            if (typeof record === 'object' && record.status === 'failed') {
                                shouldRetry = true;
                                console.log(`  🔄 失败文章，可重试: ${url}`);
                                console.log(`      位置: ${cached.dateDir}/文章${cached.articleNum}`);
                                console.log(`      失败原因: ${record.error || '未知'}`);
                            }
                        } catch (e) {}
                    }
                    
                    if (shouldRetry) {
                        localNewUrls.push(url);
                    } else {
                        localDuplicates.push(url);
                        console.log(`  ⏭️  本地已存在: ${url}`);
                        console.log(`      位置: ${cached.dateDir}/文章${cached.articleNum}`);
                    }
                } else {
                    localNewUrls.push(url);
                }
            }
            
            console.log(`\n📊 本地检查结果:`);
            console.log(`  ✅ 本地新URL: ${localNewUrls.length}`);
            console.log(`  ⏭️  本地重复: ${localDuplicates.length}`);
            
            // 如果没有新URL，直接返回
            if (localNewUrls.length === 0) {
                console.log('\n✅ 所有URL都已在本地处理过，无需重复处理');
                return {
                    newUrls: [],
                    duplicateUrls: localDuplicates,
                    skippedCount: localDuplicates.length
                };
            }
            
            // 🔧 第二步：对本地新URL再通过Web服务器检查是否已发布
            console.log('\n🌐 第2步：检查本地新URL是否已发布到网站...');
            const fetch = (await import('node-fetch')).default;
            const response = await fetch('http://localhost:8080/api/check-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: localNewUrls })
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            console.log(`\n📊 Web服务器检查结果:`);
            console.log(`  ✅ 网站上未发布: ${result.new}`);
            console.log(`  ⏭️  网站上已发布: ${result.existing}`);
            
            if (result.existing > 0) {
                console.log('\n⏭️  网站上已存在的URL:');
                result.results
                    .filter(r => r.exists)
                    .forEach(item => {
                        console.log(`  ⏭️  ${item.url}`);
                        console.log(`      已发布于: ${item.foundIn.date}/${item.foundIn.filename}`);
                        console.log(`      标题: ${item.foundIn.title}`);
                    });
            }
            
            // 返回新的URL列表（本地和网站都不存在的）
            const finalNewUrls = result.results
                .filter(r => !r.exists)
                .map(r => r.url);
            
            // 合并所有重复URL（本地重复 + 网站重复）
            const webDuplicates = result.results.filter(r => r.exists).map(r => r.url);
            const allDuplicates = [...localDuplicates, ...webDuplicates];
                
            console.log(`\n🚀 最终将处理 ${finalNewUrls.length} 个新URL\n`);
            return {
                newUrls: finalNewUrls,
                duplicateUrls: allDuplicates,
                skippedCount: allDuplicates.length
            };
            
        } catch (error) {
            console.error('❌ URL检查过程出错:', error.message);
            
            // 如果Web服务器失败，使用本地检查的结果
            console.log('⚠️  使用本地检查结果继续处理...\n');
            return {
                newUrls: urls,
                duplicateUrls: [],
                skippedCount: 0
            };
            
            // 如果所有检查都失败，返回空结果避免重复处理
            console.log('⚠️  无法进行重复检查，为避免重复处理，停止操作\n');
            return {
                newUrls: [],
                duplicateUrls: urls,
                skippedCount: urls.length
            };
        }
    }

    async processArticles(urls, options = {}) {
        console.log('🚀 批量处理文章（智能流畅版）');
        
        // 解析选项
        const { skipDuplicateCheck = false } = options;
        
        // 1. 🆕 使用增强的URL检查（优先使用Web服务器API）
        console.log('1️⃣ 智能URL重复检测...\n');
        const urlCheckResult = await this.checkUrlsForDuplicates(urls, skipDuplicateCheck);
        const newUrls = urlCheckResult.newUrls;
        const duplicateUrls = urlCheckResult.duplicateUrls;
        
        if (newUrls.length === 0) {
            console.log('✅ 所有文章都已处理过，无需重复处理');
            console.log('👋 程序退出');
            return;
        }
        
        // 只处理新文章
        console.log(`📊 开始处理 ${newUrls.length} 篇新文章\n`);
        
        const totalStart = Date.now();
        
        // 2. 启动浏览器
        console.log('2️⃣ 启动浏览器...');
        
        try {
            // 使用智能浏览器管理器，自动选择最佳模式
            const firstUrl = newUrls[0] || '';
            console.log(`🌐 准备启动浏览器处理 ${newUrls.length} 篇文章...`);
            this.browser = await this.browserManager.launchBrowser(firstUrl);
            
            // 3. 串行处理每个文章（从抓取到改写完成）
        console.log('3️⃣ 开始逐个处理文章...\n');
        const extractStart = Date.now();
        
        const articles = [];
        
        // 串行处理每个文章 - 使用URL级别的原子编号分配
        for (let i = 0; i < newUrls.length; i++) {
            const url = newUrls[i];
            // 🔧 关键修复：基于URL的原子编号分配，防止重复
            const articleNum = this.getOrAssignArticleNumber(url);
            
            // 如果返回null，说明此URL已在其他日期成功处理，跳过
            if (articleNum === null) {
                console.log(`\n⏭️ 跳过第 ${i + 1}/${newUrls.length} 篇文章（已在其他日期成功处理）`);
                console.log(`🔗 URL: ${url}\n`);
                continue;
            }
            
            console.log(`\n═══════════════════════════════════════════════════`);
            console.log(`📄 处理第 ${i + 1}/${newUrls.length} 篇文章`);
            console.log(`🔗 URL: ${url}`);
            console.log(`📝 编号: article_${articleNum}`);
            console.log(`═══════════════════════════════════════════════════\n`);
            
            // 检查是否为装备类文章（仅做标记，不跳过）
            const equipmentKeywords = [
                'buying-advice',
                'best-.*-golf-clubs',
                'best-.*-clubs',
                'golf-clubs',
                'equipment',
                'gear',
                'golf-balls',
                'rangefinder',
                'prime-day',
                'amazon',
                'best-irons',
                'best-drivers',
                'best-putters',
                'best-wedges',
                'irons',
                'drivers',
                'putters',
                'wedges',
                'blades'
            ];
            
            const isEquipmentArticle = equipmentKeywords.some(keyword => {
                const regex = new RegExp(keyword, 'i');
                return regex.test(url);
            });
            
            if (isEquipmentArticle) {
                console.log('🛍️  检测到装备类文章');
                console.log(`💡 将尝试处理此文章（可能内容较长）`);
            }
            
            // 抓取文章内容
            const page = await this.browser.newPage();
            
            // 如果是MyGolfSpy或GolfWRX，需要增强的反检测措施
            if (url.includes('mygolfspy.com') || url.includes('golfwrx.com')) {
                await page.addInitScript(() => {
                    // 覆盖navigator.webdriver
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });
                    
                    // 覆盖navigator.plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5]
                    });
                    
                    // 覆盖chrome对象
                    window.chrome = {
                        runtime: {},
                        loadTimes: function() {},
                        csi: function() {},
                        app: {}
                    };
                    
                    // 隐藏自动化痕迹
                    delete navigator.__proto__.webdriver;
                    
                    // 修改权限API
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );
                });
                
                // 设置额外的请求头
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0'
                });
            }
            
            // 处理特定网站的 cookies
            if (url.includes('mygolfspy.com')) {
                // MyGolfSpy特殊处理 - 由于403问题，建议使用RSS方法
                console.log('⚠️  MyGolfSpy检测到 - 直接访问可能会遇到403错误');
                console.log('💡 建议使用RSS方法获取URL: node process_mygolfspy_rss.js');
                
                // 尝试添加更多反检测措施
                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                });
                
                // 增加等待时间
                await page.waitForTimeout(5000);
            } else if (url.includes('golfwrx.com')) {
                // GolfWRX特殊处理 - 可能有Cloudflare保护
                console.log('⚠️  GolfWRX检测到 - 可能遇到Cloudflare保护');
                console.log('💡 脚本会自动处理，如遇问题会重试');
                
                try {
                    const cookieFile = path.join(__dirname, 'cookies', 'mygolfspy_cookies.json');
                    const cookieData = fs.readFileSync(cookieFile, 'utf8');
                    const cookies = JSON.parse(cookieData);
                    await page.context().addCookies(cookies);
                } catch (e) {
                    // 忽略 cookie 加载错误
                }
            }
            
            try {
                // 获取网站配置
                const siteConfig = this.getWebsiteConfig(url);
                const selectors = siteConfig.selectors;
                
                // 增强的页面加载重试机制
                let response;
                let pageLoadAttempts = 0;
                const maxPageLoadAttempts = 3;
                const isGolfCom = url.includes('golf.com');
                
                while (pageLoadAttempts < maxPageLoadAttempts) {
                    try {
                        // 使用最稳定的策略 - 恢复到之前正常工作的配置
                        const waitStrategy = 'domcontentloaded';
                        // Golf.com需要更长的超时时间
                        const timeout = isGolfCom ? 
                            (pageLoadAttempts === 0 ? 45000 : 60000) : 
                            (pageLoadAttempts === 0 ? 30000 : 45000);
                        
                        // GolfWRX需要更长的超时时间
                        const adjustedTimeout = url.includes('golfwrx.com') ? timeout * 2 : timeout;
                        console.log(`  ⏳ 加载页面 (第${pageLoadAttempts + 1}/${maxPageLoadAttempts}次, 策略: ${waitStrategy}, 超时: ${adjustedTimeout/1000}秒)`);
                        
                        response = await page.goto(url, { 
                            waitUntil: waitStrategy, 
                            timeout: adjustedTimeout 
                        });
                        
                        // Golf.com需要额外等待
                        if (isGolfCom) {
                            console.log('  ⏳ Golf.com特殊等待：等待内容完全加载...');
                            await page.waitForTimeout(5000);
                        }
                        
                        // Golf Digest需要额外等待
                        if (url.includes('golfdigest.com')) {
                            console.log('  ⏳ Golf Digest特殊等待：等待内容完全加载...');
                            await page.waitForTimeout(3000);
                        }
                        
                        // GolfWRX Cloudflare处理
                        if (url.includes('golfwrx.com')) {
                            const pageContent = await page.content();
                            if (pageContent.includes('Cloudflare') || 
                                pageContent.includes('Just a moment') ||
                                pageContent.includes('cf-browser-verification')) {
                                console.log('  ⚠️ 检测到GolfWRX Cloudflare保护，智能等待...');
                                
                                let cloudflareWaitTime = 0;
                                const maxCloudflareWait = 30000;
                                let lastContentLength = 0;
                                let stableCount = 0;
                                
                                while (cloudflareWaitTime < maxCloudflareWait) {
                                    await page.waitForTimeout(2000);
                                    cloudflareWaitTime += 2000;
                                    
                                    const currentContent = await page.content();
                                    
                                    // 检查内容是否稳定
                                    if (currentContent.length === lastContentLength) {
                                        stableCount++;
                                    } else {
                                        stableCount = 0;
                                        lastContentLength = currentContent.length;
                                    }
                                    
                                    // 检查是否通过Cloudflare
                                    const cloudflareGone = !currentContent.includes('Cloudflare') && 
                                                         !currentContent.includes('cf-browser-verification');
                                    
                                    if (cloudflareGone || stableCount >= 3) {
                                        console.log('  ✅ GolfWRX Cloudflare验证已通过');
                                        break;
                                    }
                                    
                                    console.log(`  ⏳ 等待Cloudflare验证... (${cloudflareWaitTime/1000}秒)`);
                                }
                                
                                // 额外等待确保页面稳定
                                await page.waitForTimeout(5000);
                            }
                        }
                        
                        break; // 成功加载，退出循环
                    } catch (loadError) {
                        pageLoadAttempts++;
                        if (pageLoadAttempts >= maxPageLoadAttempts) {
                            throw loadError; // 所有尝试都失败
                        }
                        console.log(`  ⚠️ 页面加载失败(${loadError.message.substring(0, 50)}...)，重试 ${pageLoadAttempts}/${maxPageLoadAttempts}...`);
                        await page.waitForTimeout(3000); // 等待3秒再重试
                    }
                }
                
                // 检查是否为404或其他错误状态
                if (response && !response.ok()) {
                    const status = response.status();
                    throw new Error(`HTTP ${status}: 文章不存在或已被删除`);
                }
                
                // 处理 MyGolfSpy 弹窗和特殊等待
                if (url.includes('mygolfspy.com')) {
                    console.log('🔄 等待MyGolfSpy页面完全加载...');
                    await page.waitForTimeout(5000); // 给页面更多时间加载
                    
                    const popupSelectors = [
                        'button[aria-label*="close"]', 'button.close', '.close-button',
                        '[class*="close"]', 'text=×', 'text=X'
                    ];
                    for (const selector of popupSelectors) {
                        try {
                            const closeBtn = await page.locator(selector).first();
                            if (await closeBtn.isVisible({ timeout: 500 })) {
                                await closeBtn.click();
                                await page.waitForTimeout(1000);
                                break;
                            }
                        } catch (e) {}
                    }
                }
                
                // 等待文章容器（增加超时时间）
                try {
                    await page.waitForSelector(selectors.article || 'article', { timeout: 15000 });
                } catch (e) {
                    // 如果找不到article标签，尝试等待标题
                    await page.waitForSelector(selectors.title || 'h1', { timeout: 15000 });
                }
                
                // 快速提取
                let data = await page.evaluate(({selectors, pageUrl}) => {
                    const title = document.querySelector(selectors.title)?.innerText || '';
                    
                    // GolfWRX特殊处理
                    const isGolfWRX = pageUrl.includes('golfwrx.com');
                    
                    // 优先查找更精确的内容容器
                    let contentContainer = null;
                    if (isGolfWRX) {
                        // GolfWRX专用选择器，按优先级查找
                        const golfwrxSelectors = [
                            '#mvp-content-body',
                            '.mvp-content-body',
                            '.mvp-post-content',
                            '.td-post-content',
                            '.entry-content',
                            '.single-post-content',
                            '.the-content'
                        ];
                        for (const selector of golfwrxSelectors) {
                            contentContainer = document.querySelector(selector);
                            if (contentContainer) break;
                        }
                    } else {
                        // 其他网站使用原有逻辑
                        const article = document.querySelector(selectors.article);
                        contentContainer = article || document.querySelector('main') || document.body;
                    }
                    
                    if (!contentContainer) return null;
                    
                    const images = [];
                    let content = `# ${title}\n\n`;
                    
                    // 如果是GolfWRX，先移除不需要的元素
                    if (isGolfWRX) {
                        // 移除相关文章、推荐文章等
                        const removeSelectors = [
                            '.yarpp-related',
                            '.wp-block-latest-posts',
                            '.mvp-related-posts',
                            '.related-articles',
                            '.trending-posts',
                            '.recommended-posts',
                            '.also-read',
                            '.read-more-articles',
                            '.mvp-post-add-box',
                            '.mvp-post-soc-wrap',
                            '.wp-block-group',
                            '.inline-related',
                            '.td-related-posts',
                            '.td-post-next-prev',
                            // 添加You may like相关选择器
                            '.you-may-like',
                            '[class*="you-may-like"]',
                            '[id*="you-may-like"]',
                            '.yarpp-thumbnails-horizontal',
                            '.yarpp-related-rss',
                            'iframe',
                            'script',
                            'style',
                            'noscript'
                        ];
                        
                        // 先通过文本查找并移除包含"You may like"的区块
                        const allHeaders = contentContainer.querySelectorAll('h2, h3, h4');
                        allHeaders.forEach(header => {
                            if (header.textContent.toLowerCase().includes('you may like')) {
                                // 找到该标题后的所有兄弟元素直到下一个标题
                                let sibling = header.nextElementSibling;
                                header.remove(); // 移除标题本身
                                
                                while (sibling && !['H1', 'H2', 'H3', 'H4'].includes(sibling.tagName)) {
                                    const nextSibling = sibling.nextElementSibling;
                                    sibling.remove();
                                    sibling = nextSibling;
                                }
                            }
                        });
                        
                        removeSelectors.forEach(selector => {
                            contentContainer.querySelectorAll(selector).forEach(el => el.remove());
                        });
                    }
                    
                    // 获取所有内容元素（段落、标题、图片等）
                    // GolfWRX需要更严格的选择器，避免获取推荐文章的内容
                    let allElements;
                    if (isGolfWRX) {
                        // GolfWRX特殊处理：只获取文章主体内容
                        // 先尝试获取更精确的内容区域
                        const articleBody = contentContainer.querySelector('.td-ss-main-content, .mvp-main-body-wrap');
                        const targetContainer = articleBody || contentContainer;
                        
                        // 只获取主要内容的段落和标题
                        allElements = targetContainer.querySelectorAll('p, h2, h3, img, figure');
                        
                        // 过滤掉包含在相关文章容器中的元素
                        allElements = Array.from(allElements).filter(el => {
                            // 检查是否在相关文章容器内
                            const inRelated = el.closest('.yarpp-related') || 
                                           el.closest('.yarpp-thumbnails-horizontal') ||
                                           el.closest('.related-posts') ||
                                           el.closest('[class*="related"]') ||
                                           el.closest('.wp-block-group') ||
                                           el.closest('.td-post-sharing') ||
                                           el.closest('.td-post-source-tags');
                            
                            // 检查是否在评论之后
                            const commentsElement = document.querySelector('.comments-area, #comments');
                            const afterComments = el.closest('.comments-area') || 
                                               el.closest('#comments') ||
                                               (commentsElement && el.compareDocumentPosition(commentsElement) === Node.DOCUMENT_POSITION_PRECEDING);
                            
                            return !inRelated && !afterComments;
                        });
                    } else {
                        allElements = contentContainer.querySelectorAll('p, h2, h3, img, figure');
                    }
                    let imageCounter = 0;
                    
                    allElements.forEach(element => {
                        // 额外的GolfWRX过滤检查
                        if (isGolfWRX && element.closest('.wp-block-group')) {
                            return; // 跳过wp-block-group中的内容
                        }
                        
                        if (element.tagName === 'P') {
                            let text = '';
                            
                            // GolfWRX特殊处理：移除所有超链接
                            if (isGolfWRX) {
                                const clonedElement = element.cloneNode(true);
                                // 移除所有链接标签，保留文本
                                clonedElement.querySelectorAll('a').forEach(a => {
                                    const textNode = document.createTextNode(a.textContent);
                                    a.parentNode.replaceChild(textNode, a);
                                });
                                text = clonedElement.textContent.trim();
                            } else {
                                text = element.innerText.trim();
                            }
                            
                            if (text.length > 20) {
                                content += `${text}\n\n`;
                            }
                        }
                        else if (element.tagName === 'H2') {
                            const text = element.innerText.trim();
                            if (text) content += `\n## ${text}\n\n`;
                        }
                        else if (element.tagName === 'H3') {
                            const text = element.innerText.trim();
                            if (text) content += `\n### ${text}\n\n`;
                        }
                        else if (element.tagName === 'IMG' || element.tagName === 'FIGURE') {
                            // 处理图片
                            const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
                            
                            // GolfWRX特殊图片过滤条件
                            let isValidImage = false;
                            
                            if (img && img.src) {
                                if (isGolfWRX) {
                                    // GolfWRX特定过滤：更智能的图片选择
                                    isValidImage = (
                                        // 基本排除规则
                                        !img.src.includes('avatar') &&
                                        !img.src.includes('logo') &&
                                        !img.src.includes('banner') &&
                                        !img.src.includes('-150x') && // 排除小缩略图
                                        !img.src.includes('x150') && // 排除小缩略图
                                        !img.classList.contains('avatar') &&
                                        !img.classList.contains('yarpp-thumbnail') && // 排除YARPP插件的缩略图
                                        !img.closest('.yarpp-related') && // 排除相关文章区域的图片
                                        !img.closest('.yarpp-thumbnails-horizontal') && // 排除横向缩略图
                                        !img.closest('.related-posts') && // 排除相关文章
                                        !img.closest('.mvp-related-posts') && // 排除MVP主题相关文章
                                        !img.closest('.td-post-sharing') && // 排除分享区域
                                        !img.closest('.mvp-post-soc-wrap') && // 排除社交分享
                                        (img.width > 200 || !img.width) // 降低尺寸要求到200px
                                    );
                                    
                                    // GolfWRX图片选择策略：优先选择特定位置的图片
                                    if (isValidImage) {
                                        // 检查是否为特征图片
                                        const isFeaturedImage = img.closest('.td-post-featured-image, .mvp-post-feat-img, .featured-image');
                                        // 检查是否有合适的尺寸（宽度大于800的通常是主图）
                                        const isLargeImage = img.width > 800 || (img.src && img.src.includes('1920') || img.src.includes('1024'));
                                        
                                        // 对于GolfWRX，不再限制图片数量
                                        // 但仍然保持质量筛选
                                        isValidImage = true;
                                    }
                                } else {
                                    // 其他网站的通用过滤
                                    isValidImage = (
                                        !img.closest('a') && 
                                        !img.classList.contains('thumbnail') &&
                                        !img.classList.contains('thumb') &&
                                        img.width > 200
                                    );
                                }
                            }
                            
                            if (isValidImage) {
                                
                                // 检查是否与上一张图片重复（URL相同且紧邻）
                                const lastImage = images[images.length - 1];
                                const isDuplicateAdjacent = lastImage && 
                                                           lastImage.url === img.src &&
                                                           content.trim().endsWith(`[IMAGE_${imageCounter}:${lastImage.alt}]`);
                                
                                if (!isDuplicateAdjacent) {
                                    imageCounter++;
                                    const alt = img.alt || element.querySelector('figcaption')?.innerText || `图片${imageCounter}`;
                                    images.push({ url: img.src, alt: alt });
                                    // 在原位置插入图片占位符
                                    content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                                }
                            }
                        }
                    });
                    
                    return { title, content, images };
                }, {selectors, pageUrl: url});
                
                // 对于特定网站，优先使用网站特定抓取
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace('www.', '');
                
                // 检查网站是否配置了特殊图片处理
                const useSpecialHandler = siteConfig && siteConfig.useSpecialImageHandler;
                
                // 对于配置了特殊图片处理的网站，优先使用专用抓取器
                if (useSpecialHandler) {
                    console.log(`🔧 使用${siteConfig.name}专用抓取器（useSpecialImageHandler=true）...`);
                    try {
                        const specificContent = await this.siteSpecificScrapers.scrapeArticleContent(page, domain);
                        if (specificContent) {
                            console.log(`✅ ${siteConfig.name}专用抓取成功`);
                            data = specificContent;
                        }
                    } catch (error) {
                        console.error(`❌ ${siteConfig.name}专用抓取失败:`, error.message);
                        // 如果专用抓取失败，仍然使用通用抓取的结果
                    }
                }
                // 如果通用抓取失败，尝试网站特定抓取
                else if (!data || !data.title || !data.content || data.content.length < 100) {
                    console.log('⚠️  通用抓取失败，尝试网站特定抓取...');
                    
                    try {
                        const specificContent = await this.siteSpecificScrapers.scrapeArticleContent(page, domain);
                        
                        if (specificContent) {
                            console.log('✅ 网站特定抓取成功');
                            data = specificContent;
                        }
                    } catch (error) {
                        console.error('❌ 网站特定抓取失败:', error.message);
                    }
                }
                
                // 确保data存在
                if (!data) {
                    throw new Error('文章内容抓取失败');
                }
                
                // 确保data有images属性
                if (!data.images) {
                    data.images = [];
                }
                
                // 检测是否为只有视频的文章（增强检测）
                if (url.includes('golfwrx.com')) {
                    // 先检查是否为视频类URL
                    const isVideoUrl = url.includes('/video/') || 
                                      url.includes('/watch/') || 
                                      url.includes('youtube') ||
                                      url.includes('vimeo');
                    
                    // 检查标题是否包含视频相关关键词
                    const videoKeywords = [
                        'watch:', 'video:', 'film:', 'footage:', 'clip:', 'watch ', 'video ', '[video]',
                        'bks breakdowns', "bk's breakdowns", 'breakdown:', // BK's Breakdowns系列
                        'scenes from', 'highlights:', 'highlights from', // 现场视频
                        'footage from', 'inside the ropes', // 幕后视频
                        'witb league night', 'league night week', // WITB联赛夜视频系列
                        'tour truck', 'gear truck', // 装备车视频
                        'range session', 'practice round', // 练习视频
                        'swing analysis', 'slow motion', 'slo-mo' // 挥杆分析视频
                    ];
                    const hasVideoTitle = videoKeywords.some(keyword => 
                        data.title.toLowerCase().includes(keyword)
                    );
                    
                    // 清理内容中的标题和图片占位符，只保留文本
                    const cleanContent = data.content
                        .replace(/^#.*$/gm, '')  // 移除标题
                        .replace(/\[IMAGE_\d+:.*?\]/g, '')  // 移除图片占位符
                        .replace(/\n{3,}/g, '\n\n')  // 压缩多余空行
                        .trim();
                    
                    // 检查是否有视频嵌入代码
                    const hasVideoEmbed = data.content.includes('iframe') || 
                                         data.content.includes('youtube') || 
                                         data.content.includes('vimeo') ||
                                         data.content.includes('[video]') ||
                                         data.content.includes('player');
                    
                    // 检查内容是否太短（只有视频没有文字的文章）
                    const contentTooShort = cleanContent.length < 200;
                    
                    // 综合判断是否为纯视频文章（没有足够文字内容的）
                    const videoSignals = [isVideoUrl, hasVideoTitle, hasVideoEmbed].filter(Boolean).length;
                    
                    // 只有当内容真的很少时才认为是纯视频文章
                    const isVideoArticle = 
                        // 如果有视频嵌入且内容极少（少于100字符）
                        (hasVideoEmbed && cleanContent.length < 100) ||
                        // 如果有多个视频信号且内容很少（少于200字符）
                        (videoSignals >= 2 && contentTooShort) ||
                        // 如果URL明确是视频页面且没有文字内容
                        (isVideoUrl && cleanContent.length < 150);
                    
                    if (isVideoArticle) {
                        console.log('  ⚠️  检测到纯视频文章（内容过少），跳过处理');
                        console.log(`     - URL类型: ${isVideoUrl ? '视频URL' : '普通URL'}`);
                        console.log(`     - 标题包含视频关键词: ${hasVideoTitle ? '是' : '否'}`);
                        console.log(`     - 内容包含视频嵌入: ${hasVideoEmbed ? '是' : '否'}`);
                        console.log(`     - 文本内容长度: ${cleanContent.length} 字符`);
                        console.log(`     - 判定原因: 内容过少，不适合文字改写`);
                        await page.close();
                        
                        return {
                            url,
                            articleNum,
                            success: false,
                            error: '文章内容为视频，不适合文字改写'
                        };
                    }
                }
                
                // 使用封装的图片处理器下载图片
                // 🔧 修复：直接使用最终编号，避免覆盖
                // 传递文章URL以便为不同网站使用特定的处理器
                const currentDate = new Date().toISOString().split('T')[0];
                
                // 只有当有图片时才处理图片
                if (data.images && data.images.length > 0) {
                    // 在下载图片之前，先去除重复的图片
                    const uniqueImages = [];
                    const seenUrls = new Set();
                    const urlToFirstIndex = new Map(); // 记录URL第一次出现的索引
                    
                    data.images.forEach((img, idx) => {
                        if (!seenUrls.has(img.url)) {
                            seenUrls.add(img.url);
                            uniqueImages.push(img);
                            urlToFirstIndex.set(img.url, idx + 1); // 记录原始索引（从1开始）
                        } else {
                            // 记录重复图片的映射关系
                            const firstIndex = urlToFirstIndex.get(img.url);
                            console.log(`    ⏭️ 发现重复图片 [IMAGE_${idx + 1}]，将映射到 [IMAGE_${firstIndex}]`);
                            
                            // 在内容中替换重复的图片占位符
                            const duplicateRegex = new RegExp(`\\[IMAGE_${idx + 1}:[^\\]]+\\]`, 'g');
                            const firstImageRegex = new RegExp(`\\[IMAGE_${firstIndex}:([^\\]]+)\\]`);
                            const firstImageMatch = data.content.match(firstImageRegex);
                            
                            if (firstImageMatch) {
                                // 用第一次出现的图片占位符替换重复的
                                data.content = data.content.replace(duplicateRegex, firstImageMatch[0]);
                            } else {
                                // 如果找不到第一次的占位符，直接删除重复的
                                data.content = data.content.replace(duplicateRegex, '');
                            }
                        }
                    });
                    
                    // 重新编号图片占位符，确保连续
                    let imageCounter = 1;
                    const indexMapping = new Map(); // 记录旧索引到新索引的映射
                    
                    uniqueImages.forEach((img, idx) => {
                        // 使用图片对象中已有的index属性，如果没有则计算
                        const oldIndex = img.index || (data.images.indexOf(img) + 1);
                        indexMapping.set(oldIndex, imageCounter);
                        img.index = imageCounter;
                        imageCounter++;
                    });
                    
                    // 根据映射关系替换所有占位符
                    indexMapping.forEach((newIndex, oldIndex) => {
                        const oldRegex = new RegExp(`\\[IMAGE_${oldIndex}:([^\\]]+)\\]`, 'g');
                        data.content = data.content.replace(oldRegex, (match, alt) => {
                            return `[IMAGE_${newIndex}:${alt}]`;
                        });
                    });
                    
                    console.log(`  🔄 图片去重: ${data.images.length} -> ${uniqueImages.length} 张`);
                    
                    // 只有在确实有重复时才更新images数组
                    if (uniqueImages.length < data.images.length) {
                        data.images = uniqueImages;
                    } else {
                        // 如果没有重复，保持原有的索引不变
                        console.log(`  ✅ 无重复图片，保持原有索引`);
                    }
                    
                    // 下载去重后的图片
                    data.images = await this.imageProcessor.downloadImages(this.browser, data.images, articleNum, currentDate, url);
                }
                
                console.log(`  ✅ 文章${articleNum} 抓取完成 (${data.images.length}张图片)`);
                
                const article = {
                    ...data,
                    url,
                    articleNum,  // 最终编号
                    images: data.images,
                    sourceSite: this.getDomainFromUrl(url)  // 添加来源网站
                };
                
                await page.close();
                
                console.log(`\n  📝 开始改写文章...`);
                console.log(`     标题: ${article.title.substring(0, 50)}...`);
                
                // 直接在这里进行Claude改写
                try {
                    const articleStart = Date.now();
                    
                    // 根据内容大小和网站动态设置超时时间
                    const contentSize = (article.content?.length || 0) / 1024; // KB
                    let rewriteTimeout = 180000; // 默认180秒
                    
                    // 特殊网站的超时设置
                    const domain = new URL(url).hostname.replace('www.', '');
                    
                    // 使用配置文件中的超时设置
                    const timeoutConfig = stabilityConfig.claude?.timeout || {};
                    const baseTimeout = timeoutConfig.base?.[domain] || timeoutConfig.base?.default || 180000;
                    const perKBTimeout = timeoutConfig.perKB?.[domain] || timeoutConfig.perKB?.default || 12000;
                    const maxTimeout = timeoutConfig.max?.[domain] || timeoutConfig.max?.default || 360000;
                    
                    if (domain === 'golfmonthly.com' && contentSize > 15) {
                        rewriteTimeout = Math.min(maxTimeout, contentSize * perKBTimeout);
                    } else if (domain === 'mygolfspy.com') {
                        // MyGolfSpy文章需要更长时间
                        rewriteTimeout = Math.max(baseTimeout, baseTimeout + (contentSize * perKBTimeout));
                        rewriteTimeout = Math.min(maxTimeout, rewriteTimeout);
                        console.log(`🔬 MyGolfSpy动态超时设置：${(rewriteTimeout/1000).toFixed(0)}秒（内容大小: ${contentSize.toFixed(1)}KB）`);
                    } else if (domain === 'golf.com') {
                        // Golf.com 需要更长的超时时间
                        rewriteTimeout = Math.max(baseTimeout, baseTimeout + (contentSize * perKBTimeout));
                        rewriteTimeout = Math.min(maxTimeout, rewriteTimeout);
                        console.log(`⛳ Golf.com动态超时设置：${(rewriteTimeout/1000).toFixed(0)}秒`);
                    } else if (domain === 'golfwrx.com') {
                        // GolfWRX 可能需要处理Cloudflare，给予额外时间
                        rewriteTimeout = Math.max(baseTimeout, baseTimeout + (contentSize * perKBTimeout * 1.2));
                        rewriteTimeout = Math.min(maxTimeout, rewriteTimeout);
                        console.log(`🎯 GolfWRX动态超时设置：${(rewriteTimeout/1000).toFixed(0)}秒`);
                    } else if (domain === 'golfdigest.com') {
                        // Golf Digest 响应较慢，需要更长时间
                        rewriteTimeout = Math.max(baseTimeout, baseTimeout + (contentSize * perKBTimeout));
                        rewriteTimeout = Math.min(maxTimeout, rewriteTimeout);
                        console.log(`📰 Golf Digest动态超时设置：${(rewriteTimeout/1000).toFixed(0)}秒（内容大小: ${contentSize.toFixed(1)}KB）`);
                    } else {
                        // 其他网站根据内容大小调整
                        rewriteTimeout = Math.max(baseTimeout, Math.min(maxTimeout, contentSize * perKBTimeout));
                    }
                    
                    // 检查整体运行时间，动态调整超时
                    const totalRunTime = Date.now() - this.processingStartTime;
                    if (totalRunTime > 600000) { // 已运行超过10分钟
                        const timeoutIncrease = 1.2; // 增加20%
                        rewriteTimeout = Math.min(maxTimeout * 1.5, rewriteTimeout * timeoutIncrease);
                        console.log(`     ⏰ 已运行${Math.round(totalRunTime/60000)}分钟，延长超时至${(rewriteTimeout/1000).toFixed(0)}秒`);
                    }
                    
                    // 🔧 预处理实时赛事报道内容
                    let processedContent = article.content;
                    let processedTitle = article.title;
                    
                    // 检测是否为装备类文章（装备评测不是实时报道）
                    const isEquipmentReview = equipmentKeywords.some(keyword => {
                        const regex = new RegExp(keyword, 'i');
                        return regex.test(url) || regex.test(processedTitle);
                    });
                    
                    // 检测是否为实时赛事报道（排除装备类文章）
                    const isLiveReport = !isEquipmentReview && (
                        processedTitle.toLowerCase().includes('live') || 
                        processedTitle.toLowerCase().includes('leaderboard') ||
                        processedContent.includes('pic.twitter.com') ||
                        (processedContent.match(/\d{1,2}-under/g) || []).length > 5
                    );
                    
                    if (isLiveReport) {
                        console.log(`  ⚠️ 检测到实时赛事报道...`);
                        
                        // 检查内容长度
                        const contentLength = processedContent.length;
                        const lineCount = processedContent.split('\n').length;
                        console.log(`  📏 内容长度: ${contentLength} 字符, ${lineCount} 行`);
                        
                        // 如果内容过长（超过8000字符或100行），跳过处理
                        if (contentLength > 8000 || lineCount > 100) {
                            console.log(`  ⏭️  内容过长，跳过此赛事报道`);
                            console.log(`  💡 提示：此类长篇实时报道建议手动处理`);
                            console.log(`\n✅ 第 ${i + 1}/${urls.length} 篇文章处理完成（跳过）\n`);
                            
                            // 更新状态为内容过长
                            const urlMapFile = path.join(this.baseDir, 'article_urls.json');
                            if (fs.existsSync(urlMapFile)) {
                                try {
                                    const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                                    if (urlMapping[articleNum]) {
                                        if (typeof urlMapping[articleNum] === 'object') {
                                            urlMapping[articleNum].status = 'skipped';
                                            urlMapping[articleNum].reason = '内容过长';
                                            urlMapping[articleNum].skippedAt = new Date().toISOString();
                                        }
                                        fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                                    }
                                } catch (e) {}
                            }
                            
                            // 记录为失败，但标记原因
                            this.apiFailureHandler.logFailedArticle(article.url, '实时赛事报道内容过长，已跳过');
                            article.rewrittenContent = null;
                            articles.push(article);
                            continue; // 跳到下一篇文章
                        }
                    }
                    
                    // 使用增强版改写器处理（已包含动态超时）
                    article.rewrittenContent = await this.rewriter.rewriteArticle(
                        article.title,
                        processedContent,
                        article.url  // 传递URL给改写器
                    );
                    
                    console.log(`  ✅ 初始改写完成 (${Date.now() - articleStart}ms)`);
                    
                    // 执行AI检测和可能的重写
                    const aiResult = await this.processArticleWithAIDetection(article, processedContent);
                    article.rewrittenContent = aiResult.content;
                    article.aiProbability = aiResult.aiProbability;
                    article.rewriteCount = aiResult.rewriteCount;
                    
                    // 立即保存成功的文章
                    try {
                        await this.saveSingleArticle(article);
                        console.log(`  💾 文章已保存到网页`);
                        if (article.aiProbability !== null) {
                            console.log(`  🤖 最终AI检测率: ${article.aiProbability}%`);
                            if (article.rewriteCount > 0) {
                                console.log(`  📝 共重写${article.rewriteCount}次`);
                            }
                        }
                        console.log(`\n✅ 第 ${i + 1}/${urls.length} 篇文章处理完成\n`);
                    } catch (saveError) {
                        console.error(`  ❌ 保存文章时出错:`, saveError.message);
                        article.rewrittenContent = null; // 标记为失败
                        this.apiFailureHandler.logFailedArticle(article.url, `保存失败: ${saveError.message}`);
                        console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章保存失败（已跳过）\n`);
                    }
                    
                } catch (error) {
                    console.error(`  ❌ 改写失败:`, error.message);
                    article.rewrittenContent = null;
                    
                    // 记录失败的文章
                    this.apiFailureHandler.logFailedArticle(article.url, `Claude改写失败: ${error.message}`);
                    
                    console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章处理失败（已跳过）\n`);
                    
                    // 根据错误类型智能等待
                    let waitTime = 5000; // 默认5秒
                    if (error.message.includes('超时')) {
                        waitTime = 10000; // 超时错误等待10秒
                    } else if (error.message.includes('API') || error.message.includes('rate limit')) {
                        waitTime = 30000; // API限制等待30秒
                    }
                    
                    console.log(`  ⏳ 等待${waitTime/1000}秒后继续...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                articles.push(article);
                
                // 成功处理后的智能等待（避免API过载）
                if (article.rewrittenContent && i < urls.length - 1) {
                    const successWaitTime = 3000; // 成功后等待3秒
                    console.log(`  ⏳ 等待${successWaitTime/1000}秒后继续下一篇...`);
                    await new Promise(resolve => setTimeout(resolve, successWaitTime));
                }
                
            } catch (error) {
                console.error(`\n❌ 文章抓取失败:`, error.message);
                
                // 确保页面关闭
                try {
                    await page.close();
                } catch (e) {
                    // 忽略关闭错误
                }
                
                // 记录失败的文章
                const failedArticle = {
                    url,
                    articleNum,
                    title: '抓取失败',
                    content: '',
                    images: [],
                    rewrittenContent: null
                };
                
                // 更新失败状态到article_urls.json
                const urlMapFile = path.join(this.baseDir, 'article_urls.json');
                if (fs.existsSync(urlMapFile)) {
                    try {
                        const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                        if (urlMapping[articleNum]) {
                            if (typeof urlMapping[articleNum] === 'object') {
                                urlMapping[articleNum].status = 'failed';
                                urlMapping[articleNum].error = error.message;
                                urlMapping[articleNum].failedAt = new Date().toISOString();
                            } else {
                                // 转换旧格式
                                urlMapping[articleNum] = {
                                    url: url,
                                    status: 'failed',
                                    error: error.message,
                                    failedAt: new Date().toISOString()
                                };
                            }
                            fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                            console.log(`❌ 已记录失败状态到 article_urls.json`);
                        }
                    } catch (e) {
                        console.error('更新失败状态失败:', e.message);
                    }
                }
                
                this.apiFailureHandler.logFailedArticle(url, `文章抓取失败: ${error.message}`);
                articles.push(failedArticle);
                
                console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章处理失败（已跳过）\n`);
                continue;
            }
        }
        
        console.log(`\n═══════════════════════════════════════════════════`);
        console.log(`✅ 所有文章处理完成！`);
        console.log(`📊 总耗时: ${Date.now() - extractStart}ms`);
        console.log(`📊 成功处理: ${articles.filter(a => a.rewrittenContent).length}/${urls.length} 篇`);
        console.log(`═══════════════════════════════════════════════════\n`);
        
        // 5. 处理完成总结（文章已在处理时实时保存）
        console.log('5️⃣ 处理完成！');
        
        // 过滤掉改写失败的文章
        const successArticles = articles.filter(a => a.rewrittenContent !== null);
        if (successArticles.length < articles.length) {
            console.log(`⚠️ ${articles.length - successArticles.length} 篇文章改写失败，已跳过`);
        }
        
        const totalTime = Date.now() - extractStart;
        console.log('='.repeat(50));
        console.log('✨ 批量处理完成！');
        console.log(`📊 处理统计:`);
        console.log(`   - 输入文章数: ${newUrls.length + duplicateUrls.length}`);
        console.log(`   - 跳过重复: ${duplicateUrls.length}`);
        console.log(`   - 实际处理: ${newUrls.length}`);
        console.log(`   - 成功完成: ${successArticles.length}`);
        console.log(`⏱️ 总耗时: ${Math.round(totalTime / 1000)}秒`);
        console.log(`📈 平均每篇: ${Math.round(totalTime / articles.length / 1000)}秒`);
        console.log('\n📱 访问 http://localhost:8080 查看内容');
        
        } catch (error) {
            console.error('\n❌ 处理过程中出现严重错误:', error);
            throw error;
        } finally {
            // 确保浏览器关闭
            if (this.browser) {
                try {
                    await this.browser.close();
                    console.log('\n🎬 浏览器已关闭');
                } catch (e) {
                    console.error('❌ 关闭浏览器时出错:', e.message);
                }
            }
            
            // 确保AI检测器关闭
            if (this.aiDetector) {
                try {
                    await this.aiDetector.close();
                    console.log('🔚 AI检测器已关闭');
                } catch (e) {
                    console.error('❌ 关闭AI检测器时出错:', e.message);
                }
            }
        }
    }

    // 保存单篇文章（实时更新）
    async saveSingleArticle(article) {
        try {
            if (!article.rewrittenContent) {
                return; // 跳过失败的文章
            }

            const num = article.articleNum;
            let content = article.rewrittenContent;
            
            // 使用封装的图片处理器替换占位符
            content = this.imageProcessor.replaceImagePlaceholders(content, article.images);
            
            // 移除元数据头部，直接使用文章内容
            // 注释掉以下代码，让文章直接以标题开始
            /*
            if (!content.startsWith('---')) {
                const metadata = [
                    '---',
                    `title: "${article.title || '高尔夫文章'}"`,
                    `source_url: "${article.url}"`,
                    `source_site: "${article.sourceSite || this.getDomainFromUrl(article.url)}"`,
                    `created_time: "${new Date().toISOString()}"`,
                    '---',
                    ''
                ].join('\n');
                content = metadata + content;
            }
            */
            
            // 添加底部并修复原文链接
            // 检查并修复错误的原文链接 - 扩展更多可能的错误格式
            const urlPattern = /\[查看原文\]\((原文URL未提供|原文URL链接|原文URL|原文链接未提供|原文链接|undefined|null|无原文链接)\)/gi;
            const hasInvalidUrl = urlPattern.test(content);
            
            if (hasInvalidUrl) {
                // 替换错误的URL
                content = content.replace(urlPattern, `[查看原文](${article.url})`);
                console.log(`  🔧 修复了错误的原文链接格式`);
            } else if (!content.includes('查看原文')) {
                // 如果没有原文链接，添加
                content += `\n\n---\n\n[查看原文](${article.url})`;
            }
            
            // 再次验证URL是否有效 - 扩展检查条件
            const invalidUrls = ['undefined', '原文URL未提供', '原文URL', '原文链接未提供', '原文链接', 'null', '无原文链接'];
            if (!article.url || invalidUrls.includes(article.url)) {
                console.log(`  ⚠️ 检测到无效的URL: ${article.url}`);
                // 从URL映射中获取正确的URL
                const urlMapFile = path.join(this.baseDir, 'article_urls.json');
                if (fs.existsSync(urlMapFile)) {
                    try {
                        const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                        if (urlMapping[num] && urlMapping[num].url) {
                            const correctUrl = urlMapping[num].url;
                            // 使用更宽泛的正则表达式替换任何格式的查看原文链接
                            content = content.replace(/\[查看原文\]\([^)]*\)/gi, `[查看原文](${correctUrl})`);
                            article.url = correctUrl; // 同时更新article对象的URL
                            console.log(`  ✅ 从URL映射中恢复了文章${num}的URL: ${correctUrl}`);
                        } else {
                            console.error(`  ❌ URL映射中也没有文章${num}的URL`);
                        }
                    } catch (e) {
                        console.error(`  ❌ 读取URL映射失败:`, e.message);
                    }
                }
            }
            
            // 确保目录存在
            this.ensureDirectories();
            
            // 保存文件
            const mdFile = path.join(this.baseDir, 'wechat_ready', `wechat_article_${num}.md`);
            const htmlFile = path.join(this.baseDir, 'wechat_html', `wechat_article_${num}.html`);
            
            console.log(`  📁 保存路径:`);
            console.log(`     - MD文件: ${mdFile}`);
            console.log(`     - HTML文件: ${htmlFile}`);
            console.log(`     - 基础目录: ${this.baseDir}`);
            
            // 如果有AI检测结果，在文件开头添加注释
            if (article.aiProbability !== null && article.aiProbability !== undefined) {
                const aiComment = `<!-- AI检测: ${article.aiProbability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
                content = aiComment + content;
                console.log(`  🤖 AI检测结果已添加到内容: ${article.aiProbability}%`);
            }
            
            try {
                fs.writeFileSync(mdFile, content, 'utf8');
                console.log(`  ✅ MD文件保存成功: wechat_article_${num}.md`);
            } catch (err) {
                console.error(`  ❌ MD文件保存失败:`, err.message);
                throw err;
            }
            
            try {
                const htmlContent = this.generateHTML(article.title, content, article);
                fs.writeFileSync(htmlFile, htmlContent, 'utf8');
                console.log(`  ✅ HTML文件保存成功: wechat_article_${num}.html`);
            } catch (err) {
                console.error(`  ❌ HTML文件保存失败:`, err.message);
                throw err;
            }
            
            // 更新URL映射
            const urlMapFile = path.join(this.baseDir, 'article_urls.json');
            let urlMapping = {};
            
            // 先读取现有的映射
            if (fs.existsSync(urlMapFile)) {
                try {
                    urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                } catch (err) {
                    console.log(`  ⚠️ 读取URL映射文件失败，创建新的映射`);
                }
            }
            
            // 更新状态为完成（保持一致的数据结构）
            if (typeof urlMapping[num] === 'object') {
                urlMapping[num].status = 'completed';
                urlMapping[num].completedAt = new Date().toISOString();
            } else {
                // 兼容旧格式
                urlMapping[num] = {
                    url: article.url,
                    status: 'completed',
                    completedAt: new Date().toISOString()
                };
            }
            fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2), 'utf8');
            
            // 标记成功的文章
            this.apiFailureHandler.markAsSuccess(article.url);
            
            // 保存AI检测结果（如果有）
            if (article.aiProbability !== null && article.aiProbability !== undefined) {
                const detectionFile = mdFile.replace('.md', '_ai_detection.json');
                const detectionData = {
                    ai_detection: `${article.aiProbability}%`,
                    detection_time: new Date().toISOString().replace('T', ' ').split('.')[0],
                    source_url: article.url,
                    source_site: article.sourceSite || this.getDomainFromUrl(article.url),
                    article_file: path.basename(mdFile),
                    rewrite_count: article.rewriteCount || 0,
                    detection_mode: 'bitbrowser'
                };
                try {
                    fs.writeFileSync(detectionFile, JSON.stringify(detectionData, null, 2), 'utf8');
                    console.log(`  📊 AI检测结果已保存: ${article.aiProbability}%`);
                } catch (err) {
                    console.log(`  ⚠️ 保存AI检测结果失败: ${err.message}`);
                }
            }
            
            return true;
            
        } catch (error) {
            console.error(`  ❌ 保存文章失败:`, error);
            console.error(`  📁 基础目录: ${this.baseDir}`);
            console.error(`  📁 当前工作目录: ${process.cwd()}`);
            throw error; // 重新抛出错误，让上层知道保存失败
        }
    }

    generateHTML(title, content, article = {}) {
        // 确保有正确的原文链接
        const sourceUrl = article.url || '';
        const sourceSite = article.sourceSite || this.getDomainFromUrl(sourceUrl);
        
        // 修复内容中的原文链接占位符
        if (sourceUrl) {
            // 处理多种可能的占位符格式
            content = content.replace(/\[查看原文\]\(原文URL链接\)/g, `[查看原文](${sourceUrl})`);
            content = content.replace(/\[查看原文\]\(原文URL\)/g, `[查看原文](${sourceUrl})`);
            content = content.replace(/\[查看原文\]\(原文链接\)/g, `[查看原文](${sourceUrl})`);
            content = content.replace(/\[查看原文\]\(无原文链接\)/g, `[查看原文](${sourceUrl})`);
        }
        
        // 处理图片，必须先处理图片再处理链接
        let imageCounter = 1;
        let htmlContent = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            // 修改图片路径为相对于HTML文件的路径
            const relativeSrc = src.replace('../images/', '../images/');
            return `<div class="image-container">
                        <img src="${relativeSrc}" alt="${caption}" class="article-image" onclick="copyImage(this)">
                    </div>`;
        });
        
        // 处理其他Markdown语法
        htmlContent = htmlContent
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');  // 处理链接
        
        // 🔧 重新设计段落处理逻辑，避免把标题和图片容器包在<p>标签里
        // 先按双换行分段
        const segments = htmlContent.split(/\n\n+/);
        const processedSegments = segments.map(segment => {
            segment = segment.trim();
            if (!segment) return '';
            
            // 如果是标题或图片容器，直接返回
            if (segment.match(/^<h[1-6]>/) || 
                segment.match(/^<div class="image-container">/) ||
                segment.match(/^<\/div>$/)) {
                return segment;
            }
            
            // 如果段落中包含HTML标签（比如图片容器），按行分割处理
            if (segment.includes('<div class="image-container">')) {
                const lines = segment.split('\n');
                let result = [];
                let currentParagraph = [];
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.match(/^<div class="image-container">/) || 
                        trimmedLine.match(/^<\/div>$/) ||
                        trimmedLine.match(/^\s*<img/)) {
                        // 如果当前有段落内容，先输出
                        if (currentParagraph.length > 0) {
                            result.push('<p>' + currentParagraph.join(' ').trim() + '</p>');
                            currentParagraph = [];
                        }
                        // 直接添加图片相关标签
                        result.push(trimmedLine);
                    } else if (trimmedLine) {
                        currentParagraph.push(trimmedLine);
                    }
                }
                
                // 处理剩余的段落内容
                if (currentParagraph.length > 0) {
                    result.push('<p>' + currentParagraph.join(' ').trim() + '</p>');
                }
                
                return result.join('\n');
            }
            
            // 普通文本段落，包装在<p>标签中
            return '<p>' + segment + '</p>';
        });
        
        htmlContent = processedSegments.filter(s => s).join('\n\n');
        
        // 添加原文链接和来源信息到HTML末尾
        if (sourceUrl) {
            // 从内容中提取作者信息（如果有）
            let author = '';
            const authorMatch = content.match(/作者：(.+?)(?:\n|$)/);
            if (authorMatch) {
                author = authorMatch[1].trim();
            }
            
            // 构建底部信息HTML
            const sourceInfo = `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #f0f0f0; font-size: 14px; color: #666;">
                <p><a href="${sourceUrl}" target="_blank" style="color: #1976d2; text-decoration: none;">查看原文</a>${author ? ' | 作者：' + author : ''}</p>
            </div>`;
            
            htmlContent += sourceInfo;
        }
        
        // 使用增强版HTML模板
        return generateEnhancedHTML(title, htmlContent);
    }
    
    /**
     * 处理URL数组（供Chrome扩展处理器使用）
     * @param {Array} urls - URL数组
     * @returns {Promise<Object>} 处理结果
     */
    async processURLs(urls) {
        console.log(`🔄 Chrome扩展处理器: 开始处理 ${urls.length} 个URL`);
        
        const validUrls = urls.filter(url => {
            if (typeof url !== 'string' || !url.trim()) return false;
            try {
                new URL(url);
                return true;
            } catch (e) {
                console.warn(`⚠️  跳过无效URL: ${url}`);
                return false;
            }
        });
        
        if (validUrls.length === 0) {
            console.error('❌ 没有有效的URL可处理');
            return { success: false, processed: 0, failed: 0 };
        }
        
        console.log(`📋 有效URL数量: ${validUrls.length}`);
        
        try {
            // 使用现有的processArticles方法
            const result = await this.processArticles(validUrls);
            
            return { 
                success: true, 
                processed: validUrls.length, 
                failed: 0,
                details: result
            };
        } catch (error) {
            console.error('❌ 处理URL失败:', error.message);
            return { 
                success: false, 
                processed: 0, 
                failed: validUrls.length,
                error: error.message
            };
        }
    }
    
    /**
     * 从URL提取域名
     * @param {string} url - 完整URL
     * @returns {string} 域名
     */
    getDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');
            
            // 域名到网站名称的映射
            const siteNames = {
                'golf.com': 'Golf.com',
                'golfmonthly.com': 'Golf Monthly',
                'golfdigest.com': 'Golf Digest',
                'mygolfspy.com': 'MyGolfSpy',
                'golfwrx.com': 'GolfWRX',
                'todays-golfer.com': "Today's Golfer",
                'golfweek.usatoday.com': 'Golfweek',
                'nationalclubgolfer.com': 'National Club Golfer',
                'pgatour.com': 'PGA Tour',
                'skysports.com': 'Sky Sports',
                'dpworldtour.com': 'DP World Tour'
            };
            
            return siteNames[hostname] || hostname;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * 处理文章的AI检测和重写
     * @param {Object} article - 文章对象
     * @param {string} processedContent - 处理后的原始内容
     * @param {number} maxRetries - 最大重写次数
     * @returns {Object} 包含最终内容和AI检测结果的对象
     */
    async processArticleWithAIDetection(article, processedContent, maxRetries = 2) {
        let currentContent = article.rewrittenContent;
        let aiProbability = null;
        let rewriteCount = 0;
        
        // 延迟初始化AI检测器
        if (!this.aiDetector) {
            this.aiDetector = new EnhancedAIContentDetector();
            await this.aiDetector.initialize();
            // 设置为混合模式，优先BitBrowser，失败时自动降级到代理
            this.aiDetector.setDetectionMode('proxy');
            console.log('  🌐 已初始化混合模式AI检测器（BitBrowser优先）');
        }
        
        // 执行AI检测和重写循环
        while (rewriteCount <= maxRetries) {
            try {
                // 提取纯文本内容进行AI检测（移除图片占位符等）
                let textContent = currentContent;
                // 移除图片占位符
                textContent = textContent.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
                // 移除Markdown图片（完全移除，修复Bug）
                textContent = textContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
                // 移除Markdown链接但保留文本
                textContent = textContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                // 清理多余的空行
                textContent = textContent.replace(/\n\n\n+/g, '\n\n');
                
                console.log(`  🤖 执行AI检测 (第${rewriteCount + 1}次)...`);
                aiProbability = await this.aiDetector.detectText(textContent);
                
                if (aiProbability === null) {
                    console.log('  ⚠️ AI检测失败，保留当前版本');
                    break;
                }
                
                console.log(`  📊 AI检测结果: ${aiProbability}%`);
                
                // 如果AI率低于或等于40%，或已达到最大重写次数，结束循环
                if (aiProbability <= 40 || rewriteCount >= maxRetries) {
                    if (aiProbability > 40 && rewriteCount >= maxRetries) {
                        console.log(`  ⚠️ 已达最大重写次数(${maxRetries}次)，保留当前版本 (AI率: ${aiProbability}%)`);
                    } else if (aiProbability <= 40) {
                        console.log(`  ✅ AI检测通过，无需重写`);
                    }
                    break;
                }
                
                // AI率大于40%且未达到最大重写次数，进行重写
                console.log(`  🔄 AI率过高(${aiProbability}%)，进行第${rewriteCount + 1}次重写...`);
                
                // 重新改写文章
                const newContent = await this.rewriter.rewriteArticle(
                    article.title,
                    processedContent,
                    article.url
                );
                
                if (newContent) {
                    currentContent = newContent;
                    rewriteCount++;
                    console.log(`  ✅ 第${rewriteCount}次重写完成`);
                    
                    // 等待一下避免API过载
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log(`  ❌ 重写失败，保留当前版本`);
                    break;
                }
                
            } catch (error) {
                console.error(`  ❌ AI检测或重写出错: ${error.message}`);
                break;
            }
        }
        
        return {
            content: currentContent,
            aiProbability: aiProbability,
            rewriteCount: rewriteCount
        };
    }

    /**
     * 执行AI检测（异步，不阻塞主流程）
     * @param {string} filePath - 文件路径
     * @param {string} content - 文章内容
     */
    async performAIDetection(filePath, content) {
        try {
            // 延迟初始化AI检测器
            if (!this.aiDetector) {
                this.aiDetector = new EnhancedAIContentDetector();
                await this.aiDetector.initialize();
                // 设置为混合模式，优先BitBrowser，失败时自动降级到代理
                this.aiDetector.setDetectionMode('proxy');
            }

            // 由于已经移除了元数据，直接使用整个内容作为文章正文
            const articleBody = content;

            // 执行AI检测
            const aiProbability = await this.aiDetector.detectText(articleBody);

            if (aiProbability !== null) {
                // 在MD文件开头添加AI检测注释
                const aiComment = `<!-- AI检测: ${aiProbability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
                
                // 检查文件是否已有AI检测注释
                const existingCommentPattern = /^<!-- AI检测:.*?-->\n/;
                let updatedContent;
                if (existingCommentPattern.test(content)) {
                    // 替换现有的AI检测注释
                    updatedContent = content.replace(existingCommentPattern, aiComment);
                } else {
                    // 在开头添加AI检测注释
                    updatedContent = aiComment + content;
                }
                
                // 更新MD文件
                fs.writeFileSync(filePath, updatedContent, 'utf8');
                
                // 同时保存到JSON文件（保持兼容性）
                const detectionFile = filePath.replace('.md', '_ai_detection.json');
                const detectionData = {
                    ai_detection: `${aiProbability}%`,
                    detection_time: new Date().toISOString().replace('T', ' ').split('.')[0],
                    article_file: path.basename(filePath)
                };
                fs.writeFileSync(detectionFile, JSON.stringify(detectionData, null, 2), 'utf8');
                
                console.log(`  🤖 AI检测完成: ${aiProbability}%`);
            }
        } catch (error) {
            // 静默处理错误，记录日志但不中断流程
            console.error(`  ⚠️ AI检测出错: ${error.message}`);
        }
    }
    
}

// 命令行执行
if (require.main === module) {
    // 从命令行参数获取文件名
    const filename = process.argv[2];
    
    if (!filename) {
        console.error('❌ 请提供文章URL列表文件');
        console.error('用法: node batch_process_articles.js <文件名>');
        process.exit(1);
    }
    
    try {
        // 读取文件内容
        const content = fs.readFileSync(filename, 'utf8');
        const urls = content.split('\n').filter(url => url.trim());
        
        if (urls.length === 0) {
            console.error('❌ 文件为空或没有有效的URL');
            process.exit(1);
        }
        
        console.log(`📋 从 ${filename} 读取到 ${urls.length} 个URL`);
        
        const processor = new BatchArticleProcessor();
        processor.processArticles(urls).catch(console.error);
    } catch (error) {
        console.error(`❌ 读取文件失败: ${error.message}`);
        process.exit(1);
    }
}

module.exports = BatchArticleProcessor;