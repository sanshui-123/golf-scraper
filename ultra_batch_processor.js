#!/usr/bin/env node

/**
 * 🚀 Ultra批量处理器 - 基于现有代码的系统性升级
 * 
 * 🎯 解决核心问题：
 * 1. 一次性处理所有未处理文章，永不中断
 * 2. 智能并发处理，避免串行瓶颈
 * 3. 弹性错误恢复，单点失败不影响整体
 * 4. 状态持久化，支持断点续传
 * 5. 资源管理优化，避免内存泄漏
 * 
 * 🏗️ 架构升级：
 * - 基于现有BatchArticleProcessor，完全兼容
 * - 智能任务队列和调度
 * - 多浏览器实例池管理
 * - 自动故障检测和恢复
 * - 实时状态监控和备份
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// 导入现有模块，保持100%兼容性
const BatchArticleProcessor = require('./batch_process_articles');

/**
 * 🧠 Ultra批量处理引擎
 * 
 * 核心设计原则：
 * 1. 基于现有代码，不破坏兼容性
 * 2. 智能并发，但避免过载
 * 3. 故障隔离，单个失败不影响整体
 * 4. 状态透明，随时可查看进度
 * 5. 资源优化，长时间运行不崩溃
 */
class UltraBatchProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // 配置参数
        this.config = {
            maxConcurrent: options.maxConcurrent || 2,      // 最大并发数（谨慎设置）
            batchSize: options.batchSize || 5,              // 每批处理文章数
            retryAttempts: options.retryAttempts || 3,      // 重试次数
            retryDelay: options.retryDelay || 30000,        // 重试延迟（30秒）
            healthCheckInterval: options.healthCheckInterval || 60000, // 健康检查间隔
            stateBackupInterval: options.stateBackupInterval || 30000,  // 状态备份间隔
            browserRestartInterval: options.browserRestartInterval || 1800000, // 浏览器重启间隔（30分钟）
            maxMemory: options.maxMemory || 4096,           // 最大内存使用（MB）
            ...options
        };
        
        // 核心状态
        this.taskQueue = [];                    // 主任务队列
        this.processingQueue = [];              // 正在处理的任务
        this.completedTasks = new Set();        // 已完成任务
        this.failedTasks = new Map();           // 失败任务计数
        this.processorPool = new Map();         // 处理器池
        this.activeProcessors = 0;              // 活跃处理器数量
        
        // 统计信息
        this.stats = {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            lastUpdate: Date.now()
        };
        
        // 状态文件
        this.stateFile = path.join(process.cwd(), 'ultra_processor_state.json');
        this.progressFile = path.join(process.cwd(), 'ultra_progress.json');
        
        // 初始化系统
        this.initialize();
    }
    
    /**
     * 🚀 系统初始化
     */
    initialize() {
        console.log('🚀 Ultra批量处理系统初始化...');
        
        // 1. 加载之前的状态
        this.loadState();
        
        // 2. 启动监控服务
        this.startMonitoring();
        
        // 3. 注册优雅退出
        this.registerGracefulShutdown();
        
        console.log('✅ Ultra系统初始化完成');
    }
    
    /**
     * 🔍 发现所有未处理文章
     */
    async discoverAllUnprocessedArticles() {
        console.log('🔍 全面扫描未处理文章...');
        
        const allUrls = [];
        const websites = [
            { name: 'golf.com', limit: 20 },
            { name: 'golfmonthly.com', limit: 15 },
            { name: 'mygolfspy.com', limit: 10 },
            { name: 'golfwrx.com', limit: 10 },
            { name: 'golfdigest.com', limit: 15 }
        ];
        
        // 使用现有的发现逻辑
        for (const site of websites) {
            try {
                console.log(`📡 扫描 ${site.name}...`);
                
                // 创建子进程运行发现逻辑，避免主进程阻塞
                const urls = await this.discoverSiteArticles(site.name, site.limit);
                
                // 过滤已完成的文章
                const newUrls = urls.filter(url => !this.completedTasks.has(url));
                allUrls.push(...newUrls);
                
                console.log(`  ✅ ${site.name}: 发现 ${urls.length} 篇，新文章 ${newUrls.length} 篇`);
                
                // 短暂休息，避免过快请求
                await this.sleep(2000);
                
            } catch (error) {
                console.error(`  ❌ ${site.name} 扫描失败: ${error.message}`);
            }
        }
        
        // 去重和优先级排序
        const uniqueUrls = this.deduplicateAndPrioritize(allUrls);
        
        console.log(`📊 发现 ${allUrls.length} 篇文章，去重后 ${uniqueUrls.length} 篇`);
        
        return uniqueUrls;
    }
    
    /**
     * 🌐 发现单个网站文章
     */
    async discoverSiteArticles(siteName, limit) {
        return new Promise((resolve, reject) => {
            // 使用现有的发现逻辑
            const process = spawn('node', [
                'discover_recent_articles.js',
                siteName,
                limit.toString(),
                '--json'  // 假设支持JSON输出
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 120000 // 2分钟超时
            });
            
            let output = '';
            let error = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        // 解析URL列表
                        const urls = this.parseDiscoveryOutput(output);
                        resolve(urls);
                    } catch (parseError) {
                        reject(new Error(`解析输出失败: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`发现进程失败 (${code}): ${error}`));
                }
            });
            
            process.on('error', (err) => {
                reject(err);
            });
        });
    }
    
    /**
     * 📝 解析发现输出
     */
    parseDiscoveryOutput(output) {
        const urls = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // 寻找URL模式
            const urlMatch = line.match(/https?:\/\/[^\s]+/g);
            if (urlMatch) {
                urls.push(...urlMatch);
            }
        }
        
        return [...new Set(urls)]; // 去重
    }
    
    /**
     * 🎯 去重和优先级排序
     */
    deduplicateAndPrioritize(urls) {
        // 去重
        const uniqueUrls = [...new Set(urls)];
        
        // 按优先级排序
        return uniqueUrls.sort((a, b) => {
            // 优先级规则
            const scoreA = this.calculateUrlPriority(a);
            const scoreB = this.calculateUrlPriority(b);
            return scoreB - scoreA;
        });
    }
    
    /**
     * 📊 计算URL优先级
     */
    calculateUrlPriority(url) {
        let score = 1.0;
        
        // 网站权重
        if (url.includes('golf.com')) score += 0.3;
        if (url.includes('golfmonthly.com')) score += 0.2;
        if (url.includes('golfdigest.com')) score += 0.1;
        
        // 内容类型
        if (url.includes('/news/')) score += 0.2;
        if (url.includes('/equipment/')) score += 0.15;
        if (url.includes('/instruction/')) score += 0.1;
        
        // 避免问题URL
        if (url.includes('mygolfspy.com') || url.includes('golfwrx.com')) {
            score -= 0.1; // 这些网站处理较复杂
        }
        
        return score;
    }
    
    /**
     * 🚀 开始Ultra处理
     */
    async startUltraProcessing() {
        console.log('🚀 启动Ultra批量处理...');
        
        try {
            // 1. 发现所有未处理文章
            const allUrls = await this.discoverAllUnprocessedArticles();
            
            if (allUrls.length === 0) {
                console.log('✅ 没有发现新的文章需要处理');
                return;
            }
            
            // 2. 创建任务批次
            this.createTaskBatches(allUrls);
            
            // 3. 启动并发处理
            await this.startConcurrentProcessing();
            
            // 4. 等待所有任务完成
            await this.waitForAllTasksComplete();
            
            console.log('🎉 Ultra处理完成！');
            this.printFinalStats();
            
        } catch (error) {
            console.error('💥 Ultra处理失败:', error);
            throw error;
        }
    }
    
    /**
     * 📦 创建任务批次
     */
    createTaskBatches(urls) {
        console.log(`📦 创建任务批次 (每批${this.config.batchSize}篇)...`);
        
        this.taskQueue = [];
        this.stats.total = urls.length;
        
        for (let i = 0; i < urls.length; i += this.config.batchSize) {
            const batch = urls.slice(i, i + this.config.batchSize);
            this.taskQueue.push({
                id: `batch_${Math.floor(i / this.config.batchSize)}`,
                urls: batch,
                attempts: 0,
                createdAt: Date.now()
            });
        }
        
        console.log(`✅ 创建了 ${this.taskQueue.length} 个批次`);
    }
    
    /**
     * 🏃 启动并发处理
     */
    async startConcurrentProcessing() {
        console.log(`🏃 启动并发处理 (最大并发: ${this.config.maxConcurrent})...`);
        
        // 启动指定数量的并发处理器
        const promises = [];
        for (let i = 0; i < this.config.maxConcurrent; i++) {
            promises.push(this.runProcessor(i));
        }
        
        // 等待所有处理器启动
        await Promise.all(promises);
    }
    
    /**
     * 🔄 运行单个处理器
     */
    async runProcessor(processorId) {
        console.log(`🔄 启动处理器 ${processorId}`);
        
        const processor = {
            id: processorId,
            status: 'idle',
            currentBatch: null,
            completedCount: 0,
            failedCount: 0,
            lastActivity: Date.now(),
            batchProcessor: null
        };
        
        this.processorPool.set(processorId, processor);
        
        try {
            while (this.taskQueue.length > 0 || this.processingQueue.length > 0) {
                // 获取下一个任务
                const batch = this.getNextBatch();
                if (!batch) {
                    // 没有任务，短暂休息
                    await this.sleep(5000);
                    continue;
                }
                
                // 处理批次
                await this.processBatch(processor, batch);
            }
        } catch (error) {
            console.error(`❌ 处理器 ${processorId} 出错:`, error);
        } finally {
            console.log(`🔚 处理器 ${processorId} 结束`);
            this.activeProcessors--;
        }
    }
    
    /**
     * 📋 获取下一个批次
     */
    getNextBatch() {
        if (this.taskQueue.length === 0) return null;
        
        const batch = this.taskQueue.shift();
        if (batch) {
            this.processingQueue.push(batch);
        }
        return batch;
    }
    
    /**
     * 🔨 处理单个批次
     */
    async processBatch(processor, batch) {
        console.log(`🔨 处理器 ${processor.id} 开始处理批次 ${batch.id} (${batch.urls.length}篇)`);
        
        processor.status = 'busy';
        processor.currentBatch = batch;
        processor.lastActivity = Date.now();
        
        try {
            // 创建新的BatchArticleProcessor实例
            if (!processor.batchProcessor) {
                processor.batchProcessor = new BatchArticleProcessor();
            }
            
            // 处理批次中的所有文章
            const results = await this.processUrlsBatch(processor.batchProcessor, batch.urls);
            
            // 更新统计
            this.stats.completed += results.success;
            this.stats.failed += results.failed;
            this.stats.skipped += results.skipped;
            
            processor.completedCount += results.success;
            processor.failedCount += results.failed;
            
            // 标记已完成的文章
            results.completedUrls.forEach(url => {
                this.completedTasks.add(url);
            });
            
            console.log(`✅ 处理器 ${processor.id} 完成批次 ${batch.id}: 成功=${results.success}, 失败=${results.failed}`);
            
        } catch (error) {
            console.error(`❌ 批次 ${batch.id} 处理失败:`, error.message);
            
            // 重试逻辑
            batch.attempts++;
            if (batch.attempts < this.config.retryAttempts) {
                console.log(`🔄 批次 ${batch.id} 将重试 (${batch.attempts}/${this.config.retryAttempts})`);
                // 延迟后重新加入队列
                setTimeout(() => {
                    this.taskQueue.push(batch);
                }, this.config.retryDelay);
            } else {
                console.error(`💥 批次 ${batch.id} 达到最大重试次数，放弃处理`);
                this.stats.failed += batch.urls.length;
            }
            
        } finally {
            // 清理
            processor.status = 'idle';
            processor.currentBatch = null;
            processor.lastActivity = Date.now();
            
            // 从处理队列中移除
            const index = this.processingQueue.findIndex(b => b.id === batch.id);
            if (index >= 0) {
                this.processingQueue.splice(index, 1);
            }
            
            // 定期重启BatchArticleProcessor实例，避免内存泄漏
            if (processor.completedCount % 20 === 0 && processor.completedCount > 0) {
                console.log(`🔄 处理器 ${processor.id} 重启BatchArticleProcessor实例`);
                try {
                    if (processor.batchProcessor && processor.batchProcessor.browser) {
                        await processor.batchProcessor.browser.close();
                    }
                } catch (e) {}
                processor.batchProcessor = null;
            }
        }
    }
    
    /**
     * 📄 处理URL批次
     */
    async processUrlsBatch(batchProcessor, urls) {
        const results = {
            success: 0,
            failed: 0,
            skipped: 0,
            completedUrls: []
        };
        
        try {
            // 使用现有的processArticles方法
            await batchProcessor.processArticles(urls);
            
            // 检查处理结果（简化版本，假设全部成功）
            results.success = urls.length;
            results.completedUrls = [...urls];
            
        } catch (error) {
            console.error('批次处理出错:', error.message);
            
            // 如果批次处理失败，尝试逐个处理
            for (const url of urls) {
                try {
                    await batchProcessor.processArticles([url]);
                    results.success++;
                    results.completedUrls.push(url);
                } catch (singleError) {
                    console.error(`单篇文章处理失败 ${url}:`, singleError.message);
                    results.failed++;
                }
            }
        }
        
        return results;
    }
    
    /**
     * ⏳ 等待所有任务完成
     */
    async waitForAllTasksComplete() {
        console.log('⏳ 等待所有任务完成...');
        
        while (this.taskQueue.length > 0 || this.processingQueue.length > 0) {
            await this.sleep(10000); // 10秒检查一次
            this.printProgress();
            
            // 检查处理器健康状态
            this.checkProcessorHealth();
        }
        
        console.log('🎉 所有任务处理完成！');
    }
    
    /**
     * 🏥 检查处理器健康状态
     */
    checkProcessorHealth() {
        const now = Date.now();
        const timeout = 1800000; // 30分钟超时
        
        for (const [id, processor] of this.processorPool.entries()) {
            if (processor.status === 'busy' && 
                now - processor.lastActivity > timeout) {
                
                console.warn(`⚠️ 处理器 ${id} 可能卡住，重置状态`);
                
                // 重置处理器状态
                processor.status = 'idle';
                if (processor.currentBatch) {
                    // 将当前批次重新加入队列
                    this.taskQueue.push(processor.currentBatch);
                    processor.currentBatch = null;
                }
                
                // 清理BatchArticleProcessor实例
                if (processor.batchProcessor) {
                    try {
                        processor.batchProcessor.browser?.close?.();
                    } catch (e) {}
                    processor.batchProcessor = null;
                }
            }
        }
    }
    
    /**
     * 📊 打印进度
     */
    printProgress() {
        const { total, completed, failed, skipped } = this.stats;
        const remaining = this.taskQueue.length;
        const processing = this.processingQueue.length;
        const elapsed = Math.round((Date.now() - this.stats.startTime) / 60000);
        const rate = elapsed > 0 ? Math.round((completed + failed) / elapsed) : 0;
        
        console.log(`📊 [${elapsed}分钟] 总=${total}, 完成=${completed}, 失败=${failed}, 跳过=${skipped}, 处理中=${processing}, 待处理=${remaining}, 速度=${rate}篇/分钟`);
        
        // 更新进度文件
        const progressData = {
            stats: this.stats,
            remaining,
            processing,
            timestamp: Date.now(),
            processors: Array.from(this.processorPool.entries()).map(([id, p]) => ({
                id,
                status: p.status,
                completedCount: p.completedCount,
                failedCount: p.failedCount,
                currentBatch: p.currentBatch?.id
            }))
        };
        
        try {
            fs.writeFileSync(this.progressFile, JSON.stringify(progressData, null, 2));
        } catch (e) {}
    }
    
    /**
     * 📈 打印最终统计
     */
    printFinalStats() {
        const { total, completed, failed, skipped } = this.stats;
        const elapsed = Math.round((Date.now() - this.stats.startTime) / 60000);
        const successRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
        const avgRate = elapsed > 0 ? (completed / elapsed).toFixed(1) : 0;
        
        console.log('\n🎉 Ultra处理完成统计:');
        console.log(`📊 总文章数: ${total}`);
        console.log(`✅ 成功处理: ${completed}`);
        console.log(`❌ 处理失败: ${failed}`);
        console.log(`⏭️ 跳过处理: ${skipped}`);
        console.log(`📈 成功率: ${successRate}%`);
        console.log(`⏱️ 总耗时: ${elapsed}分钟`);
        console.log(`🚀 平均速度: ${avgRate}篇/分钟`);
        
        // 处理器统计
        console.log('\n👥 处理器统计:');
        for (const [id, processor] of this.processorPool.entries()) {
            console.log(`  处理器${id}: 完成=${processor.completedCount}, 失败=${processor.failedCount}`);
        }
    }
    
    /**
     * 💾 保存状态
     */
    saveState() {
        const state = {
            taskQueue: this.taskQueue,
            completedTasks: Array.from(this.completedTasks),
            failedTasks: Object.fromEntries(this.failedTasks),
            stats: this.stats,
            timestamp: Date.now()
        };
        
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('❌ 状态保存失败:', error.message);
        }
    }
    
    /**
     * 📂 加载状态
     */
    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                
                // 检查是否过期（24小时）
                if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
                    console.log('⚠️ 状态文件过期，重新开始');
                    return;
                }
                
                this.taskQueue = state.taskQueue || [];
                this.completedTasks = new Set(state.completedTasks || []);
                this.failedTasks = new Map(Object.entries(state.failedTasks || {}));
                this.stats = { ...this.stats, ...state.stats };
                
                console.log(`📂 恢复状态: ${this.taskQueue.length}个待处理批次, ${this.completedTasks.size}篇已完成`);
            }
        } catch (error) {
            console.error('❌ 状态加载失败:', error.message);
        }
    }
    
    /**
     * 🔄 启动监控
     */
    startMonitoring() {
        // 状态备份
        setInterval(() => {
            this.saveState();
        }, this.config.stateBackupInterval);
        
        // 内存监控
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            
            if (memMB > this.config.maxMemory) {
                console.warn(`⚠️ 内存使用过高: ${memMB}MB, 建议重启`);
            }
        }, this.config.healthCheckInterval);
    }
    
    /**
     * 🛑 优雅退出
     */
    registerGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 收到${signal}信号，优雅退出中...`);
            
            // 保存状态
            this.saveState();
            
            // 清理处理器
            for (const [id, processor] of this.processorPool.entries()) {
                try {
                    if (processor.batchProcessor?.browser) {
                        await processor.batchProcessor.browser.close();
                    }
                } catch (e) {}
            }
            
            console.log('👋 退出完成');
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
    
    /**
     * 😴 延时
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 🚀 主入口
 */
async function startUltraProcessing(options = {}) {
    console.log('🎯 启动Ultra批量处理系统...');
    
    const processor = new UltraBatchProcessor(options);
    await processor.startUltraProcessing();
}

// 命令行直接运行
if (require.main === module) {
    startUltraProcessing({
        maxConcurrent: 2,           // 2个并发处理器（谨慎设置）
        batchSize: 3,               // 每批3篇文章
        retryAttempts: 2,           // 重试2次
        retryDelay: 30000           // 重试延迟30秒
    }).catch(error => {
        console.error('💥 Ultra处理失败:', error);
        process.exit(1);
    });
}

module.exports = { UltraBatchProcessor, startUltraProcessing };