#!/usr/bin/env node

/**
 * 🚀 增强版自动抓取器 - 基于auto_scrape_three_sites.js的系统性升级
 * 
 * 🎯 解决根本问题：
 * 1. 一次性处理所有未处理文章，绝不中断
 * 2. 智能并发处理，避免串行瓶颈
 * 3. 弹性错误恢复，浏览器崩溃自动重启
 * 4. 智能任务调度，根据网站特性优化
 * 5. 状态持久化，支持断点续传
 * 
 * 🏗️ 架构升级特性：
 * - 保持现有接口100%兼容
 * - 智能浏览器池管理，避免单点故障
 * - 动态任务队列，优先级调度
 * - 实时健康监控，自动故障恢复
 * - 内存管理优化，长时间运行稳定
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 导入现有模块，保持完全兼容  
const RecentArticleDiscoverer = require('./discover_recent_articles');
const BatchArticleProcessor = require('./batch_process_articles');

/**
 * 🧠 增强版自动抓取器
 * 
 * 核心升级：
 * 1. 智能并发处理架构
 * 2. 弹性错误恢复机制
 * 3. 资源池管理系统
 * 4. 状态持久化引擎
 * 5. 实时监控和自愈能力
 */
class EnhancedAutoScraper {
    constructor(options = {}) {
        // 配置参数 - 基于生产环境优化
        this.config = {
            // 并发控制
            maxConcurrentSites: options.maxConcurrentSites || 2,     // 同时处理的网站数
            maxConcurrentArticles: options.maxConcurrentArticles || 3, // 同时处理的文章数
            
            // 重试策略
            maxRetries: options.maxRetries || 3,                     // 最大重试次数
            retryDelay: options.retryDelay || 60000,                 // 重试延迟（1分钟）
            progressiveDelay: options.progressiveDelay || true,       // 递进延迟
            
            // 资源管理
            browserRestartInterval: options.browserRestartInterval || 1800000, // 浏览器重启间隔（30分钟）
            memoryThreshold: options.memoryThreshold || 2048,        // 内存阈值（MB）
            articleBatchSize: options.articleBatchSize || 5,         // 文章批次大小
            
            // 监控配置
            healthCheckInterval: options.healthCheckInterval || 30000, // 健康检查间隔
            stateBackupInterval: options.stateBackupInterval || 60000, // 状态备份间隔
            progressReportInterval: options.progressReportInterval || 30000, // 进度报告间隔
            
            // 网站特定配置
            siteProcessingOrder: options.siteProcessingOrder || [
                'golf.com',
                'golfmonthly.com', 
                'golfdigest.com',
                'golfwrx.com',
                'mygolfspy.com'
            ],
            
            ...options
        };
        
        // 核心状态管理
        this.processingState = {
            // 任务队列
            siteQueue: [],              // 网站处理队列
            articleQueue: [],           // 文章处理队列
            processingArticles: new Map(), // 正在处理的文章
            
            // 完成状态
            completedSites: new Set(),   // 已完成网站
            completedArticles: new Set(), // 已完成文章
            failedArticles: new Map(),   // 失败文章计数
            
            // 统计信息
            stats: {
                totalSites: 0,
                totalArticles: 0,
                processedArticles: 0,
                failedArticles: 0,
                skippedArticles: 0,
                startTime: Date.now(),
                lastUpdate: Date.now()
            }
        };
        
        // 资源池
        this.resourcePool = {
            discoverers: new Map(),      // 网站发现器池
            processors: new Map(),       // 文章处理器池
            activeBrowsers: new Set(),   // 活跃浏览器实例
        };
        
        // 监控和恢复
        this.monitoring = {
            healthChecks: new Map(),     // 健康检查记录
            lastActivity: new Map(),     // 最后活动时间
            restartCounts: new Map(),    // 重启计数
        };
        
        // 状态文件
        this.stateFile = path.join(process.cwd(), 'enhanced_scraper_state.json');
        this.progressFile = path.join(process.cwd(), 'scraper_progress.json');
        
        // 初始化系统
        this.initialize();
    }
    
    /**
     * 🚀 系统初始化
     */
    initialize() {
        console.log('🚀 增强版自动抓取器启动...');
        console.log(`📊 配置: 网站并发=${this.config.maxConcurrentSites}, 文章并发=${this.config.maxConcurrentArticles}`);
        
        // 1. 恢复之前状态
        this.loadState();
        
        // 2. 启动监控系统
        this.startMonitoring();
        
        // 3. 注册优雅退出
        this.registerGracefulShutdown();
        
        console.log('✅ 增强版系统初始化完成');
    }
    
    /**
     * 🎯 启动增强版抓取（主入口）
     */
    async startEnhancedScraping(options = {}) {
        console.log('🎯 开始增强版全站抓取...');
        
        try {
            // 1. 初始化处理队列
            await this.initializeProcessingQueues(options);
            
            // 2. 并发处理所有网站
            await this.processSitesConcurrently();
            
            // 3. 并发处理所有文章
            await this.processArticlesConcurrently();
            
            // 4. 等待所有任务完成
            await this.waitForAllTasksComplete();
            
            console.log('🎉 增强版抓取完成！');
            this.printFinalReport();
            
        } catch (error) {
            console.error('💥 增强版抓取失败:', error);
            await this.handleCriticalError(error);
            throw error;
        }
    }
    
    /**
     * 📋 初始化处理队列
     */
    async initializeProcessingQueues(options) {
        console.log('📋 初始化处理队列...');
        
        // 确定要处理的网站
        const sitesToProcess = options.sites || this.config.siteProcessingOrder;
        const includeAllSites = options.allSites || false;
        
        if (includeAllSites) {
            this.processingState.siteQueue = [...this.config.siteProcessingOrder];
        } else {
            this.processingState.siteQueue = sitesToProcess.filter(site => 
                this.config.siteProcessingOrder.includes(site)
            );
        }
        
        this.processingState.stats.totalSites = this.processingState.siteQueue.length;
        
        console.log(`✅ 将处理 ${this.processingState.siteQueue.length} 个网站: ${this.processingState.siteQueue.join(', ')}`);
    }
    
    /**
     * 🌐 并发处理网站
     */
    async processSitesConcurrently() {
        console.log('🌐 开始并发网站处理...');
        
        const concurrentPromises = [];
        const processingSites = new Set();
        
        while (this.processingState.siteQueue.length > 0 || processingSites.size > 0) {
            // 启动新的网站处理任务
            while (processingSites.size < this.config.maxConcurrentSites && 
                   this.processingState.siteQueue.length > 0) {
                
                const site = this.processingState.siteQueue.shift();
                processingSites.add(site);
                
                const promise = this.processSingleSite(site)
                    .then(() => {
                        processingSites.delete(site);
                        this.processingState.completedSites.add(site);
                        console.log(`✅ 网站 ${site} 处理完成`);
                    })
                    .catch((error) => {
                        processingSites.delete(site);
                        console.error(`❌ 网站 ${site} 处理失败:`, error.message);
                        
                        // 重试逻辑
                        const retryCount = this.monitoring.restartCounts.get(site) || 0;
                        if (retryCount < this.config.maxRetries) {
                            console.log(`🔄 网站 ${site} 将重试 (${retryCount + 1}/${this.config.maxRetries})`);
                            this.monitoring.restartCounts.set(site, retryCount + 1);
                            
                            // 延迟后重新加入队列
                            setTimeout(() => {
                                this.processingState.siteQueue.push(site);
                            }, this.calculateRetryDelay(retryCount));
                        }
                    });
                
                concurrentPromises.push(promise);
            }
            
            // 等待一些任务完成
            if (processingSites.size >= this.config.maxConcurrentSites) {
                await Promise.race(concurrentPromises);
            }
            
            // 短暂休息
            await this.sleep(1000);
        }
        
        // 等待所有网站处理完成
        await Promise.allSettled(concurrentPromises);
        console.log('✅ 所有网站处理完成');
    }
    
    /**
     * 🌍 处理单个网站
     */
    async processSingleSite(siteName) {
        console.log(`🌍 开始处理网站: ${siteName}`);
        
        try {
            // 创建或复用网站发现器
            let discoverer = this.resourcePool.discoverers.get(siteName);
            if (!discoverer) {
                discoverer = new RecentArticleDiscoverer();
                this.resourcePool.discoverers.set(siteName, discoverer);
            }
            
            // 发现文章
            const articles = await this.discoverSiteArticles(discoverer, siteName);
            
            // 过滤已处理的文章
            const newArticles = articles.filter(url => 
                !this.processingState.completedArticles.has(url)
            );
            
            console.log(`📊 ${siteName}: 发现 ${articles.length} 篇文章，新文章 ${newArticles.length} 篇`);
            
            // 添加到文章处理队列
            newArticles.forEach(url => {
                this.processingState.articleQueue.push({
                    url,
                    site: siteName,
                    priority: this.calculateArticlePriority(url, siteName),
                    attempts: 0,
                    addedAt: Date.now()
                });
            });
            
            // 按优先级排序
            this.processingState.articleQueue.sort((a, b) => b.priority - a.priority);
            
            this.processingState.stats.totalArticles += newArticles.length;
            
        } catch (error) {
            console.error(`❌ 网站 ${siteName} 发现失败:`, error.message);
            throw error;
        }
    }
    
    /**
     * 🔍 发现网站文章（带重试机制）- 忽略时间限制，处理所有文章
     */
    async discoverSiteArticles(discoverer, siteName, retryCount = 0) {
        try {
            // 确定文章数量限制 - 增加数量以获取更多文章
            const limits = {
                'golf.com': 50,
                'golfmonthly.com': 40,
                'golfdigest.com': 40,
                'golfwrx.com': 30,
                'mygolfspy.com': 25
            };
            
            const limit = limits[siteName] || 30;
            
            console.log(`🔍 发现 ${siteName} 所有未处理文章 (限制: ${limit}篇)...`);
            
            // 🎯 关键修改：使用ignoreTime模式，处理所有文章
            const articles = await discoverer.discoverRecentArticles(siteName, limit, {
                ignoreTime: true,           // 忽略时间限制
                autoProcess: false,         // 不自动处理
                returnAllArticles: true     // 返回所有发现的文章
            });
            
            return articles || [];
            
        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                const delay = this.calculateRetryDelay(retryCount);
                console.warn(`⚠️ ${siteName} 发现失败，${delay/1000}秒后重试: ${error.message}`);
                
                await this.sleep(delay);
                return this.discoverSiteArticles(discoverer, siteName, retryCount + 1);
            } else {
                throw error;
            }
        }
    }
    
    /**
     * 📄 并发处理文章
     */
    async processArticlesConcurrently() {
        console.log('📄 开始并发文章处理...');
        
        const processingPromises = [];
        
        while (this.processingState.articleQueue.length > 0 || 
               this.processingState.processingArticles.size > 0) {
            
            // 启动新的文章处理任务
            while (this.processingState.processingArticles.size < this.config.maxConcurrentArticles &&
                   this.processingState.articleQueue.length > 0) {
                
                const articleTask = this.processingState.articleQueue.shift();
                this.processingState.processingArticles.set(articleTask.url, articleTask);
                
                const promise = this.processSingleArticle(articleTask)
                    .then(() => {
                        this.processingState.processingArticles.delete(articleTask.url);
                        this.processingState.completedArticles.add(articleTask.url);
                        this.processingState.stats.processedArticles++;
                        console.log(`✅ 文章处理完成: ${articleTask.url.substring(0, 80)}...`);
                    })
                    .catch((error) => {
                        this.processingState.processingArticles.delete(articleTask.url);
                        this.handleArticleProcessingError(articleTask, error);
                    });
                
                processingPromises.push(promise);
            }
            
            // 等待一些任务完成
            if (this.processingState.processingArticles.size >= this.config.maxConcurrentArticles) {
                await Promise.race(processingPromises);
            }
            
            // 打印进度
            this.printProgress();
            
            // 短暂休息
            await this.sleep(2000);
        }
        
        // 等待所有文章处理完成
        await Promise.allSettled(processingPromises);
        console.log('✅ 所有文章处理完成');
    }
    
    /**
     * 📝 处理单篇文章
     */
    async processSingleArticle(articleTask) {
        const { url, site } = articleTask;
        
        try {
            // 获取或创建文章处理器
            let processor = this.resourcePool.processors.get(site);
            if (!processor) {
                processor = new BatchArticleProcessor();
                this.resourcePool.processors.set(site, processor);
                
                // 记录浏览器实例
                if (processor.browser) {
                    this.resourcePool.activeBrowsers.add(processor.browser);
                }
            }
            
            // 检查处理器健康状态
            await this.ensureProcessorHealth(processor, site);
            
            // 处理文章
            await processor.processArticles([url]);
            
            // 更新活动时间
            this.monitoring.lastActivity.set(site, Date.now());
            
        } catch (error) {
            console.error(`❌ 文章处理失败 ${url}:`, error.message);
            throw error;
        }
    }
    
    /**
     * 🏥 确保处理器健康状态
     */
    async ensureProcessorHealth(processor, site) {
        const now = Date.now();
        const lastActivity = this.monitoring.lastActivity.get(site) || now;
        const activityGap = now - lastActivity;
        
        // 如果处理器长时间无活动，重启浏览器
        if (activityGap > this.config.browserRestartInterval) {
            console.log(`🔄 处理器 ${site} 长时间无活动，重启浏览器...`);
            await this.restartProcessorBrowser(processor, site);
        }
        
        // 检查内存使用
        const memUsage = process.memoryUsage();
        const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        
        if (memMB > this.config.memoryThreshold) {
            console.warn(`⚠️ 内存使用过高: ${memMB}MB，重启所有浏览器...`);
            await this.restartAllBrowsers();
        }
    }
    
    /**
     * 🔄 重启处理器浏览器
     */
    async restartProcessorBrowser(processor, site) {
        try {
            if (processor.browser) {
                this.resourcePool.activeBrowsers.delete(processor.browser);
                await processor.browser.close();
                processor.browser = null;
            }
            
            console.log(`✅ 处理器 ${site} 浏览器重启完成`);
            
        } catch (error) {
            console.error(`❌ 处理器 ${site} 浏览器重启失败:`, error.message);
        }
    }
    
    /**
     * 🔄 重启所有浏览器
     */
    async restartAllBrowsers() {
        console.log('🔄 开始重启所有浏览器...');
        
        const restartPromises = [];
        
        for (const [site, processor] of this.resourcePool.processors.entries()) {
            if (processor.browser) {
                restartPromises.push(this.restartProcessorBrowser(processor, site));
            }
        }
        
        await Promise.allSettled(restartPromises);
        
        // 清理活跃浏览器集合
        this.resourcePool.activeBrowsers.clear();
        
        console.log('✅ 所有浏览器重启完成');
    }
    
    /**
     * ❌ 处理文章处理错误
     */
    handleArticleProcessingError(articleTask, error) {
        const { url, site } = articleTask;
        
        console.error(`❌ 文章处理失败 ${url}:`, error.message);
        
        // 记录失败次数
        const failureCount = this.processingState.failedArticles.get(url) || 0;
        this.processingState.failedArticles.set(url, failureCount + 1);
        
        // 重试逻辑
        articleTask.attempts++;
        if (articleTask.attempts < this.config.maxRetries) {
            console.log(`🔄 文章将重试 ${url} (${articleTask.attempts}/${this.config.maxRetries})`);
            
            // 延迟后重新加入队列
            const delay = this.calculateRetryDelay(articleTask.attempts - 1);
            setTimeout(() => {
                this.processingState.articleQueue.push(articleTask);
            }, delay);
        } else {
            console.error(`💥 文章达到最大重试次数 ${url}`);
            this.processingState.stats.failedArticles++;
        }
    }
    
    /**
     * 📊 计算文章优先级
     */
    calculateArticlePriority(url, site) {
        let priority = 1.0;
        
        // 网站权重
        const siteWeights = {
            'golf.com': 1.3,
            'golfmonthly.com': 1.2,
            'golfdigest.com': 1.1,
            'golfwrx.com': 1.0,
            'mygolfspy.com': 0.9
        };
        priority *= siteWeights[site] || 1.0;
        
        // 内容类型权重
        if (url.includes('/news/')) priority *= 1.2;
        if (url.includes('/equipment/')) priority *= 1.1;
        if (url.includes('/instruction/')) priority *= 1.05;
        
        return priority;
    }
    
    /**
     * ⏱️ 计算重试延迟
     */
    calculateRetryDelay(retryCount) {
        if (!this.config.progressiveDelay) {
            return this.config.retryDelay;
        }
        
        // 递进延迟：1分钟、2分钟、5分钟
        const delays = [60000, 120000, 300000];
        return delays[Math.min(retryCount, delays.length - 1)] || this.config.retryDelay;
    }
    
    /**
     * ⏳ 等待所有任务完成
     */
    async waitForAllTasksComplete() {
        console.log('⏳ 等待所有任务完成...');
        
        while (this.processingState.articleQueue.length > 0 || 
               this.processingState.processingArticles.size > 0) {
            
            await this.sleep(10000); // 10秒检查一次
            this.printProgress();
            
            // 健康检查
            await this.performHealthCheck();
        }
        
        console.log('🎉 所有任务处理完成！');
    }
    
    /**
     * 🏥 执行健康检查
     */
    async performHealthCheck() {
        const now = Date.now();
        
        // 检查长时间无响应的任务
        for (const [url, task] of this.processingState.processingArticles.entries()) {
            const processingTime = now - task.addedAt;
            
            if (processingTime > 1800000) { // 30分钟超时
                console.warn(`⚠️ 任务超时: ${url.substring(0, 80)}...`);
                
                // 移除并重新加入队列
                this.processingState.processingArticles.delete(url);
                task.attempts++;
                
                if (task.attempts < this.config.maxRetries) {
                    this.processingState.articleQueue.push(task);
                }
            }
        }
    }
    
    /**
     * 📊 打印进度
     */
    printProgress() {
        const stats = this.processingState.stats;
        const queued = this.processingState.articleQueue.length;
        const processing = this.processingState.processingArticles.size;
        const elapsed = Math.round((Date.now() - stats.startTime) / 60000);
        const rate = elapsed > 0 ? Math.round(stats.processedArticles / elapsed) : 0;
        
        console.log(`📊 [${elapsed}分钟] 总计=${stats.totalArticles}, 完成=${stats.processedArticles}, 失败=${stats.failedArticles}, 处理中=${processing}, 队列中=${queued}, 速度=${rate}篇/分钟`);
        
        // 更新进度文件
        this.updateProgressFile();
    }
    
    /**
     * 📈 打印最终报告
     */
    printFinalReport() {
        const stats = this.processingState.stats;
        const elapsed = Math.round((Date.now() - stats.startTime) / 60000);
        const successRate = stats.totalArticles > 0 ? 
            (stats.processedArticles / stats.totalArticles * 100).toFixed(1) : 0;
        const avgRate = elapsed > 0 ? (stats.processedArticles / elapsed).toFixed(1) : 0;
        
        console.log('\n🎉 增强版抓取完成报告:');
        console.log(`🌐 处理网站数: ${this.processingState.stats.totalSites}`);
        console.log(`📄 总文章数: ${stats.totalArticles}`);
        console.log(`✅ 成功处理: ${stats.processedArticles}`);
        console.log(`❌ 处理失败: ${stats.failedArticles}`);
        console.log(`📈 成功率: ${successRate}%`);
        console.log(`⏱️ 总耗时: ${elapsed}分钟`);
        console.log(`🚀 平均速度: ${avgRate}篇/分钟`);
        
        // 网站处理统计
        console.log('\n🌐 网站处理统计:');
        for (const site of this.processingState.completedSites) {
            console.log(`  ✅ ${site}: 已完成`);
        }
        
        // 重试统计
        const retryStats = Array.from(this.monitoring.restartCounts.entries())
            .filter(([_, count]) => count > 0);
        
        if (retryStats.length > 0) {
            console.log('\n🔄 重试统计:');
            retryStats.forEach(([item, count]) => {
                console.log(`  🔄 ${item}: ${count}次重试`);
            });
        }
    }
    
    /**
     * 💾 状态管理
     */
    saveState() {
        const state = {
            processingState: {
                siteQueue: this.processingState.siteQueue,
                articleQueue: this.processingState.articleQueue,
                completedSites: Array.from(this.processingState.completedSites),
                completedArticles: Array.from(this.processingState.completedArticles),
                failedArticles: Object.fromEntries(this.processingState.failedArticles),
                stats: this.processingState.stats
            },
            monitoring: {
                restartCounts: Object.fromEntries(this.monitoring.restartCounts),
                lastActivity: Object.fromEntries(this.monitoring.lastActivity)
            },
            timestamp: Date.now()
        };
        
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('❌ 状态保存失败:', error.message);
        }
    }
    
    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                
                // 检查是否过期（12小时）
                if (Date.now() - state.timestamp > 12 * 60 * 60 * 1000) {
                    console.log('⚠️ 状态文件过期，重新开始');
                    return;
                }
                
                // 恢复状态
                const ps = state.processingState;
                this.processingState.siteQueue = ps.siteQueue || [];
                this.processingState.articleQueue = ps.articleQueue || [];
                this.processingState.completedSites = new Set(ps.completedSites || []);
                this.processingState.completedArticles = new Set(ps.completedArticles || []);
                this.processingState.failedArticles = new Map(Object.entries(ps.failedArticles || {}));
                this.processingState.stats = { ...this.processingState.stats, ...ps.stats };
                
                // 恢复监控状态
                if (state.monitoring) {
                    this.monitoring.restartCounts = new Map(Object.entries(state.monitoring.restartCounts || {}));
                    this.monitoring.lastActivity = new Map(Object.entries(state.monitoring.lastActivity || {}));
                }
                
                console.log(`📂 恢复状态: ${this.processingState.siteQueue.length}个网站, ${this.processingState.articleQueue.length}篇文章待处理`);
            }
        } catch (error) {
            console.error('❌ 状态加载失败:', error.message);
        }
    }
    
    updateProgressFile() {
        const progress = {
            stats: this.processingState.stats,
            queues: {
                sites: this.processingState.siteQueue.length,
                articles: this.processingState.articleQueue.length,
                processing: this.processingState.processingArticles.size
            },
            completedSites: Array.from(this.processingState.completedSites),
            timestamp: Date.now(),
            uptime: Date.now() - this.processingState.stats.startTime
        };
        
        try {
            fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
        } catch (e) {}
    }
    
    /**
     * 🔄 启动监控
     */
    startMonitoring() {
        // 定期保存状态
        setInterval(() => {
            this.saveState();
        }, this.config.stateBackupInterval);
        
        // 定期健康检查
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        
        // 定期打印进度
        setInterval(() => {
            this.printProgress();
        }, this.config.progressReportInterval);
    }
    
    /**
     * 🛑 优雅退出处理
     */
    registerGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 收到${signal}信号，开始优雅退出...`);
            
            // 保存状态
            this.saveState();
            
            // 关闭所有浏览器
            for (const browser of this.resourcePool.activeBrowsers) {
                try {
                    await browser.close();
                } catch (e) {}
            }
            
            // 清理处理器
            for (const processor of this.resourcePool.processors.values()) {
                try {
                    if (processor.browser) {
                        await processor.browser.close();
                    }
                } catch (e) {}
            }
            
            console.log('👋 优雅退出完成');
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
    
    /**
     * 💥 处理严重错误
     */
    async handleCriticalError(error) {
        console.error('💥 严重错误，保存状态并清理资源:', error);
        
        // 保存状态
        this.saveState();
        
        // 清理资源
        await this.restartAllBrowsers();
    }
    
    /**
     * 😴 延时函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 🚀 主入口函数 - 保持与原版完全兼容的接口
 */
async function startEnhancedAutoScraping(options = {}) {
    const scraper = new EnhancedAutoScraper(options);
    await scraper.startEnhancedScraping(options);
}

// 命令行参数解析 - 与原版auto_scrape_three_sites.js兼容
function parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const options = {
        allSites: false,
        sites: [],
        limit: null
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--all-sites') {
            options.allSites = true;
        } else if (arg === '--sites' && i + 1 < args.length) {
            options.sites = args[++i].split(',');
        } else if (arg === '--limit' && i + 1 < args.length) {
            options.limit = parseInt(args[++i]);
        }
    }
    
    return options;
}

// 直接运行
if (require.main === module) {
    console.log('🎯 启动增强版自动抓取器...');
    
    const cmdOptions = parseCommandLineArgs();
    
    // 增强版配置
    const enhancedOptions = {
        ...cmdOptions,
        maxConcurrentSites: 2,      // 同时处理2个网站
        maxConcurrentArticles: 3,   // 同时处理3篇文章
        maxRetries: 3,              // 重试3次
        articleBatchSize: 5         // 每批5篇文章
    };
    
    startEnhancedAutoScraping(enhancedOptions)
        .then(() => {
            console.log('🎉 增强版抓取完成！');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 增强版抓取失败:', error);
            process.exit(1);
        });
}

module.exports = { EnhancedAutoScraper, startEnhancedAutoScraping };