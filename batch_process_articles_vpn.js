#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');
const ImageProcessorFinal = require('./image_processor_final');
// const WebsiteDuplicateChecker = require('./website_duplicate_checker'); // 🔧 不再使用本地检查
// const ArticleStateManager = require('./article_state_manager'); // 🚫 已移除复杂状态管理器
const APIFailureHandler = require('./api_failure_handler');
const generateEnhancedHTML = require('./enhanced_html_template');
const SiteSpecificScrapers = require('./site_specific_scrapers');
const ContentPositionImageFilter = require('./content_position_image_filter'); // 🆕 智能图片过滤系统
// const { buildHistoryDatabase, normalizeUrl } = require('./build_history_database_optimized'); // 🚫 已移除复杂历史数据库
const ContentFreshnessDetector = require('./content_freshness_detector'); // 🚀 真正的内容新鲜度检测
const BatchProgressTracker = require('./batch_progress_tracker'); // 📊 批量处理进度追踪

// 🆕 进度更新系统 - 使用文件系统替代WebSocket
// 统一进度管理器 - 遵循"只留一个最优方案"原则
const progressManager = require('./unified_progress_manager');
console.log('✅ 进度更新系统已启动（文件系统模式）');
let webSocketBroadcast = null; // 保留兼容性

// 加载稳定性配置
let stabilityConfig = {};
try {
    stabilityConfig = require('./stability_config.json');
} catch (e) {
    console.log('⚠️  未找到stability_config.json，使用默认配置');
}

// 🚀 VPN兼容配置
let vpnConfig = {};
try {
    vpnConfig = require('./vpn_compatible_config.json');
    console.log('🛡️  VPN兼容模式已启用');
} catch (e) {
    console.log('ℹ️  未找到VPN兼容配置，使用标准模式');
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
            
            // 🛡️ VPN兼容浏览器启动参数
            const launchArgs = vpnConfig.vpn_compatible_mode 
                ? vpnConfig.browser_config.vpn_safe_args 
                : [
                    '--no-sandbox',
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ];
            
            if (vpnConfig.vpn_compatible_mode) {
                console.log('🛡️  使用VPN安全启动参数');
            } else {
                console.log('⚠️  使用标准启动参数（可能与VPN冲突）');
            }

            const browser = await chromium.launch({
                headless: true,
                args: launchArgs.concat([
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ]),
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
        
        // 🛡️ VPN兼容界面模式启动参数
        const headfulArgs = vpnConfig.vpn_compatible_mode 
            ? vpnConfig.browser_config.vpn_safe_args.concat([
                '--start-minimized',
                '--window-size=800,600', 
                '--window-position=9999,9999'
            ])
            : [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-minimized',
                '--window-size=800,600',
                '--window-position=9999,9999',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security'
            ];

        if (vpnConfig.vpn_compatible_mode) {
            console.log('🛡️  界面模式使用VPN安全启动参数');
        }
        
        const browser = await chromium.launch({
            headless: false,
            args: headfulArgs,
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
        // this.stateManager = new ArticleStateManager(); // 🚫 已移除复杂状态管理器
        this.imageFilter = new ContentPositionImageFilter(); // 🆕 智能图片过滤器
        this.processingStartTime = Date.now(); // 记录开始时间
        
        // 🆕 修复内存泄漏 - 增加事件监听器限制
        process.setMaxListeners(20);
        
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
                'golfdigest.com': {
                    selectors: {
                        title: 'h1, .content-header h1, .article-header h1, [data-testid="ContentHeaderHed"]',
                        article: 'article, .article-body, .content-body, [data-testid="BodyWrapper"]',
                        content: 'p, h2, h3',
                        heroImage: '.hero-image img, .lead-image img, .featured-image img, .content-header img, [data-testid="Lede"] img, article img:first-of-type',
                        contentImages: 'figure img, .content-body img'
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

    // 🆕 进度更新方法 - 写入文件系统
    broadcastProgress(type, payload) {
        // 进度更新已经在适当的地方通过progressManager处理
        
        // 保留WebSocket兼容性（如果存在）
        if (webSocketBroadcast && webSocketBroadcast.broadcastToAll) {
            try {
                webSocketBroadcast.broadcastToAll(type, payload);
            } catch (error) {
                // 静默处理广播失败
            }
        }
    }

    broadcastCurrentArticle(title, url, status = 'processing') {
        this.broadcastProgress('current_article', {
            title: title || '处理中...',
            url: url || '',
            status: status
        });
    }

    broadcastStats() {
        try {
            const dates = this.getAllDates();
            const completed = dates.reduce((sum, date) => sum + date.count, 0);
            
            // 读取失败文章数据
            const failedPath = path.join(process.cwd(), 'failed_articles.json');
            let failed = 0;
            if (fs.existsSync(failedPath)) {
                const failedData = JSON.parse(fs.readFileSync(failedPath, 'utf8'));
                failed = Object.keys(failedData).length;
            }
            
            this.broadcastProgress('stats', {
                completed,
                failed,
                queue: 0,
                retries: 0
            });
        } catch (error) {
            // 静默处理错误
        }
    }

    broadcastActivity(source, title, status) {
        this.broadcastProgress('activity', {
            time: new Date().toISOString(),
            source: source || 'System',
            title: title || '处理活动',
            status: status || 'processing'
        });
    }

    getAllDates() {
        const dates = [];
        const baseDir = 'golf_content';
        
        try {
            if (!fs.existsSync(baseDir)) return dates;
            
            const dateDirs = fs.readdirSync(baseDir)
                .filter(dir => {
                    const fullPath = path.join(baseDir, dir);
                    return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
                })
                .sort().reverse();
            
            dateDirs.forEach(dateDir => {
                const htmlDir = path.join(baseDir, dateDir, 'wechat_html');
                if (fs.existsSync(htmlDir)) {
                    const htmlFiles = fs.readdirSync(htmlDir)
                        .filter(file => file.endsWith('.html'));
                    
                    if (htmlFiles.length > 0) {
                        dates.push({
                            date: dateDir,
                            count: htmlFiles.length
                        });
                    }
                }
            });
            
            return dates;
        } catch (e) {
            return [];
        }
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
                    // 🛡️ 始终执行全局去重检查，防止重复处理
                    // 全局去重检查
                    const { checkGlobalDuplicate } = require('./check_global_duplicates');
                    const globalCheck = checkGlobalDuplicate(url);
                    
                    const todayDate = new Date().toISOString().split('T')[0];
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
    /**
     * 🚀 简化URL重复检测系统 - 基于实际输出文件
     * 替换原有的复杂4层检测系统，直接基于实际输出文件进行URL去重
     */
    async checkUrlsForDuplicates(urls, skipDuplicateCheck = false) {
        try {
            if (skipDuplicateCheck) {
                console.log(`⚡ 跳过重复检查，将处理所有 ${urls.length} 个URL`);
                return {
                    newUrls: urls,
                    duplicateUrls: [],
                    skippedCount: 0
                };
            }
            
            console.log(`🔍 URL重复检测：使用统一历史数据库（${urls.length} 个URL）...`);
            
            // 使用统一历史数据库 - 按照设计原则只保留一个最优方案
            const UnifiedHistoryDatabase = require('./unified_history_database');
            const historyDatabase = new UnifiedHistoryDatabase();
            
            // 使用批量检查方法，会自动判断状态（只有completed才跳过）
            const checkResult = historyDatabase.batchCheckUrls(urls);
            
            // 显示详细的检查结果
            checkResult.duplicateUrls.forEach(dup => {
                console.log(`🚫 已处理过: ${dup.url}`);
                console.log(`   状态: ${dup.status}, 日期: ${dup.originalDate}`);
            });
            
            checkResult.newUrls.forEach(url => {
                console.log(`✅ 待处理: ${url}`);
            });
            
            console.log(`\n📊 重复检测结果:`);
            console.log(`  ✅ 新URL: ${checkResult.newUrls.length} 个`);
            console.log(`  🚫 已完成: ${checkResult.duplicateUrls.length} 个`);
            console.log(`  📈 去重效率: ${((checkResult.duplicateUrls.length / urls.length) * 100).toFixed(1)}%`);
            
            // 显示数据库状态
            const dbStatus = historyDatabase.getStatus();
            console.log(`  📚 历史数据库: ${dbStatus.totalUrls} 条记录`);
            
            console.log(`\n🚀 重复检测完成：将处理 ${checkResult.newUrls.length} 个新URL\n`);
            
            return {
                newUrls: checkResult.newUrls,
                duplicateUrls: checkResult.duplicateUrls.map(d => d.url),
                skippedCount: checkResult.duplicateUrls.length
            };
            
        } catch (error) {
            console.error('❌ URL检测失败:', error.message);
            console.log('⚠️ 检测失败，将处理所有URL以确保不遗漏');
            
            // 保守回退策略：如果检测失败，处理所有URL
            return {
                newUrls: urls,
                duplicateUrls: [],
                skippedCount: 0,
                fallbackMode: true
            };
        }
    }

    /**
     * 🛡️ 企业级容错系统初始化
     */
    async initializeResilienceSystem() {
        // 网络断线检测和重连
        this.networkMonitor = {
            isOnline: true,
            retryAttempts: 0,
            maxRetries: 5,
            retryDelay: 30000 // 30秒
        };
        
        // 进程状态监控
        this.processState = {
            isRunning: true,
            lastHeartbeat: Date.now(),
            processId: process.pid,
            resumeFile: `./resume_state_${Date.now()}.json`
        };
        
        // 自动保存进度
        this.progressSaver = {
            saveInterval: 60000, // 每分钟保存
            lastSave: Date.now()
        };
        
        console.log('🛡️ 容错系统已启动:');
        console.log(`   📱 进程ID: ${this.processState.processId}`);
        console.log(`   💾 恢复文件: ${this.processState.resumeFile}`);
        
        // 设置信号处理器
        this.setupSignalHandlers();
        
        // 启动心跳检测
        this.startHeartbeat();
        
        // 检查是否有未完成的任务
        await this.checkForUnfinishedTasks();
    }
    
    /**
     * 🚨 信号处理器 - 优雅关闭
     */
    setupSignalHandlers() {
        const gracefulShutdown = async (signal) => {
            console.log(`\n🚨 接收到${signal}信号，开始优雅关闭...`);
            this.processState.isRunning = false;
            
            try {
                // 保存当前进度
                await this.saveProgress();
                
                // 关闭浏览器
                if (this.browser) {
                    console.log('🌐 关闭浏览器...');
                    await this.browser.close();
                }
                
                console.log('✅ 优雅关闭完成，可安全重启');
                process.exit(0);
            } catch (error) {
                console.error('❌ 关闭过程出错:', error.message);
                process.exit(1);
            }
        };
        
        // 监听各种退出信号 (🔒 独立模式下禁用SIGTERM)
        process.on('SIGINT', gracefulShutdown);   // Ctrl+C
        
        // 🔒 只在非独立模式下监听SIGTERM，避免被意外终止
        if (!process.env.DISABLE_SIGTERM) {
            process.on('SIGTERM', gracefulShutdown);  // 系统终止
            console.log('🛡️ SIGTERM监听已启用');
        } else {
            console.log('🔒 独立模式：SIGTERM监听已禁用，提高稳定性');
        }
        
        process.on('SIGHUP', gracefulShutdown);   // 终端关闭
        
        // 监听未捕获异常
        process.on('uncaughtException', async (error) => {
            console.error('🚨 未捕获异常:', error);
            await this.saveProgress();
            process.exit(1);
        });
        
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('🚨 未处理的Promise拒绝:', reason);
            await this.saveProgress();
        });
    }
    
    /**
     * 💓 心跳检测 - 监控系统健康
     */
    startHeartbeat() {
        setInterval(async () => {
            if (!this.processState.isRunning) return;
            
            this.processState.lastHeartbeat = Date.now();
            
            // 检查网络连接
            await this.checkNetworkHealth();
            
            // 定期保存进度
            if (Date.now() - this.progressSaver.lastSave > this.progressSaver.saveInterval) {
                await this.saveProgress();
            }
            
        }, 30000); // 每30秒心跳
    }
    
    /**
     * 🌐 网络健康检查
     */
    async checkNetworkHealth() {
        try {
            // 尝试连接Claude API
            const response = await fetch('https://api.anthropic.com', { 
                method: 'HEAD',
                timeout: 10000 
            });
            
            if (this.networkMonitor.isOnline === false) {
                console.log('🌐 网络连接已恢复');
                this.networkMonitor.isOnline = true;
                this.networkMonitor.retryAttempts = 0;
            }
        } catch (error) {
            if (this.networkMonitor.isOnline === true) {
                console.log('⚠️ 网络连接异常，启用离线模式');
                this.networkMonitor.isOnline = false;
            }
        }
    }
    
    /**
     * 💾 保存处理进度
     */
    async saveProgress() {
        try {
            const progressData = {
                timestamp: new Date().toISOString(),
                processId: this.processState.processId,
                isRunning: this.processState.isRunning,
                networkStatus: this.networkMonitor.isOnline,
                lastHeartbeat: this.processState.lastHeartbeat
            };
            
            fs.writeFileSync(this.processState.resumeFile, JSON.stringify(progressData, null, 2));
            this.progressSaver.lastSave = Date.now();
            
        } catch (error) {
            console.error('❌ 保存进度失败:', error.message);
        }
    }
    
    /**
     * 🔍 检查未完成任务
     */
    async checkForUnfinishedTasks() {
        try {
            // 🔧 修复：不调用不存在的initialize方法，直接检查系统状态
            console.log('🔄 检查系统中的未完成任务...');
        } catch (error) {
            console.log('⚠️ 检查未完成任务失败:', error.message);
        }
    }

    async processArticles(urls, options = {}) {
        console.log('🚀 批量处理文章（企业级容错版）');
        
        // 🛡️ 初始化容错机制
        await this.initializeResilienceSystem();
        
        // 解析选项
        const { skipDuplicateCheck = false, autoRestart = true } = options;
        
        // 🆕 重新运行URL抓取流程，获取最新的未处理URL
        console.log('1️⃣ 重新抓取最新URL并筛选未处理文章...\n');
        const IntelligentUrlMaster = require('./intelligent_url_master');
        const urlMaster = new IntelligentUrlMaster();
        
        let newUrls = [];
        let duplicateUrls = [];
        
        // 如果没有传入URL，则自动抓取最新URL
        if (urls.length === 0) {
            try {
                // 生成并筛选URL（会自动过滤已处理的）
                console.log('📡 正在抓取最新文章URL...');
                const result = await urlMaster.generateAndFilterUrls('all');
                
                // 从结果中获取新的URL
                let freshUrls = [];
                if (result.final && result.final.urlFiles && result.final.urlFiles.length > 0) {
                    // 读取生成的URL文件
                    const fs = require('fs');
                    for (const urlFile of result.final.urlFiles) {
                        if (fs.existsSync(urlFile)) {
                            const content = fs.readFileSync(urlFile, 'utf8');
                            const fileUrls = content.split('\n').filter(url => url.trim());
                            freshUrls = freshUrls.concat(fileUrls);
                            console.log(`📋 从 ${urlFile} 读取到 ${fileUrls.length} 个URL`);
                        }
                    }
                }
                
                console.log(`\n🔍 URL筛选结果:`);
                console.log(`   🆕 筛选后的URL总数: ${freshUrls.length}`);
                console.log(`   📊 筛选效率: ${result.filtering ? result.filtering.filterRate : '计算中'}`);
                console.log(`   📈 抓取效率: ${result.efficiency ? result.efficiency.urlExtractionRate : '计算中'}`);
                
                if (freshUrls.length === 0) {
                    console.log('\n✅ 暂无新文章需要处理');
                    console.log('💡 提示: 系统已自动筛选，避免重复处理相同文章');
                    console.log('👋 程序退出');
                    return;
                }
                
                // 使用筛选后的URL继续处理
                newUrls = freshUrls;
                console.log(`\n📊 开始处理 ${newUrls.length} 篇文章\n`);
                
            } catch (error) {
                console.error('❌ URL抓取失败:', error.message);
                console.log('👋 程序退出');
                return;
            }
        } else {
            // 传入了URL列表，直接使用（不进行额外的重复检测）
            // 按照"只留一个最优方案"原则，信任传入的URL列表
            console.log(`📋 使用传入的 ${urls.length} 个URL`);
            newUrls = urls;
            
            // 如果用户明确指定跳过重复检测，或者有其他标记
            if (skipDuplicateCheck) {
                console.log('⚡ 跳过重复检查，将处理所有URL');
            }
        }
        
        // 📊 初始化批量处理进度追踪
        const progressTracker = new BatchProgressTracker();
        progressTracker.initialize(newUrls.length, process.pid);
        
        // 🆕 广播处理开始
        this.broadcastProgress('progress', {
            percentage: 0,
            current: 0,
            total: newUrls.length,
            eta: '计算中...'
        });
        this.broadcastStats();
        this.broadcastActivity('Batch Processor', `开始处理 ${newUrls.length} 篇文章`, 'processing');
        
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
        
        // 初始化进度系统
        progressManager.initBatchProcessing(newUrls.length);
        
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
            
            // 📊 更新进度追踪器
            progressTracker.updateCurrentArticle(i + 1, url, 'fetching', `开始处理文章 ${articleNum}`);
            
            // 更新进度文件
            progressManager.updateCurrentArticle(i + 1, newUrls.length, url);
            
            // 🆕 广播当前处理的文章
            this.broadcastCurrentArticle(`处理第 ${i + 1}/${newUrls.length} 篇文章`, url, 'processing');
            
            // 🆕 广播进度更新
            const progressPercentage = (i / newUrls.length) * 100;
            const elapsed = Date.now() - totalStart;
            const averageTime = elapsed / (i || 1);
            const remaining = (newUrls.length - i) * averageTime;
            const eta = remaining > 0 ? `${Math.round(remaining / 60000)}分钟` : '即将完成';
            
            this.broadcastProgress('progress', {
                percentage: progressPercentage,
                current: i + 1,
                total: newUrls.length,
                eta: eta
            });
            
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
            progressTracker.updateCurrentArticle(i + 1, url, 'fetching', '正在抓取文章内容');
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
                    
                    // 🔧 Golf Digest主图修复：优先处理heroImage
                    const isGolfDigest = pageUrl.includes('golfdigest.com');
                    if (isGolfDigest && selectors.heroImage) {
                        const heroImageElement = document.querySelector(selectors.heroImage);
                        if (heroImageElement && heroImageElement.src) {
                            const alt = heroImageElement.alt || 'Golf Digest主图';
                            images.push({ 
                                url: heroImageElement.src, 
                                alt: alt,
                                width: heroImageElement.naturalWidth || heroImageElement.width,
                                height: heroImageElement.naturalHeight || heroImageElement.height,
                                element: heroImageElement.outerHTML,
                                isHeroImage: true // 标记为主图
                            });
                            // 在标题后立即插入主图占位符
                            content += `[HERO_IMAGE_PLACEHOLDER:0]\n\n`;
                        }
                    }
                    
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
                            
                            // GolfWRX特殊处理：保留图片链接，移除其他链接
                            if (isGolfWRX) {
                                const clonedElement = element.cloneNode(true);
                                // 只移除不包含图片的链接标签
                                clonedElement.querySelectorAll('a:not(:has(img))').forEach(a => {
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
                        // 图片处理将在后续使用智能过滤器统一处理
                        else if (element.tagName === 'IMG' || element.tagName === 'FIGURE') {
                            // 临时收集所有图片，后续用智能过滤器处理
                            const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
                            if (img && img.src) {
                                // 🔧 Golf Digest修复：跳过已经作为主图处理的图片
                                const isAlreadyHeroImage = isGolfDigest && images.length > 0 && 
                                    images[0].isHeroImage && images[0].url === img.src;
                                
                                if (!isAlreadyHeroImage) {
                                    // 简单收集，智能过滤在后面统一进行
                                    const alt = img.alt || element.querySelector('figcaption')?.innerText || '';
                                    images.push({ 
                                        url: img.src, 
                                        alt: alt,
                                        width: img.naturalWidth || img.width,
                                        height: img.naturalHeight || img.height,
                                        element: img.outerHTML // 保存元素信息供后续分析
                                    });
                                    // 先插入临时占位符，后续会被智能过滤器替换
                                    content += `[TEMP_IMAGE_PLACEHOLDER:${images.length - 1}]\n\n`;
                                }
                            }
                        }
                    });
                    
                    return { title, content, images };
                }, {selectors, pageUrl: url});
                
                // 对于特定网站，优先使用网站特定抓取
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace('www.', '');
                
                // MyGolfSpy 需要特殊处理懒加载图片
                if (domain === 'mygolfspy.com') {
                    console.log('🔧 使用MyGolfSpy专用抓取器...');
                    try {
                        const specificContent = await this.siteSpecificScrapers.scrapeArticleContent(page, domain);
                        if (specificContent) {
                            console.log('✅ MyGolfSpy专用抓取成功');
                            data = specificContent;
                        }
                    } catch (error) {
                        console.error('❌ MyGolfSpy专用抓取失败:', error.message);
                    }
                }
                
                // GolfWRX 需要特殊处理图片链接和社区内容
                if (domain === 'golfwrx.com') {
                    console.log('🔧 使用GolfWRX专用抓取器...');
                    try {
                        const specificContent = await this.siteSpecificScrapers.scrapeArticleContent(page, domain);
                        if (specificContent) {
                            console.log('✅ GolfWRX专用抓取成功');
                            data = specificContent;
                        }
                    } catch (error) {
                        console.error('❌ GolfWRX专用抓取失败:', error.message);
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
                
                // 🚀 内容新鲜度检测 - 在处理前检查内容是否真正新鲜
                console.log('🔍 执行内容新鲜度检测...');
                const freshnessDetector = new ContentFreshnessDetector();
                const freshnessResult = freshnessDetector.checkContentFreshness({
                    content: data.content,
                    title: data.title,
                    url: url,
                    publishDate: data.publishDate || null
                });
                
                if (!freshnessResult.isFresh) {
                    console.log(`❌ 内容不新鲜，跳过处理: ${freshnessResult.message}`);
                    console.log(`📝 标题: ${data.title}`);
                    console.log(`🔗 URL: ${url}`);
                    await page.close();
                    continue; // 跳过此文章，继续处理下一篇
                }
                
                console.log(`✅ 内容新鲜，继续处理: ${freshnessResult.message}`);
                
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
                
                // 🆕 使用智能图片过滤系统
                if (data.images && data.images.length > 0) {
                    console.log(`  🔍 智能图片过滤：${data.images.length} 张原始图片`);
                    
                    try {
                        // 使用智能过滤器分析图片
                        const filterResult = await this.imageFilter.filterImagesByPosition(page, url);
                        
                        if (filterResult.validImages && filterResult.validImages.length > 0) {
                            // 更新图片数据为过滤后的结果
                            data.images = filterResult.validImages.map(img => ({
                                url: img.src,
                                alt: img.alt
                            }));
                            
                            console.log(`  ✅ 智能过滤完成：${data.images.length} 张有效图片`);
                            console.log(`     排除原因统计:`);
                            
                            // 统计排除原因
                            const rejectionStats = {};
                            filterResult.rejectedImages.forEach(rejected => {
                                rejected.reasons.forEach(reason => {
                                    rejectionStats[reason] = (rejectionStats[reason] || 0) + 1;
                                });
                            });
                            
                            Object.entries(rejectionStats).forEach(([reason, count]) => {
                                console.log(`       - ${reason}: ${count} 张`);
                            });
                            
                            // 更新内容中的占位符
                            // 首先处理主图占位符
                            data.content = data.content.replace(/\[HERO_IMAGE_PLACEHOLDER:0\]/g, () => {
                                if (data.images.length > 0 && data.images[0].isHeroImage) {
                                    const img = data.images[0];
                                    return `[IMAGE_1:${img.alt}]`;
                                }
                                return '';
                            });
                            
                            // 然后处理其他图片占位符
                            let imageCounter = data.images.length > 0 && data.images[0].isHeroImage ? 1 : 0;
                            data.content = data.content.replace(/\[TEMP_IMAGE_PLACEHOLDER:\d+\]/g, () => {
                                imageCounter++;
                                if (imageCounter <= data.images.length) {
                                    const img = data.images[imageCounter - 1];
                                    return `[IMAGE_${imageCounter}:${img.alt}]`;
                                } else {
                                    return ''; // 移除多余的占位符
                                }
                            });
                            
                        } else {
                            console.log(`  ⚠️  智能过滤后无有效图片`);
                            data.images = [];
                            // 移除所有图片占位符
                            data.content = data.content.replace(/\[HERO_IMAGE_PLACEHOLDER:0\]/g, '');
                            data.content = data.content.replace(/\[TEMP_IMAGE_PLACEHOLDER:\d+\]/g, '');
                        }
                        
                    } catch (filterError) {
                        console.error('  ❌ 智能图片过滤失败，使用原始图片列表:', filterError.message);
                        // 保持原有图片，移除临时占位符并使用标准占位符
                        // 首先处理主图占位符
                        data.content = data.content.replace(/\[HERO_IMAGE_PLACEHOLDER:0\]/g, () => {
                            if (data.images.length > 0 && data.images[0].isHeroImage) {
                                const img = data.images[0];
                                return `[IMAGE_1:${img.alt}]`;
                            }
                            return '';
                        });
                        
                        // 然后处理其他图片占位符
                        let imageCounter = data.images.length > 0 && data.images[0].isHeroImage ? 1 : 0;
                        data.content = data.content.replace(/\[TEMP_IMAGE_PLACEHOLDER:\d+\]/g, () => {
                            imageCounter++;
                            if (imageCounter <= data.images.length) {
                                const img = data.images[imageCounter - 1];
                                return `[IMAGE_${imageCounter}:${img.alt}]`;
                            } else {
                                return '';
                            }
                        });
                    }
                }
                
                // 使用封装的图片处理器下载图片
                // 🔧 修复：直接使用最终编号，避免覆盖
                // 传递文章URL以便为不同网站使用特定的处理器
                const currentDate = new Date().toISOString().split('T')[0];
                
                // 只有当有图片时才处理图片
                if (data.images && data.images.length > 0) {
                    data.images = await this.imageProcessor.downloadImages(this.browser, data.images, articleNum, currentDate, url);
                }
                
                console.log(`  ✅ 文章${articleNum} 抓取完成 (${data.images.length}张图片)`);
                
                const article = {
                    ...data,
                    url,
                    articleNum,  // 最终编号
                    images: data.images
                };
                
                await page.close();
                
                // 更新进度追踪器的文章标题
                progressTracker.updateArticleTitle(article.title);
                progressTracker.updateCurrentArticle(i + 1, url, 'rewriting', '正在改写文章');
                
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
                    
                    // 🆕 使用增强版改写器处理（集成渐进式超时处理）
                    article.rewrittenContent = await this.rewriter.rewriteArticle(
                        article.title,
                        processedContent,
                        article.url  // 🆕 传递URL用于超时处理
                    );
                    
                    console.log(`  ✅ 改写完成 (${Date.now() - articleStart}ms)`);
                    
                    // 立即保存成功的文章
                    try {
                        progressTracker.updateCurrentArticle(i + 1, url, 'saving', '正在保存文章');
                        await this.saveSingleArticle(article);
                        console.log(`  💾 文章已保存到网页`);
                        
                        // 更新进度追踪器
                        progressTracker.updateCurrentArticle(i + 1, url, 'completed', '文章处理成功');
                        progressTracker.articleCompleted(true);
                        
                        console.log(`\n✅ 第 ${i + 1}/${newUrls.length} 篇文章处理完成\n`);
                        
                        // 🆕 广播成功完成
                        this.broadcastActivity('Article Processor', article.title || `文章${article.articleNum}`, 'success');
                        this.broadcastCurrentArticle(article.title || `文章${article.articleNum}`, article.url, 'completed');
                        this.broadcastStats();
                        
                        // 🔥 更新统一历史数据库 - 标记为completed状态
                        const UnifiedHistoryDatabase = require('./unified_history_database');
                        const historyDatabase = new UnifiedHistoryDatabase();
                        historyDatabase.addProcessedRecord({
                            url: article.url,
                            normalizedUrl: article.url,
                            status: 'completed',
                            date: new Date().toISOString().split('T')[0],
                            articleNum: article.articleNum,
                            title: article.title,
                            contentHash: article.contentHash || null,
                            publishDate: article.publishDate || null,
                            contentLength: article.rewrittenContent ? article.rewrittenContent.length : 0
                        });
                        historyDatabase.saveDatabase();
                        
                    } catch (saveError) {
                        console.error(`  ❌ 保存文章时出错:`, saveError.message);
                        article.rewrittenContent = null; // 标记为失败
                        this.apiFailureHandler.logFailedArticle(article.url, `保存失败: ${saveError.message}`);
                        
                        // 更新进度追踪器
                        progressTracker.updateCurrentArticle(i + 1, url, 'failed', `保存失败: ${saveError.message}`);
                        progressTracker.articleCompleted(false);
                        
                        console.log(`\n⚠️ 第 ${i + 1}/${newUrls.length} 篇文章保存失败（已跳过）\n`);
                        
                        // 📊 更新系统进度（记录失败）
                        progressManager.recordFailure(article.url, `保存失败: ${saveError.message}`);
                        
                        // 🆕 广播保存失败
                        this.broadcastActivity('Article Processor', article.title || `文章${article.articleNum}`, 'failed');
                        this.broadcastProgress('error', {
                            message: `保存失败: ${saveError.message}`,
                            url: article.url
                        });
                    }
                    
                } catch (error) {
                    console.error(`  ❌ 改写失败:`, error.message);
                    article.rewrittenContent = null;
                    
                    // 记录失败的文章
                    this.apiFailureHandler.logFailedArticle(article.url, `Claude改写失败: ${error.message}`);
                    
                    // 更新进度追踪器
                    progressTracker.updateCurrentArticle(i + 1, url, 'failed', `改写失败: ${error.message}`);
                    progressTracker.articleCompleted(false);
                    
                    console.log(`\n⚠️ 第 ${i + 1}/${newUrls.length} 篇文章处理失败（已跳过）\n`);
                    
                    // 📊 更新系统进度（记录失败）
                    progressManager.recordFailure(article.url, `改写失败: ${error.message}`);
                    
                    // 🆕 广播改写失败
                    this.broadcastActivity('Article Processor', article.title || `文章${article.articleNum}`, 'failed');
                    this.broadcastProgress('error', {
                        message: `改写失败: ${error.message}`,
                        url: article.url
                    });
                    this.broadcastStats();
                    
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
                
                // 📊 更新系统进度（记录失败）
                progressManager.recordFailure(url, `抓取失败: ${error.message}`);
                
                console.log(`\n⚠️ 第 ${i + 1}/${urls.length} 篇文章处理失败（已跳过）\n`);
                continue;
            }
        }
        
        console.log(`\n═══════════════════════════════════════════════════`);
        console.log(`✅ 所有文章处理完成！`);
        console.log(`📊 总耗时: ${Date.now() - extractStart}ms`);
        console.log(`📊 成功处理: ${articles.filter(a => a.rewrittenContent).length}/${newUrls.length} 篇`);
        console.log(`═══════════════════════════════════════════════════\n`);
        
        // 📊 标记批量处理完成
        progressTracker.complete();
        
        // 🆕 广播处理完成
        const successCount = articles.filter(a => a.rewrittenContent).length;
        this.broadcastProgress('progress', {
            percentage: 100,
            current: newUrls.length,
            total: newUrls.length,
            eta: '已完成'
        });
        this.broadcastCurrentArticle('所有文章处理完成', '', 'completed');
        this.broadcastActivity('Batch Processor', `处理完成：${successCount}/${newUrls.length} 篇成功`, 'success');
        this.broadcastStats();
        
        // 更新进度文件为完成状态
        progressManager.finishBatchProcessing();
        
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
        
        // 🛡️ 永久去重系统已生效，无需清理标记文件
        
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
            
            // 添加底部
            if (!content.includes('查看原文')) {
                content += `\n\n---\n\n[查看原文](${article.url})`;
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
            
            try {
                fs.writeFileSync(mdFile, content, 'utf8');
                console.log(`  ✅ MD文件保存成功: wechat_article_${num}.md`);
            } catch (err) {
                console.error(`  ❌ MD文件保存失败:`, err.message);
                throw err;
            }
            
            try {
                const htmlContent = this.generateHTML(article.title, content);
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
            
            // 📊 更新系统进度（实时显示在dashboard）
            progressManager.recordSuccess(`article_${num}`, num);
            
            // ✅ 记录内容哈希（只在真正完成时）
            try {
                const ContentFreshnessDetector = require('./content_freshness_detector');
                const freshnessDetector = new ContentFreshnessDetector();
                freshnessDetector.recordContentHash(
                    article.content, 
                    article.title, 
                    article.url, 
                    article.publishDate || null
                );
                console.log(`✅ 记录文章内容哈希: "${article.title}"`);
            } catch (hashError) {
                console.log(`⚠️ 记录内容哈希失败: ${hashError.message}`);
                // 不影响文章保存，继续执行
            }
            
            return true;
            
        } catch (error) {
            console.error(`  ❌ 保存文章失败:`, error);
            console.error(`  📁 基础目录: ${this.baseDir}`);
            console.error(`  📁 当前工作目录: ${process.cwd()}`);
            throw error; // 重新抛出错误，让上层知道保存失败
        }
    }

    generateHTML(title, content) {
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
    
}

// 命令行执行
if (require.main === module) {
    // 🆕 支持多文件处理 - 从命令行参数获取所有文件名
    const urlFiles = process.argv.slice(2);
    
    if (urlFiles.length === 0) {
        console.error('❌ 请提供文章URL列表文件或使用auto模式');
        console.error('用法: ');
        console.error('  自动模式: node batch_process_articles.js auto');
        console.error('  文件模式: node batch_process_articles.js <文件名1> [文件名2] ...');
        process.exit(1);
    }
    
    const processor = new BatchArticleProcessor();
    
    // 🆕 智能模式：自动抓取并筛选URL
    if (urlFiles[0] === 'auto') {
        console.log('🤖 智能模式：自动抓取最新URL并筛选未处理文章...');
        console.log('💡 提示：系统将自动避免重复处理已完成的文章\n');
        
        // 传递空数组，让processArticles自己去抓取URL
        processor.processArticles([]).catch(console.error);
        
    } else {
        // 传统模式：从文件读取URL
        console.log(`📋 将处理 ${urlFiles.length} 个URL文件: ${urlFiles.join(', ')}`);
        
        try {
            // 🆕 读取所有文件并合并URL
            let allUrls = [];
            let totalFiles = 0;
            
            for (const filename of urlFiles) {
                try {
                    const content = fs.readFileSync(filename, 'utf8');
                    const urls = content.split('\n').filter(url => url.trim());
                    
                    if (urls.length > 0) {
                        allUrls = allUrls.concat(urls);
                        totalFiles++;
                        console.log(`📋 从 ${filename} 读取到 ${urls.length} 个URL`);
                    } else {
                        console.log(`⚠️  ${filename} 文件为空，跳过`);
                    }
                } catch (error) {
                    console.error(`❌ 读取文件 ${filename} 失败: ${error.message}`);
                    // 继续处理其他文件，不退出
                }
            }
            
            if (allUrls.length === 0) {
                console.error('❌ 所有文件都为空或没有有效的URL');
                process.exit(1);
            }
            
            console.log(`\n🎯 总计从 ${totalFiles} 个文件读取到 ${allUrls.length} 个URL`);
            console.log(`📊 平均每个文件: ${Math.round(allUrls.length / totalFiles)} 个URL\n`);
            
            processor.processArticles(allUrls).catch(console.error);
        } catch (error) {
            console.error(`❌ 处理过程中出现错误: ${error.message}`);
            process.exit(1);
        }
    }
}

module.exports = BatchArticleProcessor;