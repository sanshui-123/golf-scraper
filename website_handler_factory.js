#!/usr/bin/env node

/**
 * 🏭 网站处理器工厂
 * 统一各网站的URL抓取接口，消除重复代码
 * 为每个高尔夫网站提供标准化的URL提取和处理方法
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * 基础网站处理器接口
 */
class BaseWebsiteHandler {
    constructor(siteName, config = {}) {
        this.siteName = siteName;
        this.config = {
            timeout: 120000, // 增加到120秒处理Cloudflare保护
            maxRetries: 3,
            ...config
        };
    }

    /**
     * 提取URLs - 必须由子类实现
     * @param {number} limit - URL数量限制
     * @returns {Promise<array>} - URL列表
     */
    async extractUrls(limit = 20) {
        throw new Error('extractUrls method must be implemented by subclass');
    }

    /**
     * 标准化URL
     * @param {string} url - 原始URL
     * @returns {string} - 标准化URL
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // 移除追踪参数
            const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
            paramsToRemove.forEach(param => {
                urlObj.searchParams.delete(param);
            });
            return urlObj.toString();
        } catch (error) {
            return url;
        }
    }

    /**
     * 提取元数据
     * @param {string} url - 文章URL
     * @returns {object} - 元数据对象
     */
    extractMetadata(url) {
        return {
            site: this.siteName,
            url: url,
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * 执行子进程命令
     * @param {string} script - 脚本名称
     * @param {array} args - 参数列表
     * @returns {Promise<object>} - 执行结果
     */
    async executeScript(script, args = []) {
        return new Promise((resolve, reject) => {
            console.log(`🚀 执行: node ${script} ${args.join(' ')}`);
            
            const process = spawn('node', [script, ...args], {
                stdio: 'pipe',
                timeout: this.config.timeout
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        stdout: stdout,
                        stderr: stderr,
                        code: code
                    });
                } else {
                    reject(new Error(`脚本执行失败 (code: ${code}): ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`进程错误: ${error.message}`));
            });
        });
    }
}

/**
 * Golf.com 处理器
 */
class GolfComHandler extends BaseWebsiteHandler {
    constructor() {
        super('golf.com', {
            script: 'discover_golf_com_24h.js',
            expectedUrls: 25
        });
    }

    async extractUrls(limit = 25) {
        try {
            const result = await this.executeScript(this.config.script, ['--urls-only']);
            
            // 读取生成的URL文件
            const urlFile = 'deep_urls_golf_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                
                console.log(`✅ Golf.com: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            } else {
                throw new Error('URL文件未生成');
            }
        } catch (error) {
            console.error(`❌ Golf.com URL提取失败: ${error.message}`);
            return [];
        }
    }
}

/**
 * Golf Monthly 处理器
 */
class GolfMonthlyHandler extends BaseWebsiteHandler {
    constructor() {
        super('golfmonthly.com', {
            script: 'discover_recent_articles.js',
            baseUrl: 'https://www.golfmonthly.com',
            expectedUrls: 20,
            timeout: 90000 // 1.5分钟，比默认稍长
        });
    }

    async extractUrls(limit = 20) {
        try {
            const result = await this.executeScript(this.config.script, [
                this.config.baseUrl,
                limit.toString(),
                '--urls-only'
            ]);
            
            // 读取生成的URL文件
            const urlFile = 'deep_urls_golfmonthly_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                
                console.log(`✅ Golf Monthly: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            } else {
                throw new Error('URL文件未生成');
            }
        } catch (error) {
            console.error(`❌ Golf Monthly URL提取失败: ${error.message}`);
            return [];
        }
    }
}

/**
 * MyGolfSpy 处理器
 */
class MyGolfSpyHandler extends BaseWebsiteHandler {
    constructor() {
        super('mygolfspy.com', {
            script: 'process_mygolfspy_rss.js',
            expectedUrls: 15
        });
    }

    async extractUrls(limit = 15) {
        try {
            const result = await this.executeScript(this.config.script, [
                'process',
                limit.toString(),
                '--urls-only'
            ]);
            
            // 读取生成的URL文件
            const urlFile = 'deep_urls_mygolfspy_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                
                console.log(`✅ MyGolfSpy: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            } else {
                throw new Error('URL文件未生成');
            }
        } catch (error) {
            console.error(`❌ MyGolfSpy URL提取失败: ${error.message}`);
            return [];
        }
    }
}

/**
 * GolfWRX 处理器
 */
class GolfWRXHandler extends BaseWebsiteHandler {
    constructor() {
        super('golfwrx.com', {
            script: 'process_golfwrx.js',
            expectedUrls: 10,
            timeout: 180000 // 3分钟处理复杂的Cloudflare保护
        });
    }

    async extractUrls(limit = 10) {
        try {
            const result = await this.executeScript(this.config.script, [
                'process',
                limit.toString(),
                '--urls-only'
            ]);
            
            // 读取生成的URL文件
            const urlFile = 'deep_urls_www_golfwrx_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                
                console.log(`✅ GolfWRX: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            } else {
                throw new Error('URL文件未生成');
            }
        } catch (error) {
            console.error(`❌ GolfWRX URL提取失败: ${error.message}`);
            console.log('⚠️ GolfWRX可能受到Cloudflare保护，跳过此网站');
            return [];
        }
    }
}

/**
 * Golf Digest 处理器
 */
class GolfDigestHandler extends BaseWebsiteHandler {
    constructor() {
        super('golfdigest.com', {
            script: 'discover_golfdigest_articles.js',
            expectedUrls: 20,
            timeout: 150000 // 2.5分钟处理复杂页面结构
        });
    }

    async extractUrls(limit = 20) {
        try {
            const result = await this.executeScript(this.config.script, [
                limit.toString(),
                '--urls-only'
            ]);
            
            // 读取生成的URL文件
            const urlFile = 'deep_urls_www_golfdigest_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                
                console.log(`✅ Golf Digest: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            } else {
                throw new Error('URL文件未生成');
            }
        } catch (error) {
            console.error(`❌ Golf Digest URL提取失败: ${error.message}`);
            return [];
        }
    }
}

/**
 * Today's Golfer处理器
 */
class TodaysGolferHandler extends BaseWebsiteHandler {
    constructor() {
        super('todays-golfer.com', {
            script: 'discover_recent_articles.js',
            baseUrl: 'https://www.todays-golfer.com',
            expectedUrls: 25,
            timeout: 60000
        });
    }

    async extractUrls(limit = 25) {
        try {
            const result = await this.executeScript(this.config.script, [
                this.config.baseUrl,
                limit.toString(),
                '--urls-only'
            ]);
            
            // 读取生成的URL文件
            const urlFile = 'deep_urls_todays_golfer_com.txt';
            if (fs.existsSync(urlFile)) {
                const content = fs.readFileSync(urlFile, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                
                console.log(`✅ Today's Golfer: 提取到 ${urls.length} 个URL`);
                return urls.slice(0, limit);
            } else {
                throw new Error('URL文件未生成');
            }
        } catch (error) {
            console.error(`❌ Today's Golfer URL提取失败: ${error.message}`);
            return [];
        }
    }
}

/**
 * 网站处理器工厂
 */
class WebsiteHandlerFactory {
    constructor() {
        this.handlers = new Map();
        this.initializeHandlers();
    }

    /**
     * 初始化所有网站处理器
     */
    initializeHandlers() {
        this.handlers.set('golf.com', new GolfComHandler());
        this.handlers.set('golfmonthly.com', new GolfMonthlyHandler());
        this.handlers.set('mygolfspy.com', new MyGolfSpyHandler());
        this.handlers.set('golfwrx.com', new GolfWRXHandler());
        this.handlers.set('golfdigest.com', new GolfDigestHandler());
        this.handlers.set('todays-golfer.com', new TodaysGolferHandler());
    }

    /**
     * 创建网站处理器
     * @param {string} site - 网站域名
     * @returns {BaseWebsiteHandler|null} - 网站处理器
     */
    createHandler(site) {
        const handler = this.handlers.get(site);
        if (!handler) {
            console.error(`❌ 不支持的网站: ${site}`);
            return null;
        }
        return handler;
    }

    /**
     * 获取所有支持的网站
     * @returns {array} - 支持的网站列表
     */
    getSupportedSites() {
        return Array.from(this.handlers.keys());
    }

    /**
     * 批量提取所有网站的URLs
     * @param {array} sites - 网站列表，默认为所有网站
     * @param {object} limits - 每个网站的URL数量限制
     * @param {object} options - 处理选项
     * @returns {Promise<object>} - 提取结果
     */
    async extractAllUrls(sites = null, limits = {}, options = {}) {
        const targetSites = sites || this.getSupportedSites();
        const config = {
            concurrent: options.concurrent !== false, // 默认并发
            maxConcurrent: options.maxConcurrent || 3, // 最大并发数
            fallbackSequential: options.fallbackSequential !== false, // 默认启用降级
            globalTimeout: options.globalTimeout || 300000, // 5分钟全局超时
            ...options
        };
        
        const results = {
            success: {},
            failed: {},
            totalUrls: 0,
            summary: {},
            processingMode: config.concurrent ? '并发处理' : '顺序处理'
        };

        console.log(`\n🌐 开始批量提取URLs，目标网站: ${targetSites.length} 个 (${results.processingMode})`);

        try {
            if (config.concurrent) {
                await this.extractUrlsConcurrent(targetSites, limits, config, results);
            } else {
                await this.extractUrlsSequential(targetSites, limits, config, results);
            }
        } catch (error) {
            console.error(`❌ 批量提取过程出错: ${error.message}`);
            
            // 如果并发失败，尝试降级为顺序处理
            if (config.concurrent && config.fallbackSequential && Object.keys(results.success).length === 0) {
                console.log(`🔄 并发处理失败，降级为顺序处理...`);
                results.processingMode = '降级顺序处理';
                await this.extractUrlsSequential(targetSites, limits, config, results);
            }
        }

        // 生成摘要
        results.summary = {
            successfulSites: Object.keys(results.success).length,
            failedSites: Object.keys(results.failed).length,
            totalSites: targetSites.length,
            totalUrls: results.totalUrls
        };

        this.printExtractionSummary(results);
        return results;
    }

    /**
     * 并发提取URLs
     */
    async extractUrlsConcurrent(targetSites, limits, config, results) {
        // 分批处理以控制并发数
        const batches = [];
        for (let i = 0; i < targetSites.length; i += config.maxConcurrent) {
            batches.push(targetSites.slice(i, i + config.maxConcurrent));
        }

        console.log(`⚡ 并发模式: ${batches.length} 批次，每批最多 ${config.maxConcurrent} 个网站`);

        for (const [batchIndex, batch] of batches.entries()) {
            console.log(`\n📦 处理第 ${batchIndex + 1}/${batches.length} 批次: ${batch.join(', ')}`);
            
            const batchPromises = batch.map(site => this.extractSingleSiteUrls(site, limits, config));
            const batchResults = await Promise.allSettled(batchPromises);

            // 处理批次结果
            batchResults.forEach((result, index) => {
                const site = batch[index];
                if (result.status === 'fulfilled' && result.value.success) {
                    results.success[site] = result.value.data;
                    results.totalUrls += result.value.data.count;
                    console.log(`   ✅ ${site}: ${result.value.data.count} URLs`);
                } else {
                    const error = result.status === 'rejected' ? result.reason.message : result.value.error;
                    results.failed[site] = error;
                    console.log(`   ❌ ${site}: ${error}`);
                }
            });

            // 批次间短暂延迟，避免过度负载
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * 顺序提取URLs
     */
    async extractUrlsSequential(targetSites, limits, config, results) {
        console.log(`🔄 顺序模式: 逐个处理网站`);

        for (const site of targetSites) {
            console.log(`\n📡 处理 ${site}...`);
            
            const siteResult = await this.extractSingleSiteUrls(site, limits, config);
            
            if (siteResult.success) {
                results.success[site] = siteResult.data;
                results.totalUrls += siteResult.data.count;
                console.log(`   ✅ ${site}: ${siteResult.data.count} URLs`);
            } else {
                results.failed[site] = siteResult.error;
                console.log(`   ❌ ${site}: ${siteResult.error}`);
            }
        }
    }

    /**
     * 提取单个网站的URLs
     */
    async extractSingleSiteUrls(site, limits, config) {
        try {
            const handler = this.createHandler(site);
            if (!handler) {
                return { success: false, error: '不支持的网站' };
            }

            // 为单个网站设置超时
            const siteTimeout = handler.config.timeout || config.globalTimeout / 4;
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`网站 ${site} 处理超时 (${siteTimeout/1000}s)`)), siteTimeout)
            );

            const limit = limits[site] || 20;
            const urlsPromise = handler.extractUrls(limit);
            
            // 竞速：URL提取 vs 超时
            const urls = await Promise.race([urlsPromise, timeoutPromise]);
            
            return {
                success: true,
                data: {
                    urls: urls,
                    count: urls.length,
                    expected: handler.config.expectedUrls || limit
                }
            };

        } catch (error) {
            return { 
                success: false, 
                error: error.message.includes('超时') ? error.message : `提取失败: ${error.message}`
            };
        }
    }

    /**
     * 打印提取摘要
     */
    printExtractionSummary(results) {
        console.log('\n📊 URL提取摘要:');
        console.log(`   成功网站: ${results.summary.successfulSites}`);
        console.log(`   失败网站: ${results.summary.failedSites}`);
        console.log(`   总URL数: ${results.summary.totalUrls}`);

        if (Object.keys(results.success).length > 0) {
            console.log('\n✅ 成功网站详情:');
            for (const [site, data] of Object.entries(results.success)) {
                console.log(`   ${site}: ${data.count} URLs`);
            }
        }

        if (Object.keys(results.failed).length > 0) {
            console.log('\n❌ 失败网站详情:');
            for (const [site, error] of Object.entries(results.failed)) {
                console.log(`   ${site}: ${error}`);
            }
        }
    }

    /**
     * 验证URL文件是否正确生成
     * @returns {object} - 验证结果
     */
    validateUrlFiles() {
        const expectedFiles = [
            'deep_urls_golf_com.txt',
            'deep_urls_golfmonthly_com.txt',
            'deep_urls_mygolfspy_com.txt',
            'deep_urls_www_golfwrx_com.txt',
            'deep_urls_www_golfdigest_com.txt'
        ];

        const results = {
            existing: [],
            missing: [],
            stats: {}
        };

        expectedFiles.forEach(filename => {
            if (fs.existsSync(filename)) {
                const content = fs.readFileSync(filename, 'utf8');
                const urls = content.trim().split('\n').filter(url => url.trim());
                results.existing.push(filename);
                results.stats[filename] = {
                    exists: true,
                    urlCount: urls.length,
                    fileSize: fs.statSync(filename).size
                };
            } else {
                results.missing.push(filename);
                results.stats[filename] = {
                    exists: false,
                    urlCount: 0,
                    fileSize: 0
                };
            }
        });

        return results;
    }
}

module.exports = {
    WebsiteHandlerFactory,
    BaseWebsiteHandler,
    GolfComHandler,
    GolfMonthlyHandler,
    MyGolfSpyHandler,
    GolfWRXHandler,
    GolfDigestHandler
};

// 如果直接运行此脚本，执行测试
if (require.main === module) {
    async function testFactory() {
        console.log('🧪 测试网站处理器工厂...');
        
        const factory = new WebsiteHandlerFactory();
        console.log('支持的网站:', factory.getSupportedSites());
        
        // 验证URL文件
        console.log('\n📁 验证现有URL文件:');
        const validation = factory.validateUrlFiles();
        console.log('存在的文件:', validation.existing);
        console.log('缺失的文件:', validation.missing);
        
        // 测试单个网站
        console.log('\n🧪 测试Golf.com处理器...');
        try {
            const golfHandler = factory.createHandler('golf.com');
            if (golfHandler) {
                const urls = await golfHandler.extractUrls(5);
                console.log(`测试结果: ${urls.length} 个URL`);
            }
        } catch (error) {
            console.error('测试失败:', error.message);
        }
    }
    
    testFactory().catch(console.error);
}