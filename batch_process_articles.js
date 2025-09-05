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
const UnifiedHistoryDatabase = require('./unified_history_database');

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
        this.historyDB = new UnifiedHistoryDatabase(); // 统一历史数据库
        this.successCount = 0; // 成功计数
        this.failedCount = 0; // 失败计数
        this.currentUrlFile = ''; // 当前处理的URL文件
        this.isRetryingFailed = process.argv.includes('--retry-failed'); // 是否在重试失败文章模式
        this.isProcessAllFailed = process.argv.includes('--process-all-failed'); // 是否处理所有失败文章
        
        // 加载输出配置
        this.outputConfig = this.loadOutputConfig();
        
        // 超时统计
        this.timeoutStats = {
            total: 0,
            byWebsite: {},
            urls: []
        };
        
        // 改写进度计时器管理
        this.currentRewriteInterval = null;
        
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
                },
                'lpga.com': {
                    name: 'LPGA',
                    useSpecialImageHandler: true,  // 强制使用专用抓取器
                    selectors: {
                        title: 'h2', // LPGA使用H2作为标题
                        article: 'body',
                        content: 'p',
                        heroImage: 'img:first-of-type',
                        contentImages: 'img'
                    }
                }
            };
        }
        
        // 改写错误恢复配置
        this.rewriteErrorRecovery = {
            enabled: true,
            maxRecoveryAttempts: 3,
            recoveryDelay: 60000, // 1分钟
            errorHistory: []
        };
        
        // 文章质量评分系统配置
        this.qualityScoring = {
            enabled: true,
            thresholds: {
                excellent: 85,    // 优秀文章
                good: 70,         // 良好文章
                acceptable: 50,   // 可接受文章
                poor: 30          // 低质量文章
            },
            weights: {
                length: 0.25,     // 文章长度权重
                images: 0.20,     // 图片数量权重
                structure: 0.20,  // 文章结构权重
                readability: 0.20,// 可读性权重
                keywords: 0.15    // 关键词密度权重
            }
        };
    }

    /**
     * 智能等待函数 - 替代固定的waitForTimeout
     * @param {Page} page - Playwright页面对象
     * @param {Object} options - 等待选项
     * @returns {Promise<boolean>} - 是否成功等待到目标
     */
    async smartWait(page, options = {}) {
        const {
            selector = null,
            maxWait = 5000,
            minWait = 500,
            checkInterval = 100,
            checkFunction = null,
            description = '等待页面稳定'
        } = options;
        
        console.log(`  ⏳ ${description}...`);
        const startTime = Date.now();
        
        // 优先使用选择器等待
        if (selector) {
            try {
                await page.waitForSelector(selector, { 
                    timeout: maxWait,
                    state: 'visible'
                });
                // 成功找到后最小等待
                await page.waitForTimeout(minWait);
                console.log(`  ✅ ${description}完成 (${Date.now() - startTime}ms)`);
                return true;
            } catch (e) {
                // 选择器未找到，继续其他检查
            }
        }
        
        // 使用自定义检查函数
        if (checkFunction) {
            try {
                await page.waitForFunction(checkFunction, {
                    timeout: maxWait,
                    polling: checkInterval
                });
                await page.waitForTimeout(minWait);
                console.log(`  ✅ ${description}完成 (${Date.now() - startTime}ms)`);
                return true;
            } catch (e) {
                // 检查失败
            }
        }
        
        // 降级到最小等待
        await page.waitForTimeout(minWait);
        console.log(`  ⚡ ${description}快速完成 (${minWait}ms)`);
        return false;
    }

    ensureDirectories() {
        ['images', 'wechat_ready', 'wechat_html'].forEach(dir => {
            const fullPath = path.join(this.baseDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    /**
     * 清理改写进度计时器
     */
    clearRewriteProgressInterval() {
        if (this.currentRewriteInterval) {
            clearInterval(this.currentRewriteInterval);
            this.currentRewriteInterval = null;
        }
    }

    /**
     * 更新实时处理进度
     * @param {number} currentIndex - 当前处理的索引
     * @param {number} totalUrls - 总URL数
     * @param {string} currentUrl - 当前URL
     * @param {string} stage - 处理阶段 ('fetching', 'rewriting', 'saving')
     */
    async updateProcessingProgress(currentIndex, totalUrls, currentUrl, stage) {
        try {
            const urlFile = this.currentUrlFile || 'unknown';
            // 去掉_deduped后缀，使用原始文件名
            const baseFileName = urlFile.replace('_deduped.txt', '.txt').replace('.txt', '');
            const progressFile = path.join(__dirname, `batch_progress_${baseFileName}.json`);
            
            const websiteName = this.getWebsiteName(urlFile);
            const progress = {
                urlFile: urlFile,
                websiteName: websiteName,
                currentIndex: currentIndex,
                totalUrls: totalUrls,
                currentUrl: currentUrl,
                stage: stage,
                stageText: {
                    'fetching': '抓取中',
                    'rewriting': '改写中',
                    'saving': '保存中'
                }[stage] || '处理中',
                startTime: this.processingStartTime,
                currentTime: Date.now(),
                estimatedTimePerArticle: 45000,
                processedArticles: currentIndex - 1,
                successCount: this.successCount,
                failedCount: this.failedCount,
                elapsedTime: Date.now() - this.processingStartTime,
                estimatedRemaining: (totalUrls - currentIndex + 1) * 45000
            };
            
            fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
        } catch (e) {
            // 静默处理错误，避免影响主流程
            console.error('更新进度失败:', e.message);
        }
    }

    /**
     * 获取网站名称
     * @param {string} urlFile - URL文件名
     * @returns {string} 网站名称
     */
    getWebsiteName(urlFile) {
        const mapping = {
            'deep_urls_golf_com.txt': 'Golf.com',
            'deep_urls_golfmonthly_com.txt': 'Golf Monthly',
            'deep_urls_mygolfspy_com.txt': 'MyGolfSpy',
            'deep_urls_www_golfwrx_com.txt': 'GolfWRX',
            'deep_urls_www_golfdigest_com.txt': 'Golf Digest',
            'deep_urls_todays_golfer_com.txt': "Today's Golfer",
            'deep_urls_golfweek_usatoday_com.txt': 'Golfweek',
            'deep_urls_nationalclubgolfer_com.txt': 'National Club Golfer',
            'deep_urls_skysports_com.txt': 'Sky Sports Golf',
            'deep_urls_www_pgatour_com.txt': 'PGA Tour',
            'deep_urls_golfmagic_com.txt': 'Golf Magic',
            'deep_urls_yardbarker_com.txt': 'Yardbarker Golf',
            'deep_urls_golf_net_cn.txt': '中国高尔夫网',
            'deep_urls_si_com.txt': 'SI Golf',
            'deep_urls_yahoo_golf.txt': 'Yahoo Sports Golf',
            'deep_urls_espn_golf.txt': 'ESPN Golf',
            'deep_urls_lpga_com.txt': 'LPGA',
            'deep_urls_cbssports_golf.txt': 'CBS Sports Golf'
        };
        
        return mapping[urlFile] || urlFile.replace(/deep_urls_|\.txt/g, '').replace(/_/g, ' ');
    }

    /**
     * 验证文章内容是否有效
     * @param {string} content - 文章内容
     * @returns {boolean} - 是否有效
     */
    isValidArticleContent(content) {
        if (!content || typeof content !== 'string') {
            console.log('  ❌ 内容验证失败：内容为空或类型错误');
            return false;
        }

        // 最小长度要求（500字符）
        if (content.length < 500) {
            console.log(`  ❌ 内容验证失败：内容过短（${content.length}字符）`);
            return false;
        }

        // 检测无效内容特征（AI助手回复）
        const invalidPatterns = [
            '我看到您提供了',
            '我看到了高尔夫内容改写',
            '需要我按照指南',
            '请问您希望我',
            '请告诉我您的具体需求',
            '或者有其他具体需求',
            '将这篇英文文章改写成中文版本',
            '还是需要我帮您分析',
            'I see you',
            'Would you like me to',
            'Please let me know'
        ];

        const contentLower = content.toLowerCase();
        for (const pattern of invalidPatterns) {
            if (content.includes(pattern) || contentLower.includes(pattern.toLowerCase())) {
                console.log(`  ❌ 内容验证失败：检测到无效内容特征（${pattern}）`);
                return false;
            }
        }

        // 检查是否包含实际的文章内容特征
        const hasArticleFeatures = 
            content.includes('[IMAGE_') ||  // 有图片占位符
            /^#\s+.+/m.test(content) ||   // 有标题
            content.split('\n').filter(line => line.trim().length > 50).length > 3; // 至少有3个较长段落

        if (!hasArticleFeatures) {
            console.log('  ❌ 内容验证失败：缺少文章特征（无图片、标题或段落）');
            return false;
        }

        return true;
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
                        
                        // 同步到历史数据库
                        this.historyDB.addProcessedUrl(url, {
                            articleNum: num,
                            date: todayDate,
                            status: 'duplicate',
                            duplicateInfo: {
                                date: globalCheck.date,
                                articleNum: globalCheck.articleNum
                            },
                            source: 'duplicate_check'
                        });
                        
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
            
            // 预加载所有URL到内存 - 但必须验证实际文件存在
            if (fs.existsSync(baseDir)) {
                const dateDirs = fs.readdirSync(baseDir)
                    .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
                
                for (const dateDir of dateDirs) {
                    const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
                    if (fs.existsSync(urlsJsonPath)) {
                        try {
                            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                            for (const [articleNum, recordedUrl] of Object.entries(urlMapping)) {
                                // 检查实际的.md文件是否存在
                                const mdFilePath = path.join(baseDir, dateDir, 'wechat_ready', `wechat_article_${articleNum}.md`);
                                if (fs.existsSync(mdFilePath)) {
                                    // 只有文件真实存在时才添加到缓存
                                    const normalizedUrl = normalizeUrl(typeof recordedUrl === 'string' ? recordedUrl : recordedUrl.url);
                                    urlCache.set(normalizedUrl, { dateDir, articleNum });
                                } else {
                                    // 文件不存在，记录但不缓存（允许重新处理）
                                    console.log(`⚠️  发现状态不一致: ${dateDir}/article_${articleNum} 在JSON中标记但文件不存在`);
                                }
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
                    localDuplicates.push(url);
                    console.log(`  ✅ 本地已存在: ${url}`);
                    console.log(`      位置: ${cached.dateDir}/文章${cached.articleNum}`);
                    
                    // 更新URL处理状态到processing_status.json
                    const statusFile = path.join(__dirname, 'processing_status.json');
                    try {
                        const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
                        if (!status.urlStatus) status.urlStatus = {};
                        if (!status.urlStatus[this.currentUrlFile]) status.urlStatus[this.currentUrlFile] = {};
                        status.urlStatus[this.currentUrlFile][url] = {
                            status: 'processed',
                            reason: 'local_exists',
                            articleNum: cached.articleNum,
                            processedAt: new Date().toISOString()
                        };
                        fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
                    } catch (e) {
                        // 忽略错误，不影响主流程
                    }
                } else {
                    localNewUrls.push(url);
                }
            }
            
            console.log(`\n📊 本地检查结果:`);
            console.log(`  🆕 新URL: ${localNewUrls.length}`);
            console.log(`  ✅ 已完成的文章: ${localDuplicates.length}`);
            
            // 如果没有新URL，检查是否需要强制重试
            if (localNewUrls.length === 0) {
                // 在 --force-retry 模式下，检查所有URL（包括已处理的）是否有失败的
                if (process.argv.includes('--force-retry')) {
                    console.log('\n🔄 强制重试模式：检查所有URL的失败状态...');
                    const failedUrls = [];
                    const allUrls = [...localDuplicates, ...localNewUrls];
                    
                    try {
                        const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
                        if (fs.existsSync(failedArticlesPath)) {
                            const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
                            
                            for (const url of allUrls) {
                                if (failedArticles[url] && 
                                    (failedArticles[url].status === 'failed' || 
                                     failedArticles[url].status === 'pending_retry')) {
                                    failedUrls.push(url);
                                    console.log(`  ❌ 发现失败文章需要重试: ${url}`);
                                }
                            }
                        }
                    } catch (e) {
                        console.log('  ⚠️ 无法读取失败文章状态');
                    }
                    
                    if (failedUrls.length > 0) {
                        console.log(`  📊 找到 ${failedUrls.length} 个失败的文章需要重试`);
                        // 将失败的URL和新URL合并
                        const combinedNewUrls = [...new Set([...failedUrls, ...localNewUrls])];
                        return {
                            newUrls: combinedNewUrls,
                            duplicateUrls: localDuplicates.filter(url => !failedUrls.includes(url)),
                            skippedCount: localDuplicates.length - failedUrls.length
                        };
                    }
                }
                
                console.log('\n✅ 所有URL都已在本地处理过，无需重复处理');
                return {
                    newUrls: [],
                    duplicateUrls: localDuplicates,
                    skippedCount: localDuplicates.length
                };
            }
            
            // 在 --force-retry 模式下，即使有新URL，也要检查失败的URL
            if (process.argv.includes('--force-retry')) {
                console.log('\n🔄 强制重试模式：额外检查失败的URL...');
                const failedUrls = [];
                
                try {
                    const failedArticlesPath = path.join(__dirname, 'failed_articles.json');
                    if (fs.existsSync(failedArticlesPath)) {
                        const failedArticles = JSON.parse(fs.readFileSync(failedArticlesPath, 'utf8'));
                        
                        // 检查所有URL（包括已处理的）
                        for (const url of [...localDuplicates, ...localNewUrls]) {
                            if (failedArticles[url] && 
                                (failedArticles[url].status === 'failed' || 
                                 failedArticles[url].status === 'pending_retry')) {
                                if (!localNewUrls.includes(url)) {
                                    failedUrls.push(url);
                                    console.log(`  ❌ 发现额外的失败文章需要重试: ${url}`);
                                }
                            }
                        }
                        
                        if (failedUrls.length > 0) {
                            console.log(`  📊 额外找到 ${failedUrls.length} 个失败的文章需要重试`);
                            // 将失败的URL添加到新URL列表
                            localNewUrls.push(...failedUrls);
                        }
                    }
                } catch (e) {
                    console.log('  ⚠️ 无法读取失败文章状态');
                }
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

    /**
     * 扫描所有历史失败的URL
     * @returns {Array} 失败的URL列表
     */
    async scanAllFailedUrls() {
        console.log('🔍 扫描所有历史失败的文章...');
        const failedUrls = new Set();
        
        try {
            // 获取golf_content目录下的所有日期目录
            const golfContentDir = path.join(process.cwd(), 'golf_content');
            const dateDirs = fs.readdirSync(golfContentDir).filter(dir => {
                // 匹配YYYY-MM-DD格式的目录
                return /^\d{4}-\d{2}-\d{2}$/.test(dir);
            });
            
            // 扫描每个日期目录的article_urls.json
            for (const dateDir of dateDirs) {
                const urlsFile = path.join(golfContentDir, dateDir, 'article_urls.json');
                if (fs.existsSync(urlsFile)) {
                    try {
                        const urlsData = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                        
                        // 收集失败状态的URL
                        let scannedCount = 0;
                        let skippedCount = 0;
                        let dateFailedCount = 0;
                        
                        for (const [key, data] of Object.entries(urlsData)) {
                            scannedCount++;
                            
                            // 检查状态
                            if (data === 'failed') {
                                failedUrls.add(key);  // key是URL
                                dateFailedCount++;
                            }
                        }
                        
                        if (dateFailedCount > 0 || skippedCount > 0) {
                            console.log(`  📁 ${dateDir}: 扫描${scannedCount}条，发现${dateFailedCount}个失败，跳过${skippedCount}个（重试超限或已成功）`);
                        }
                    } catch (e) {
                        console.log(`  ⚠️ 读取 ${dateDir} 的URL文件失败: ${e.message}`);
                    }
                }
            }
            
            const failedArray = Array.from(failedUrls);
            console.log(`  ✅ 找到 ${failedArray.length} 个历史失败的URL`);
            
            // 按网站分组显示统计
            const websiteStats = {};
            let invalidUrlCount = 0;
            
            failedArray.forEach(url => {
                try {
                    const domain = new URL(url).hostname.replace('www.', '');
                    websiteStats[domain] = (websiteStats[domain] || 0) + 1;
                } catch (e) {
                    invalidUrlCount++;
                    console.log(`  ⚠️ 无效URL格式: ${url}`);
                }
            });
            
            if (invalidUrlCount > 0) {
                console.log(`  ⚠️ 跳过 ${invalidUrlCount} 个无效URL`);
            }
            
            console.log('\n📊 按网站统计:');
            Object.entries(websiteStats)
                .sort((a, b) => b[1] - a[1])
                .forEach(([site, count]) => {
                    console.log(`  • ${site}: ${count} 篇`);
                });
            console.log('');
            
            return failedArray;
            
        } catch (error) {
            console.error(`❌ 扫描失败URL时出错: ${error.message}`);
            return [];
        }
    }

    async processArticles(urls, options = {}) {
        console.log('🚀 批量处理文章（智能流畅版）');
        
        // 解析选项
        const { skipDuplicateCheck = false, urlFile = '' } = options;
        this.currentUrlFile = urlFile; // 保存当前处理的URL文件名
        
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
        
        // 检测是否包含MyGolfSpy URL并分离处理
        const myGolfSpyUrls = newUrls.filter(url => url.includes('mygolfspy.com'));
        const otherUrls = newUrls.filter(url => !url.includes('mygolfspy.com'));
        
        if (myGolfSpyUrls.length > 0) {
            console.log('🎯 检测到MyGolfSpy URL，将采用单线程极致优化模式');
            console.log(`  - MyGolfSpy文章: ${myGolfSpyUrls.length} 篇`);
            console.log(`  - 其他网站文章: ${otherUrls.length} 篇\n`);
        }
        
        // 只处理新文章
        console.log(`📊 开始处理 ${newUrls.length} 篇新文章\n`);
        
        // 重新排序URL，将MyGolfSpy放到最后处理
        const reorderedUrls = [...otherUrls, ...myGolfSpyUrls];
        
        const totalStart = Date.now();
        
        // 2. 启动浏览器
        console.log('2️⃣ 启动浏览器...');
        
        try {
            // 使用智能浏览器管理器，自动选择最佳模式
            const firstUrl = reorderedUrls[0] || '';
            console.log(`🌐 准备启动浏览器处理 ${reorderedUrls.length} 篇文章...`);
            this.browser = await this.browserManager.launchBrowser(firstUrl);
            
            // 3. 串行处理每个文章（从抓取到改写完成）
        console.log('3️⃣ 开始逐个处理文章...\n');
        const extractStart = Date.now();
        
        const articles = [];
        
        // 串行处理每个文章 - 使用URL级别的原子编号分配
        for (let i = 0; i < reorderedUrls.length; i++) {
            const url = reorderedUrls[i];
            // 🔧 关键修复：基于URL的原子编号分配，防止重复
            const articleNum = this.getOrAssignArticleNumber(url);
            
            // 如果返回null，说明此URL已在其他日期成功处理，跳过
            if (articleNum === null) {
                console.log(`\n⏭️ 跳过第 ${i + 1}/${reorderedUrls.length} 篇文章（已在其他日期成功处理）`);
                console.log(`🔗 URL: ${url}\n`);
                continue;
            }
            
            // 🛡️ 防御性去重检查（二次验证）
            const historyRecord = this.historyDB.isUrlProcessed(url);
            if (historyRecord && historyRecord.status === 'completed') {
                console.log(`\n⚠️  防御性去重：跳过第 ${i + 1}/${reorderedUrls.length} 篇文章（历史数据库已记录）`);
                console.log(`🔗 URL: ${url}`);
                console.log(`📅 原处理时间: ${historyRecord.date}\n`);
                
                // 立即更新article_urls.json状态为duplicate
                const urlMapFile = path.join(this.baseDir, 'article_urls.json');
                let urlMapping = {};
                if (fs.existsSync(urlMapFile)) {
                    try {
                        urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                        urlMapping[articleNum] = {
                            url: url,
                            timestamp: new Date().toISOString(),
                            status: 'duplicate',
                            duplicateInfo: {
                                date: historyRecord.date,
                                articleNum: historyRecord.articleNum,
                                source: 'history_database'
                            },
                            skippedAt: new Date().toISOString()
                        };
                        fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                        console.log(`   ✅ 已更新状态为 duplicate`);
                        
                        // 同步到历史数据库
                        this.historyDB.addProcessedUrl(url, {
                            articleNum: articleNum,
                            date: historyRecord.date,
                            status: 'duplicate',
                            duplicateInfo: {
                                date: historyRecord.date,
                                articleNum: historyRecord.articleNum,
                                source: 'history_database'
                            },
                            source: 'batch_processor'
                        });
                    } catch (err) {
                        console.log(`   ⚠️ 更新状态失败: ${err.message}`);
                    }
                }
                continue;
            }
            
            const websiteName = this.getWebsiteName(this.currentUrlFile || '');
            const articleStartTime = Date.now();
            const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
            const progress = ((i + 1) / reorderedUrls.length * 100).toFixed(1);
            console.log(`\n[${timestamp}] 📄 [${websiteName} ${i + 1}/${reorderedUrls.length}] ${url} | 进度: ${progress}%`);
            console.log(`[${timestamp}]    ├─ 🔍 抓取中... (0-15秒)`);
            
            // 更新进度 - 开始抓取
            await this.updateProcessingProgress(i + 1, reorderedUrls.length, url, 'fetching');
            
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
                
                // 智能等待Golf.com页面稳定
                await this.smartWait(page, {
                    selector: 'article, .article-content, .post-content',
                    maxWait: 5000,
                    minWait: 1000,
                    description: 'Golf.com页面加载'
                });
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
                        
                        // 特殊网站需要更长的超时时间
                        let adjustedTimeout = timeout;
                        if (url.includes('golfwrx.com')) {
                            adjustedTimeout = timeout * 2;
                        } else if (url.includes('lpga.com')) {
                            adjustedTimeout = timeout * 1.5; // LPGA需要额外时间
                        } else if (url.includes('golf.net.cn')) {
                            adjustedTimeout = timeout * 2; // 中国网站需要更长时间
                        }
                        
                        console.log(`  ⏳ 加载页面 (第${pageLoadAttempts + 1}/${maxPageLoadAttempts}次, 策略: ${waitStrategy}, 超时: ${adjustedTimeout/1000}秒)`);
                        
                        response = await page.goto(url, { 
                            waitUntil: waitStrategy, 
                            timeout: adjustedTimeout 
                        });
                        
                        // Golf.com需要额外等待
                        if (isGolfCom) {
                            await this.smartWait(page, {
                                selector: 'article p:nth-of-type(3)',  // 等待至少3个段落
                                maxWait: 5000,
                                minWait: 1000,
                                description: 'Golf.com内容加载'
                            });
                        }
                        
                        // Golf Digest需要额外等待
                        if (url.includes('golfdigest.com')) {
                            await this.smartWait(page, {
                                selector: '.article-body p:nth-of-type(2)',
                                maxWait: 3000,
                                minWait: 500,
                                description: 'Golf Digest内容加载'
                            });
                        }
                        
                        // GolfWRX Cloudflare处理
                        if (url.includes('golfwrx.com')) {
                            const pageContent = await page.content();
                            if (pageContent.includes('Cloudflare') || 
                                pageContent.includes('Just a moment') ||
                                pageContent.includes('cf-browser-verification')) {
                                console.log('  ⚠️ 检测到GolfWRX Cloudflare保护，智能等待...');
                                
                                // 使用更高效的waitForFunction替代循环
                                const cloudflareGone = await page.waitForFunction(
                                    () => {
                                        const text = document.body.textContent;
                                        return !text.includes('Cloudflare') && 
                                               !text.includes('Just a moment') &&
                                               !text.includes('Checking your browser');
                                    },
                                    { 
                                        timeout: 30000,
                                        polling: 500  // 从2000ms优化到500ms
                                    }
                                ).catch(() => false);
                                
                                if (cloudflareGone) {
                                    console.log('  ✅ GolfWRX Cloudflare验证已通过');
                                    // 智能等待页面稳定
                                    await this.smartWait(page, {
                                        selector: 'article',
                                        maxWait: 5000,
                                        minWait: 500,
                                        description: 'Cloudflare验证后内容加载'
                                    });
                                } else {
                                    console.log('  ⚠️ Cloudflare验证超时，继续尝试');
                                }
                            }
                        }
                        
                        break; // 成功加载，退出循环
                    } catch (loadError) {
                        pageLoadAttempts++;
                        if (pageLoadAttempts >= maxPageLoadAttempts) {
                            throw loadError; // 所有尝试都失败
                        }
                        console.log(`  ⚠️ 页面加载失败(${loadError.message.substring(0, 50)}...)，重试 ${pageLoadAttempts}/${maxPageLoadAttempts}...`);
                        // 智能等待页面恢复
                        await this.smartWait(page, {
                            maxWait: pageLoadAttempts * 1000,
                            minWait: 500,
                            checkFunction: async () => {
                                try {
                                    // 检查网络是否恢复
                                    const response = await page.evaluate(() => fetch(window.location.href, { method: 'HEAD' }));
                                    return response && response.ok;
                                } catch {
                                    return false;
                                }
                            },
                            description: `页面恢复检查(第${pageLoadAttempts}次)`
                        });
                    }
                }
                
                // 检查是否为404或其他错误状态
                if (response && !response.ok()) {
                    const status = response.status();
                    throw new Error(`HTTP ${status}: 文章不存在或已被删除`);
                }
                
                // 处理 MyGolfSpy RSS模式
                if (url.includes('mygolfspy.com')) {
                    console.log('📡 MyGolfSpy检测到 - 使用RSS模式处理');
                    console.log('💡 直接使用RSS方式处理，避免403错误');
                    
                    // 设置合理的超时时间
                    page.setDefaultNavigationTimeout(30000);
                    page.setDefaultTimeout(30000);
                    
                    // 直接前往页面，不等待加载完成
                    try {
                        console.log('🔄 准备RSS处理MyGolfSpy页面...');
                        // 只是为了设置page的URL，不等待加载
                        await page.goto(url, { 
                            waitUntil: 'commit', // 最快的等待策略
                            timeout: 10000
                        });
                        console.log('✅ 已准备好进行RSS处理');
                    } catch (error) {
                        // 即使加载失败也继续，因为我们使用RSS处理
                        console.log(`📡 忽略页面加载错误，继续RSS处理: ${error.message}`);
                    }
                    
                    // RSS模式不需要处理弹窗和内容验证
                    console.log('🚀 跳过弹窗处理，直接进入RSS内容抓取');
                }
                
                // 等待文章容器（MyGolfSpy使用更长超时）
                const articleTimeout = url.includes('mygolfspy.com') ? 30000 : 15000;
                try {
                    await page.waitForSelector(selectors.article || 'article', { timeout: articleTimeout });
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
                        
                        // 检查是否是MyGolfSpy的RSS错误
                        if (specificContent && (specificContent.error === 'MYGOLFSPY_403_ERROR' || specificContent.error === 'MYGOLFSPY_RSS_ERROR')) {
                            console.log('📡 MyGolfSpy RSS处理中遇到问题');
                            if (specificContent.error === 'MYGOLFSPY_RSS_ERROR') {
                                console.log('⚠️ RSS处理失败，可能文章不在RSS feed中');
                            }
                            throw new Error(specificContent.message || 'MyGolfSpy处理失败');
                        }
                        
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
                        
                        // 检查是否是MyGolfSpy的RSS错误
                        if (specificContent && (specificContent.error === 'MYGOLFSPY_403_ERROR' || specificContent.error === 'MYGOLFSPY_RSS_ERROR')) {
                            console.log('📡 MyGolfSpy RSS处理中遇到问题');
                            if (specificContent.error === 'MYGOLFSPY_RSS_ERROR') {
                                console.log('⚠️ RSS处理失败，可能文章不在RSS feed中');
                            }
                            throw new Error(specificContent.message || 'MyGolfSpy处理失败');
                        }
                        
                        if (specificContent) {
                            console.log('✅ 网站特定抓取成功');
                            data = specificContent;
                        }
                    } catch (error) {
                        console.error('❌ 网站特定抓取失败:', error.message);
                    }
                }
                
                // 确保data存在且有效
                if (!data) {
                    throw new Error('文章内容抓取失败：返回数据为空');
                }
                
                // 验证基本字段
                if (!data.title || !data.content) {
                    throw new Error(`文章内容抓取失败：缺少${!data.title ? '标题' : '内容'}`);
                }
                
                // 验证内容长度
                if (data.content.length < 100) {
                    throw new Error(`文章内容抓取失败：内容过短（${data.content.length}字符）`);
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
                        
                        // 同步到历史数据库，标记为跳过状态
                        this.historyDB.addProcessedUrl(url, {
                            articleNum: articleNum,
                            title: data.title || '视频文章',
                            siteName: new URL(url).hostname.replace('www.', ''),
                            date: this.dateStr,
                            status: 'skipped',  // 标记为跳过
                            reason: '纯视频文章，内容过少',
                            source: 'batch_processor',
                            contentLength: cleanContent.length,
                            videoUrl: isVideoUrl,
                            hasVideoEmbed: hasVideoEmbed
                        });
                        
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
                
                const fetchTime = Date.now() - articleStartTime;
                const fetchTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                console.log(`[${fetchTimestamp}]    ├─ ✅ 抓取成功 (${Math.round(fetchTime/1000)}秒) | 内容: ${(data.content.length/1024).toFixed(1)}KB | 图片: ${data.images.length}张`);
                
                const article = {
                    ...data,
                    url,
                    articleNum,  // 最终编号
                    images: data.images,
                    sourceSite: this.getDomainFromUrl(url)  // 添加来源网站
                };
                
                await page.close();
                
                const rewriteStartTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                console.log(`[${rewriteStartTimestamp}]    ├─ ✍️ 开始改写 | 标题: ${article.title.substring(0, 60)}...`);
                console.log(`[${rewriteStartTimestamp}]    ├─ 📊 改写参数 | 字数: ${article.content.length} | 预计耗时: ${Math.ceil(article.content.length/1000*2)}秒`);
                
                // 更新进度 - 开始改写
                await this.updateProcessingProgress(i + 1, reorderedUrls.length, url, 'rewriting');
                
                // 在创建新计时器前，先清理旧的
                this.clearRewriteProgressInterval();
                
                // 设置改写进度提示
                this.currentRewriteInterval = setInterval(() => {
                    const elapsed = Math.round((Date.now() - articleStartTime) / 1000);
                    const progressTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    console.log(`[${progressTimestamp}]    ├─ ⏳ 改写中... | 已用时: ${elapsed}秒`);
                }, 10000);
                
                // 直接在这里进行Claude改写
                // 将变量定义移到try块外部，避免在catch块中使用未定义的变量
                let contentSize = 0;
                let rewriteDomain = ''; // 改名为rewriteDomain避免重复声明
                try {
                    const articleStart = Date.now();
                    
                    // 固定3分钟超时
                    const FIXED_REWRITE_TIMEOUT = 180000; // 3分钟
                    contentSize = (article.content?.length || 0) / 1024; // KB
                    rewriteDomain = new URL(url).hostname.replace('www.', '');
                    
                    console.log(`  ⏱️ 开始改写文章（限时3分钟）...`);
                    console.log(`     📊 内容大小: ${contentSize.toFixed(1)}KB`);
                    console.log(`     🌐 网站: ${rewriteDomain}`);
                    
                    // 🔧 验证文章内容是否有效
                    if (!this.isValidArticleContent(article.content)) {
                        console.log(`  ❌ 文章内容无效，跳过改写`);
                        
                        // 更新URL映射状态
                        const urlMapFile = path.join(this.baseDir, 'article_urls.json');
                        if (fs.existsSync(urlMapFile)) {
                            try {
                                const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                                if (urlMapping[articleNum]) {
                                    if (typeof urlMapping[articleNum] === 'object') {
                                        urlMapping[articleNum].status = 'failed';
                                        urlMapping[articleNum].reason = '文章内容无效';
                                        urlMapping[articleNum].failedAt = new Date().toISOString();
                                    }
                                    fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
                                }
                            } catch (e) {}
                        }
                        
                        // 记录失败
                        this.apiFailureHandler.logFailedArticle(article.url, '文章内容无效（可能是抓取失败）');
                        // 永久标记失败的URL
                        this.historyDB.addFailedUrl(article.url, '文章内容无效（可能是抓取失败）', {
                            source: 'batch_processor'
                        });
                        article.rewrittenContent = null;
                        articles.push(article);
                        
                        // 更新失败计数
                        this.failedCount++;
                        
                        console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章内容无效（已跳过）\n`);
                        continue;
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
                            // 同步到历史数据库，标记为跳过状态
                            this.historyDB.addProcessedUrl(article.url, {
                                articleNum: articleNum,
                                title: article.title || '实时赛事报道',
                                siteName: article.sourceSite || this.getDomainFromUrl(article.url),
                                date: this.dateStr,
                                status: 'skipped',  // 标记为跳过，而不是失败
                                reason: '实时赛事报道内容过长',
                                source: 'batch_processor',
                                contentLength: contentLength,
                                lineCount: lineCount
                            });
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
                    
                    // 清除改写进度提示
                    this.clearRewriteProgressInterval();
                    
                    const rewriteTime = Date.now() - articleStartTime - fetchTime;
                    const rewriteEndTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    console.log(`[${rewriteEndTimestamp}]    ├─ ✅ 改写完成 | 耗时: ${Math.round(rewriteTime/1000)}秒 | 字数: 原文${article.content.length} → 改写${article.rewrittenContent.length}`);
                    
                    // 执行AI检测和可能的重写
                    const aiResult = await this.processArticleWithAIDetection(article, processedContent);
                    article.rewrittenContent = aiResult.content;
                    article.aiProbability = aiResult.aiProbability;
                    article.rewriteCount = aiResult.rewriteCount;
                    
                    // 立即保存成功的文章
                    try {
                        // 更新进度 - 保存文章
                        await this.updateProcessingProgress(i + 1, reorderedUrls.length, url, 'saving');
                        
                        await this.saveSingleArticle(article);
                        console.log(`  💾 文章已保存到网页`);
                        
                        // 更新成功计数
                        this.successCount++;
                        
                        console.log(`   ├─ 💾 保存中...`);
                        
                        if (article.aiProbability !== null) {
                            const aiTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                            console.log(`[${aiTimestamp}]    ├─ 🤖 AI检测结果 | AI率: ${article.aiProbability}% | ${article.aiProbability > 40 ? '需要重写' : '通过'}`);
                            if (article.rewriteCount > 0) {
                                console.log(`[${aiTimestamp}]    ├─ 🔄 自动重写 | 第${article.rewriteCount}次重写完成`);
                            }
                        }
                        
                        const totalTime = Date.now() - articleStartTime;
                        console.log(`   └─ ✅ 文章处理成功 (总耗时: ${Math.round(totalTime/1000)}秒)`);
                    } catch (saveError) {
                        console.error(`  ❌ 保存文章时出错:`, saveError.message);
                        article.rewrittenContent = null; // 标记为失败
                        this.apiFailureHandler.logFailedArticle(article.url, `保存失败: ${saveError.message}`);
                        // 永久标记失败的URL
                        this.historyDB.addFailedUrl(article.url, `保存失败: ${saveError.message}`, {
                            source: 'batch_processor'
                        });
                        
                        // 更新失败计数
                        this.failedCount++;
                        
                        console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章保存失败（已跳过）\n`);
                    }
                    
                } catch (error) {
                    // 清除改写进度提示
                    this.clearRewriteProgressInterval();
                    
                    const errorTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    console.error(`[${errorTimestamp}]    ├─ ❌ 改写失败:`, error.message);
                    
                    // 记录错误到历史
                    this.rewriteErrorRecovery.errorHistory.push({
                        timestamp: new Date().toISOString(),
                        url: article.url,
                        error: error.message,
                        articleIndex: i
                    });
                    
                    // 尝试错误恢复
                    if (this.rewriteErrorRecovery.enabled && 
                        this.shouldAttemptRecovery(error)) {
                        
                        // 清理可能存在的进度计时器
                        this.clearRewriteProgressInterval();
                        
                        console.log(`  🔄 尝试错误恢复机制...`);
                        
                        try {
                            // 等待恢复时间
                            await this.sleep(this.rewriteErrorRecovery.recoveryDelay);
                            
                            // 重新初始化改写器
                            this.rewriter = new ArticleRewriterEnhanced();
                            
                            // 再次尝试改写（仅一次）
                            article.rewrittenContent = await this.rewriter.rewriteArticle(
                                article.title,
                                article.content,
                                article.url
                            );
                            
                            console.log(`  ✅ 错误恢复成功！`);
                            // 继续正常流程，跳到文章保存部分
                            
                        } catch (recoveryError) {
                            console.log(`  ❌ 错误恢复失败: ${recoveryError.message}`);
                            // 继续原有的失败处理流程
                        }
                    }
                    
                    // 如果仍然没有改写内容，执行失败处理
                    if (!article.rewrittenContent) {
                        article.rewrittenContent = null;
                        
                        // 安全的失败记录（防止方法不存在导致崩溃）
                        try {
                            if (this.historyDB && typeof this.historyDB.addFailedUrl === 'function') {
                                this.historyDB.addFailedUrl(article.url, `Claude改写失败: ${error.message}`, {
                                    source: 'batch_processor',
                                    articleTitle: article.title,
                                    errorDetails: error.stack
                                });
                            } else {
                                // 降级处理：使用 addProcessedUrl 标记为失败
                                this.historyDB.addProcessedUrl(article.url, {
                                    status: 'failed',
                                    reason: `Claude改写失败: ${error.message}`,
                                    source: 'batch_processor'
                                });
                            }
                        } catch (dbError) {
                            console.error(`  ⚠️ 无法记录失败信息到数据库: ${dbError.message}`);
                        }
                        
                        // 记录失败的文章
                        this.apiFailureHandler.logFailedArticle(article.url, `Claude改写失败: ${error.message}`);
                        
                        console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章处理失败（已跳过）\n`);
                        
                        // 更新失败计数
                        this.failedCount++;
                        
                        // 记录超时统计
                        if (error.message.includes('超时')) {
                            this.timeoutStats.total++;
                            this.timeoutStats.byWebsite[rewriteDomain] = (this.timeoutStats.byWebsite[rewriteDomain] || 0) + 1;
                            this.timeoutStats.urls.push(article.url);
                            
                            // 记录详细的超时信息
                            this.historyDB.addFailedUrl(article.url, '改写超时（3分钟）', {
                                source: 'batch_processor',
                                articleTitle: article.title,
                                contentSize: Math.round(contentSize), // KB
                                timeout: true,
                                timeoutDuration: 180000
                            });
                        }
                        
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
                
                // 如果是选择器错误，尝试保存调试信息
                if (error.message.includes('waitForSelector') || error.message.includes('Timeout')) {
                    try {
                        const domain = new URL(url).hostname;
                        console.error(`[DEBUG] 网站: ${domain}`);
                        console.error(`[DEBUG] 错误详情: ${error.message}`);
                        
                        // 获取页面标题
                        const pageTitle = await page.title();
                        console.error(`[DEBUG] 页面标题: ${pageTitle}`);
                        
                        // 尝试获取所有h1标签的数量和内容
                        const h1Info = await page.evaluate(() => {
                            const h1Tags = Array.from(document.querySelectorAll('h1'));
                            return {
                                count: h1Tags.length,
                                texts: h1Tags.slice(0, 3).map(h => h.textContent?.trim() || '').filter(t => t.length > 0)
                            };
                        });
                        console.error(`[DEBUG] H1标签数量: ${h1Info.count}`);
                        if (h1Info.texts.length > 0) {
                            console.error(`[DEBUG] H1内容示例:`, h1Info.texts);
                        }
                        
                        // 获取article标签信息
                        const articleInfo = await page.evaluate(() => {
                            const articles = Array.from(document.querySelectorAll('article, [class*="article"], [class*="story"], [class*="content"]'));
                            return {
                                count: articles.length,
                                classes: articles.slice(0, 3).map(a => a.className || '无class')
                            };
                        });
                        console.error(`[DEBUG] Article类元素数量: ${articleInfo.count}`);
                        if (articleInfo.classes.length > 0) {
                            console.error(`[DEBUG] Article类名示例:`, articleInfo.classes);
                        }
                        
                        // 如果是LPGA网站，提供特定提示
                        if (domain.includes('lpga.com')) {
                            console.error(`[提示] LPGA网站已配置专用抓取器，如果仍然失败，可能需要更新选择器`);
                        }
                        
                    } catch (debugError) {
                        console.error('[DEBUG] 获取调试信息失败:', debugError.message);
                    }
                }
                
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
                // 永久标记失败的URL
                this.historyDB.addFailedUrl(url, `文章抓取失败: ${error.message}`, {
                    source: 'batch_processor'
                });
                articles.push(failedArticle);
                
                // 更新失败计数
                this.failedCount++;
                
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
        
        // 显示超时统计
        if (this.timeoutStats.total > 0) {
            console.log(`\n⏱️ 超时统计:`);
            console.log(`   - 总超时数: ${this.timeoutStats.total}`);
            console.log(`   - 按网站分布:`);
            Object.entries(this.timeoutStats.byWebsite).forEach(([site, count]) => {
                console.log(`     ${site}: ${count}篇`);
            });
        }
        
        // 根据配置决定是否显示localhost URL
        if (this.outputConfig.showLocalhostUrls !== false) {
            console.log('\n📱 访问 http://localhost:8080 查看内容');
        }
        
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
            
            // 清理改写进度计时器
            this.clearRewriteProgressInterval();
        }
    }

    /**
     * 计算文章质量评分
     * @param {Object} article - 文章对象
     * @returns {Object} - 包含评分和评分详情的对象
     */
    calculateArticleQuality(article) {
        if (!this.qualityScoring.enabled) {
            return null;
        }

        const scores = {
            length: 0,
            images: 0,
            structure: 0,
            readability: 0,
            keywords: 0
        };
        
        const details = {
            characterCount: 0,
            wordCount: 0,
            paragraphCount: 0,
            imageCount: 0,
            headingCount: 0,
            sentenceCount: 0,
            keywordDensity: 0
        };

        // 使用改写后的内容进行评分
        const content = article.rewrittenContent || article.content || '';
        
        // 1. 文章长度评分 (0-100)
        details.characterCount = content.length;
        details.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        
        // 理想长度：1500-3000字（中文字符）或 500-1000词（英文）
        if (details.characterCount >= 1500 && details.characterCount <= 3000) {
            scores.length = 100;
        } else if (details.characterCount >= 1000 && details.characterCount <= 4000) {
            scores.length = 80;
        } else if (details.characterCount >= 500 && details.characterCount <= 5000) {
            scores.length = 60;
        } else if (details.characterCount < 500) {
            scores.length = Math.max(20, (details.characterCount / 500) * 40);
        } else {
            scores.length = Math.max(40, 100 - ((details.characterCount - 5000) / 100));
        }

        // 2. 图片数量评分 (0-100)
        details.imageCount = (article.images || []).length;
        // 理想：3-6张图片
        if (details.imageCount >= 3 && details.imageCount <= 6) {
            scores.images = 100;
        } else if (details.imageCount >= 2 && details.imageCount <= 8) {
            scores.images = 80;
        } else if (details.imageCount === 1) {
            scores.images = 60;
        } else if (details.imageCount === 0) {
            scores.images = 30;
        } else if (details.imageCount > 8) {
            scores.images = Math.max(50, 100 - ((details.imageCount - 8) * 5));
        }

        // 3. 文章结构评分 (0-100)
        const lines = content.split('\n').filter(line => line.trim());
        details.paragraphCount = lines.filter(line => line.length > 20 && !line.startsWith('#')).length;
        details.headingCount = lines.filter(line => line.startsWith('#')).length;
        
        // 理想结构：有标题，5-15个段落，2-5个子标题
        const hasTitle = lines.some(line => line.startsWith('# '));
        const structureScore = (
            (hasTitle ? 20 : 0) +
            (details.headingCount >= 2 && details.headingCount <= 5 ? 30 : 15) +
            (details.paragraphCount >= 5 && details.paragraphCount <= 15 ? 50 : 25)
        );
        scores.structure = structureScore;

        // 4. 可读性评分 (0-100)
        // 简单评估：平均句长、段落长度等
        details.sentenceCount = content.split(/[。！？.!?]/).filter(s => s.trim()).length;
        const avgSentenceLength = details.wordCount / Math.max(1, details.sentenceCount);
        const avgParagraphLength = details.characterCount / Math.max(1, details.paragraphCount);
        
        // 理想：句子15-25词，段落100-200字
        let readabilityScore = 50;
        if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
            readabilityScore += 25;
        }
        if (avgParagraphLength >= 100 && avgParagraphLength <= 200) {
            readabilityScore += 25;
        }
        scores.readability = readabilityScore;

        // 5. 关键词密度评分 (0-100)
        // 检查高尔夫相关关键词
        const golfKeywords = [
            '高尔夫', 'golf', '球手', '球员', '比赛', '锦标赛', '球场', '挥杆', 
            '推杆', '果岭', '标准杆', '小鸟球', '老鹰球', 'PGA', 'LPGA',
            '大师赛', '公开赛', '巡回赛', '职业', '业余', '球杆', '开球'
        ];
        
        let keywordCount = 0;
        const lowerContent = content.toLowerCase();
        golfKeywords.forEach(keyword => {
            const regex = new RegExp(keyword.toLowerCase(), 'gi');
            const matches = lowerContent.match(regex);
            if (matches) {
                keywordCount += matches.length;
            }
        });
        
        details.keywordDensity = (keywordCount / Math.max(1, details.wordCount)) * 100;
        
        // 理想密度：2-5%
        if (details.keywordDensity >= 2 && details.keywordDensity <= 5) {
            scores.keywords = 100;
        } else if (details.keywordDensity >= 1 && details.keywordDensity <= 7) {
            scores.keywords = 80;
        } else if (details.keywordDensity < 1) {
            scores.keywords = details.keywordDensity * 60;
        } else {
            scores.keywords = Math.max(40, 100 - ((details.keywordDensity - 7) * 10));
        }

        // 计算总分
        const weights = this.qualityScoring.weights;
        const totalScore = Math.round(
            scores.length * weights.length +
            scores.images * weights.images +
            scores.structure * weights.structure +
            scores.readability * weights.readability +
            scores.keywords * weights.keywords
        );

        // 确定质量等级
        let grade = 'poor';
        let gradeEmoji = '❌';
        const thresholds = this.qualityScoring.thresholds;
        
        if (totalScore >= thresholds.excellent) {
            grade = 'excellent';
            gradeEmoji = '🌟';
        } else if (totalScore >= thresholds.good) {
            grade = 'good';
            gradeEmoji = '✨';
        } else if (totalScore >= thresholds.acceptable) {
            grade = 'acceptable';
            gradeEmoji = '✅';
        } else if (totalScore >= thresholds.poor) {
            grade = 'poor';
            gradeEmoji = '⚠️';
        } else {
            grade = 'very_poor';
            gradeEmoji = '❌';
        }

        return {
            totalScore,
            grade,
            gradeEmoji,
            scores,
            details,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 验证文章内容的有效性
     * @param {string} content - 文章内容
     * @param {Object} article - 文章对象
     * @returns {Object} - {isValid: boolean, error: string}
     */
    validateArticleContent(content, article) {
        // 基础验证结果
        const validation = {
            isValid: true,
            error: null,
            details: {}
        };

        // 1. 内容长度验证
        const minContentLength = 1000; // 最小1000字符
        const cleanContent = content.replace(/<!--[\s\S]*?-->/g, ''); // 移除注释
        const actualLength = cleanContent.trim().length;
        
        validation.details.contentLength = actualLength;
        
        if (actualLength < minContentLength) {
            validation.isValid = false;
            validation.error = `内容过短 (${actualLength}字符，最小要求${minContentLength}字符)`;
            return validation;
        }

        // 2. 检查是否为空内容或占位符
        const invalidPatterns = [
            /^测试文章$/,
            /^这是一篇测试文章/,
            /^placeholder/i,
            /^test article/i,
            /^empty content/i,
            /^无内容/,
            /^待填充/
        ];
        
        if (invalidPatterns.some(pattern => pattern.test(cleanContent))) {
            validation.isValid = false;
            validation.error = '检测到占位符或测试内容';
            return validation;
        }

        // 3. 检查必要的文章结构
        const hasTitle = cleanContent.includes('#') || (article.title && article.title.length > 0);
        const hasParagraphs = cleanContent.split('\n\n').filter(p => p.trim().length > 50).length >= 2;
        
        validation.details.hasTitle = hasTitle;
        validation.details.hasParagraphs = hasParagraphs;
        
        if (!hasTitle) {
            validation.isValid = false;
            validation.error = '文章缺少标题';
            return validation;
        }
        
        if (!hasParagraphs) {
            validation.isValid = false;
            validation.error = '文章缺少有效段落（至少需要2个段落，每段50字符以上）';
            return validation;
        }

        // 4. 检查是否包含实质内容
        const words = cleanContent.split(/\s+/).filter(w => w.length > 1);
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        const uniqueRatio = uniqueWords.size / Math.max(1, words.length);
        
        validation.details.wordCount = words.length;
        validation.details.uniqueWords = uniqueWords.size;
        validation.details.uniqueRatio = uniqueRatio;
        
        // 如果独特词汇比例太低，说明可能是重复内容
        if (uniqueRatio < 0.2 && words.length > 50) {
            validation.isValid = false;
            validation.error = '文章内容重复度过高，缺乏实质内容';
            return validation;
        }

        // 5. 检查是否为纯英文内容（应该是中文改写）
        const chineseCharCount = (cleanContent.match(/[\u4e00-\u9fa5]/g) || []).length;
        const chineseRatio = chineseCharCount / cleanContent.length;
        
        validation.details.chineseCharCount = chineseCharCount;
        validation.details.chineseRatio = chineseRatio;
        
        if (chineseRatio < 0.1 && cleanContent.length > 500) {
            validation.isValid = false;
            validation.error = '文章缺少中文内容（中文比例低于10%）';
            return validation;
        }

        // 6. 检查关键组件
        const hasContent = cleanContent.length > minContentLength;
        const hasViewOriginal = content.includes('查看原文') || content.includes(article.url);
        
        validation.details.hasViewOriginal = hasViewOriginal;
        
        if (!hasViewOriginal && article.url && article.url.startsWith('http')) {
            // 不强制要求，但记录警告
            validation.warning = '文章可能缺少原文链接';
        }

        // 7. 最终判断
        if (!hasContent) {
            validation.isValid = false;
            validation.error = '文章内容不完整';
            return validation;
        }

        return validation;
    }

    // 保存单篇文章（实时更新）
    async saveSingleArticle(article) {
        try {
            if (!article.rewrittenContent) {
                return; // 跳过失败的文章
            }

            // 计算文章质量评分
            const qualityResult = this.calculateArticleQuality(article);
            if (qualityResult) {
                article.qualityScore = qualityResult;
                console.log(`  ${qualityResult.gradeEmoji} 文章质量评分: ${qualityResult.totalScore}/100 (${qualityResult.grade})`);
                console.log(`     ├─ 长度: ${qualityResult.scores.length}/100 (${qualityResult.details.characterCount}字符)`);
                console.log(`     ├─ 图片: ${qualityResult.scores.images}/100 (${qualityResult.details.imageCount}张)`);
                console.log(`     ├─ 结构: ${qualityResult.scores.structure}/100 (${qualityResult.details.headingCount}个标题)`);
                console.log(`     ├─ 可读性: ${qualityResult.scores.readability}/100`);
                console.log(`     └─ 关键词: ${qualityResult.scores.keywords}/100 (密度${qualityResult.details.keywordDensity.toFixed(1)}%)`);
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
            
            // 在文件开头添加元数据注释
            let metadataComments = '';
            
            // 添加AI检测结果
            if (article.aiProbability !== null && article.aiProbability !== undefined) {
                metadataComments += `<!-- AI检测: ${article.aiProbability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
                console.log(`  🤖 AI检测结果已添加到内容: ${article.aiProbability}%`);
            }
            
            // 添加质量评分结果
            if (article.qualityScore) {
                const qs = article.qualityScore;
                metadataComments += `<!-- 质量评分: ${qs.totalScore}/100 (${qs.grade}) | ${qs.gradeEmoji} | 评分时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->\n`;
                metadataComments += `<!-- 评分详情: 长度${qs.scores.length} 图片${qs.scores.images} 结构${qs.scores.structure} 可读性${qs.scores.readability} 关键词${qs.scores.keywords} -->\n`;
            }
            
            if (metadataComments) {
                content = metadataComments + content;
            }
            
            // 🛡️ 内容验证 - 防止保存无效文章
            const contentValidation = this.validateArticleContent(content, article);
            if (!contentValidation.isValid) {
                const validationError = new Error(`文章内容验证失败: ${contentValidation.error}`);
                validationError.validationDetails = contentValidation;
                console.error(`  ❌ 文章验证失败:`);
                console.error(`     - 错误: ${contentValidation.error}`);
                console.error(`     - 内容长度: ${content.length} 字符`);
                console.error(`     - 最小要求: 1000 字符`);
                console.error(`     - 建议: 确保文章通过正常流程处理`);
                
                // 记录失败并抛出错误，防止标记为成功
                this.apiFailureHandler.logFailedArticle(article.url, `内容验证失败: ${contentValidation.error}`);
                this.historyDB.addFailedUrl(article.url, `内容验证失败: ${contentValidation.error}`, {
                    source: 'content_validation',
                    articleNum: num,
                    contentLength: content.length
                });
                
                throw validationError;
            }
            
            console.log(`  ✅ 内容验证通过 (${content.length} 字符)`);
            
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
            
            // 异步执行AI检测（不阻塞主流程）
            if (article.aiProbability === null || article.aiProbability === undefined) {
                console.log(`  🔍 异步执行AI检测（不阻塞主流程）...`);
                this.performAsyncAIDetection(mdFile, content, article).catch(error => {
                    console.error(`  ⚠️ 异步AI检测失败: ${error.message}`);
                });
            }
            
            // 🆕 更新历史数据库，记录已处理的URL
            try {
                this.historyDB.addProcessedUrl(article.url, {
                    articleNum: num,
                    title: article.title,
                    siteName: article.sourceSite || this.getDomainFromUrl(article.url),
                    date: this.dateStr,
                    status: 'completed',
                    aiProbability: article.aiProbability,
                    rewriteCount: article.rewriteCount || 0,
                    mdFile: path.basename(mdFile),
                    htmlFile: path.basename(htmlFile)
                });
                console.log(`  📝 已更新历史数据库`);
            } catch (dbError) {
                console.error(`  ⚠️ 更新历史数据库失败: ${dbError.message}`);
                // 不影响主流程
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
        
        // 添加质量评分卡片
        if (article.qualityScore) {
            const qs = article.qualityScore;
            const scoreColor = qs.totalScore >= 85 ? '#4caf50' : 
                             qs.totalScore >= 70 ? '#2196f3' : 
                             qs.totalScore >= 50 ? '#ff9800' : '#f44336';
            
            const qualityCard = `
            <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid ${scoreColor};">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 24px; margin-right: 10px;">${qs.gradeEmoji}</span>
                    <h3 style="margin: 0; color: #333;">文章质量评分：${qs.totalScore}/100</h3>
                    <span style="margin-left: 10px; padding: 2px 8px; background: ${scoreColor}; color: white; border-radius: 4px; font-size: 12px;">${qs.grade.toUpperCase()}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; font-size: 13px;">
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: #666;">文章长度</div>
                        <div style="font-size: 18px; color: ${scoreColor};">${qs.scores.length}</div>
                        <div style="color: #999; font-size: 11px;">${qs.details.characterCount}字符</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: #666;">图片数量</div>
                        <div style="font-size: 18px; color: ${scoreColor};">${qs.scores.images}</div>
                        <div style="color: #999; font-size: 11px;">${qs.details.imageCount}张图片</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: #666;">文章结构</div>
                        <div style="font-size: 18px; color: ${scoreColor};">${qs.scores.structure}</div>
                        <div style="color: #999; font-size: 11px;">${qs.details.headingCount}个标题</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: #666;">可读性</div>
                        <div style="font-size: 18px; color: ${scoreColor};">${qs.scores.readability}</div>
                        <div style="color: #999; font-size: 11px;">${qs.details.paragraphCount}个段落</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: #666;">关键词密度</div>
                        <div style="font-size: 18px; color: ${scoreColor};">${qs.scores.keywords}</div>
                        <div style="color: #999; font-size: 11px;">${qs.details.keywordDensity.toFixed(1)}%</div>
                    </div>
                </div>
            </div>`;
            
            // 在内容开头插入质量评分卡片
            htmlContent = qualityCard + '\n' + htmlContent;
        }
        
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
                'skysports.com': 'Sky Sports'
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
            // 使用本地检测模式，100%可靠
            this.aiDetector.detectionMode = 'local';
            console.log('  🔍 已初始化本地AI检测器（启发式算法）');
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
                
                const detectTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                console.log(`[${detectTimestamp}]  🤖 AI检测开始 | 第${rewriteCount + 1}次检测`);
                aiProbability = await this.aiDetector.detectText(textContent);
                
                if (aiProbability === null) {
                    console.log(`[${detectTimestamp}]  ⚠️ AI检测失败，保留当前版本`);
                    break;
                }
                
                const resultTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                console.log(`[${resultTimestamp}]  📊 AI检测结果 | AI率: ${aiProbability}% | ${aiProbability > 40 ? '需要重写' : '通过'}`);
                
                // 如果AI率低于或等于40%，或已达到最大重写次数，结束循环
                if (aiProbability <= 40 || rewriteCount >= maxRetries) {
                    if (aiProbability > 40 && rewriteCount >= maxRetries) {
                        const warnTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                        console.log(`[${warnTimestamp}]  ⚠️ 已达最大重写次数(${maxRetries}次)，保留当前版本 (AI率: ${aiProbability}%)`);
                    } else if (aiProbability <= 40) {
                        const passTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                        console.log(`[${passTimestamp}]  ✅ AI检测通过，无需重写`);
                    }
                    break;
                }
                
                // AI率大于40%且未达到最大重写次数，进行重写
                const rewriteStartTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                console.log(`[${rewriteStartTimestamp}]  🔄 自动重写 | AI率过高(${aiProbability}%)，进行第${rewriteCount + 1}次重写...`);
                
                // 重新改写文章
                const newContent = await this.rewriter.rewriteArticle(
                    article.title,
                    processedContent,
                    article.url
                );
                
                if (newContent) {
                    currentContent = newContent;
                    rewriteCount++;
                    const rewriteDoneTimestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    console.log(`[${rewriteDoneTimestamp}]  ✅ 自动重写完成 | 第${rewriteCount}次重写成功`);
                    
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
     * 异步执行AI检测（不阻塞主流程）
     * @param {string} mdFile - MD文件路径
     * @param {string} content - 文章内容
     * @param {Object} article - 文章对象
     */
    async performAsyncAIDetection(mdFile, content, article) {
        try {
            // 使用子进程执行AI检测，避免阻塞主进程
            const { spawn } = require('child_process');
            const detector = spawn('node', [
                path.join(__dirname, 'ai_content_detector_enhanced.js'),
                '--file', mdFile
            ], {
                detached: true,
                stdio: 'ignore'
            });
            
            // 让子进程独立运行
            detector.unref();
            
            console.log(`  🚀 AI检测已在后台启动，不影响主流程`);
            
        } catch (error) {
            // 静默处理错误，不影响主流程
            console.error(`  ⚠️ 启动异步AI检测失败: ${error.message}`);
        }
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
    
    /**
     * 判断是否应该尝试恢复
     * @param {Error} error - 错误对象
     * @returns {boolean} - 是否应该尝试恢复
     */
    shouldAttemptRecovery(error) {
        // 检查最近的错误频率
        const recentErrors = this.rewriteErrorRecovery.errorHistory.filter(e => 
            new Date() - new Date(e.timestamp) < 300000 // 5分钟内
        );
        
        // 如果5分钟内错误太多，不再尝试恢复
        if (recentErrors.length > 5) {
            console.log(`  ⚠️ 错误频率过高，跳过恢复尝试`);
            return false;
        }
        
        // 某些错误类型不尝试恢复
        const nonRecoverableErrors = ['内容无效', '文章不存在'];
        if (nonRecoverableErrors.some(err => error.message.includes(err))) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 异步等待
     * @param {number} ms - 等待时间（毫秒）
     * @returns {Promise} - 等待Promise
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 加载输出配置
     */
    loadOutputConfig() {
        try {
            const configFile = path.join(__dirname, 'output_config.json');
            if (fs.existsSync(configFile)) {
                return JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (error) {
            console.log('⚠️ 无法加载输出配置，使用默认设置');
        }
        // 默认配置
        return {
            showLocalhostUrls: true,
            showWebInterface: true,
            quietMode: false,
            logLevel: 'info'
        };
    }
    
}

// 命令行执行
if (require.main === module) {
    const processor = new BatchArticleProcessor();
    
    // 检查是否使用 --process-all-failed 参数
    if (process.argv.includes('--process-all-failed')) {
        console.log('🔄 处理所有历史失败的文章模式\n');
        
        // 进程退出时清理计时器
        process.on('exit', () => {
            processor.clearRewriteProgressInterval();
        });
        
        process.on('SIGINT', () => {
            processor.clearRewriteProgressInterval();
            process.exit();
        });
        
        process.on('SIGTERM', () => {
            processor.clearRewriteProgressInterval();
            process.exit();
        });
        
        // 扫描并处理所有失败的URL
        processor.scanAllFailedUrls().then(failedUrls => {
            if (failedUrls.length === 0) {
                console.log('✅ 没有找到需要处理的失败文章');
                process.exit(0);
            }
            
            // 使用特殊的urlFile标识
            return processor.processArticles(failedUrls, { 
                urlFile: 'all_failed_articles',
                skipDuplicateCheck: false  // 不跳过重复检查，让系统正常处理
            });
        }).catch(console.error);
        
        return;
    }
    
    // 原有逻辑：从文件读取URL
    const filename = process.argv[2];
    
    if (!filename) {
        console.error('❌ 请提供文章URL列表文件');
        console.error('\n用法:');
        console.error('  处理URL文件: node batch_process_articles.js <文件名> [--retry-failed]');
        console.error('  处理所有失败: node batch_process_articles.js --process-all-failed');
        console.error('\n选项:');
        console.error('  --retry-failed      只处理文件中失败的URL');
        console.error('  --process-all-failed 自动扫描并处理所有历史失败的文章');
        process.exit(1);
    }
    
    try {
        // 读取文件内容
        const content = fs.readFileSync(filename, 'utf8');
        const urls = content.split('\n')
            .filter(url => {
                const trimmed = url.trim();
                // 过滤掉空行和注释行（以#开头的行）
                return trimmed && !trimmed.startsWith('#') && trimmed.startsWith('http');
            });
        
        if (urls.length === 0) {
            console.error('❌ 文件为空或没有有效的URL');
            process.exit(1);
        }
        
        console.log(`📋 从 ${filename} 读取到 ${urls.length} 个URL`);
        
        // 进程退出时清理计时器
        process.on('exit', () => {
            processor.clearRewriteProgressInterval();
        });
        
        process.on('SIGINT', () => {
            processor.clearRewriteProgressInterval();
            process.exit();
        });
        
        process.on('SIGTERM', () => {
            processor.clearRewriteProgressInterval();
            process.exit();
        });
        
        // 传递文件名作为urlFile参数
        processor.processArticles(urls, { urlFile: path.basename(filename) }).catch(console.error);
    } catch (error) {
        console.error(`❌ 读取文件失败: ${error.message}`);
        process.exit(1);
    }
}

module.exports = BatchArticleProcessor;