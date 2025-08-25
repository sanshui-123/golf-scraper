#!/usr/bin/env node

/**
 * 弹性批处理器 - 企业级稳定处理架构
 * 
 * 设计原则：
 * 1. 状态轻量化：最小化状态检查开销
 * 2. 弹性处理：智能重试和降级
 * 3. 并发控制：合理的并发度管理
 * 4. 断点续传：支持中断恢复
 * 5. 观测性：实时进度和健康监控
 */

const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs').promises;
const path = require('path');

// 🌟 企业级架构支持
const EnterpriseProcessorAdapter = require('./enterprise_processor_adapter');

class ResilientBatchProcessor {
    constructor(options = {}) {
        // 🏗️ 框架级配置管理
        this.options = this._initializeConfiguration(options);
        
        // 🌟 企业级模式检测
        this.enterpriseMode = this._shouldUseEnterpriseMode(options);
        
        if (this.enterpriseMode) {
            console.log('🌟 启用企业级资源管理模式');
            this.enterpriseProcessor = new EnterpriseProcessorAdapter(this.options);
        } else {
            // 🔧 传统模式初始化
            this.processor = new BatchArticleProcessor();
            this.stats = this._initializeStats();
            this.checkpoint = this._initializeCheckpoint();
            
            // 🚨 系统级错误处理
            this._setupErrorHandling();
            
            // 📊 性能监控
            this._setupPerformanceMonitoring();
        }
    }
    
    /**
     * 🌟 企业级模式智能检测
     */
    _shouldUseEnterpriseMode(options) {
        // 🔍 检测条件：
        // 1. 显式启用企业级模式
        if (options.enterpriseMode === true) return true;
        if (process.env.RESILIENT_ENTERPRISE_MODE === 'true') return true;
        
        // 2. 并发度 >= 2 时自动启用（资源管理更重要）
        const concurrency = options.concurrency || 
                           process.env.RESILIENT_CONCURRENCY || 
                           (options.fast ? 3 : options.conservative ? 1 : 2);
        if (concurrency >= 2) return true;
        
        // 3. 检测到资源问题时强制启用
        if (this._detectResourceIssues()) return true;
        
        // 4. 默认启用企业级模式（更安全）
        return true;
    }
    
    /**
     * 🚨 检测系统资源问题
     */
    _detectResourceIssues() {
        try {
            const { execSync } = require('child_process');
            
            // 检测浏览器进程数量
            const browserProcesses = execSync('ps aux | grep -E "(chrome|playwright)" | wc -l', { encoding: 'utf8' });
            const processCount = parseInt(browserProcesses.trim());
            
            if (processCount > 10) {
                console.log(`⚠️ 检测到${processCount}个浏览器进程，启用企业级资源管理`);
                return true;
            }
            
            return false;
        } catch (error) {
            // 检测失败时默认启用企业级模式
            return true;
        }
    }

    /**
     * 🏗️ 企业级配置管理 - 支持环境变量和动态配置
     */
    _initializeConfiguration(options) {
        return {
            // 并发控制 (支持环境变量)
            concurrency: options.concurrency || 
                        process.env.RESILIENT_CONCURRENCY || 
                        (options.fast ? 3 : options.conservative ? 1 : 2),
            
            // 自适应重试策略
            maxRetries: options.maxRetries || 2,
            retryDelay: options.retryDelay || 3000,
            
            // 智能超时控制
            taskTimeout: options.taskTimeout || 180000, // 3分钟
            claudeTimeout: options.claudeTimeout || 120000, // 2分钟
            
            // 企业级持久化
            enableCheckpoint: options.enableCheckpoint !== false,
            checkpointInterval: options.checkpointInterval || 3,
            
            // 智能处理策略
            skipExisting: options.skipExisting !== false,
            enableFailFast: options.enableFailFast !== false,
            
            // 框架级扩展配置
            enableMetrics: options.enableMetrics !== false,
            enableHealthCheck: options.enableHealthCheck !== false,
            logLevel: options.logLevel || 'info',
            
            ...options
        };
    }
    
    /**
     * 📊 性能统计初始化
     */
    _initializeStats() {
        return {
            total: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
            metrics: {
                avgProcessingTime: 0,
                claudeApiCalls: 0,
                claudeApiFailures: 0,
                retryAttempts: 0
            }
        };
    }
    
    /**
     * 💾 检查点状态初始化
     */
    _initializeCheckpoint() {
        return {
            processedUrls: new Set(),
            failedUrls: new Map(),
            sessionId: this.generateSessionId(),
            lastSaved: Date.now()
        };
    }
    
    /**
     * 🚨 系统级错误处理
     */
    _setupErrorHandling() {
        process.on('uncaughtException', (error) => {
            console.error('🚨 系统级错误:', error);
            this.saveEmergencyCheckpoint();
            process.exit(1);
        });
        
        process.on('SIGINT', async () => {
            console.log('\n🛑 收到中断信号，正在保存检查点...');
            await this.saveCheckpoint();
            process.exit(0);
        });
    }
    
    /**
     * 📊 性能监控初始化
     */
    _setupPerformanceMonitoring() {
        if (this.options.enableMetrics) {
            setInterval(() => {
                this._reportMetrics();
            }, 30000); // 每30秒报告一次
        }
    }
    
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 📊 性能指标报告
     */
    _reportMetrics() {
        const duration = Date.now() - this.stats.startTime;
        const completionRate = this.stats.total > 0 ? (this.stats.completed / this.stats.total * 100).toFixed(1) : 0;
        const processingSpeed = duration > 0 ? (this.stats.completed / (duration / 1000 / 60)).toFixed(1) : 0;
        
        console.log(`📈 性能报告: 完成率${completionRate}% | 速度${processingSpeed}篇/分钟 | Claude成功率${this._getClaudeSuccessRate()}%`);
    }
    
    /**
     * 🔍 Claude API成功率计算
     */
    _getClaudeSuccessRate() {
        const { claudeApiCalls, claudeApiFailures } = this.stats.metrics;
        return claudeApiCalls > 0 ? ((claudeApiCalls - claudeApiFailures) / claudeApiCalls * 100).toFixed(1) : 100;
    }
    
    /**
     * 🚨 紧急检查点保存
     */
    async saveEmergencyCheckpoint() {
        try {
            const emergencyFile = `emergency_checkpoint_${this.checkpoint.sessionId}.json`;
            await fs.writeFile(emergencyFile, JSON.stringify({
                ...this.checkpoint,
                stats: this.stats,
                timestamp: new Date().toISOString(),
                reason: 'emergency_save'
            }, null, 2));
            console.log(`🚨 紧急检查点已保存: ${emergencyFile}`);
        } catch (error) {
            console.error('❌ 紧急检查点保存失败:', error.message);
        }
    }
    
    /**
     * 轻量级状态检查 - 只检查必要信息
     */
    async lightweightStateCheck(urls) {
        console.log('⚡ 执行轻量级状态检查...');
        
        const today = new Date().toISOString().split('T')[0];
        const todayDir = path.join('golf_content', today, 'wechat_ready');
        
        let existingFiles = new Set();
        try {
            const files = await fs.readdir(todayDir);
            existingFiles = new Set(files.map(f => f.replace(/^wechat_article_(\d+)\.md$/, '$1')));
        } catch (e) {
            // 目录不存在，所有URL都是新的
        }
        
        const newUrls = [];
        const skippedUrls = [];
        
        for (const url of urls) {
            // 简单的URL哈希检查，避免复杂的状态查询
            const urlHash = this.hashUrl(url);
            
            if (this.options.skipExisting && existingFiles.has(urlHash)) {
                skippedUrls.push(url);
                this.stats.skipped++;
            } else {
                newUrls.push(url);
            }
        }
        
        console.log(`✅ 状态检查完成: ${newUrls.length}个新URL, ${skippedUrls.length}个跳过`);
        return { newUrls, skippedUrls };
    }
    
    hashUrl(url) {
        // 简单但有效的URL哈希算法
        return url.split('/').pop().replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }
    
    /**
     * 弹性任务处理 - 带重试和超时控制
     */
    async processTaskWithResilience(url, index, total) {
        const taskId = `task_${index + 1}`;
        let attempt = 0;
        
        while (attempt < this.options.maxRetries) {
            try {
                console.log(`📄 [${index + 1}/${total}] 处理任务 ${taskId} (尝试 ${attempt + 1})`);
                
                // 设置任务超时
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('任务超时')), this.options.taskTimeout);
                });
                
                const processingPromise = this.processSingleUrlSafely(url);
                
                // 使用Promise.race实现超时控制
                const result = await Promise.race([processingPromise, timeoutPromise]);
                
                console.log(`✅ 任务 ${taskId} 完成`);
                this.stats.completed++;
                
                // 更新检查点
                this.checkpoint.processedUrls.add(url);
                if (this.options.enableCheckpoint && (index + 1) % this.options.checkpointInterval === 0) {
                    await this.saveCheckpoint();
                }
                
                return result;
                
            } catch (error) {
                attempt++;
                console.log(`⚠️ 任务 ${taskId} 失败 (尝试 ${attempt}/${this.options.maxRetries}): ${error.message}`);
                
                if (attempt < this.options.maxRetries) {
                    const delay = this.options.retryDelay * attempt; // 指数退避
                    console.log(`⏳ ${delay/1000}秒后重试...`);
                    await this.sleep(delay);
                } else {
                    console.log(`❌ 任务 ${taskId} 最终失败`);
                    this.stats.failed++;
                    this.checkpoint.failedUrls.set(url, error.message);
                    throw error;
                }
            }
        }
    }
    
    /**
     * 安全的单URL处理 - 隔离错误
     */
    async processSingleUrlSafely(url) {
        try {
            // 创建隔离的处理环境
            const isolatedProcessor = new BatchArticleProcessor();
            
            // 设置当前日期，避免todayDate未定义错误
            const today = new Date().toISOString().split('T')[0];
            process.env.CURRENT_DATE = today;
            
            // 处理单个URL
            const result = await isolatedProcessor.processArticles([url], {
                autoProcess: true,
                maxAttempts: 1,
                skipDuplicateCheck: true,  // 已经在上层检查过了
                timeout: this.options.taskTimeout || 300000  // 5分钟超时
            });
            
            return result;
            
        } catch (error) {
            // 包装错误信息，提供更多上下文
            throw new Error(`URL处理失败 [${url.substring(0, 50)}...]: ${error.message}`);
        }
    }
    
    /**
     * 并发控制处理队列
     */
    async processUrlsConcurrently(urls) {
        console.log(`🚀 启动并发处理: ${urls.length}个URL, 并发度${this.options.concurrency}`);
        
        const results = [];
        const executing = [];
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            
            // 创建任务Promise
            const taskPromise = this.processTaskWithResilience(url, i, urls.length)
                .then(result => ({ url, success: true, result }))
                .catch(error => ({ url, success: false, error: error.message }));
            
            results.push(taskPromise);
            executing.push(taskPromise);
            
            // 控制并发数量
            if (executing.length >= this.options.concurrency) {
                await Promise.race(executing);
                executing.splice(executing.findIndex(p => p.settled), 1);
            }
        }
        
        // 等待所有任务完成
        const finalResults = await Promise.allSettled(results);
        return finalResults.map(r => r.value || r.reason);
    }
    
    /**
     * 主处理入口 - 智能模式切换
     */
    async processUrls(urlFiles) {
        // 🌟 企业级模式自动切换
        if (this.enterpriseMode) {
            console.log('🌟 使用企业级资源管理架构处理');
            return await this.enterpriseProcessor.processUrls(urlFiles);
        }
        
        // 🔧 传统模式处理
        console.log('🌟 使用传统弹性批处理器启动\n');
        
        // 读取所有URL
        const allUrls = await this.readUrlFiles(urlFiles);
        this.stats.total = allUrls.length;
        
        console.log(`📋 总计 ${allUrls.length} 个URL待处理\n`);
        
        // 轻量级状态检查
        const { newUrls, skippedUrls } = await this.lightweightStateCheck(allUrls);
        
        if (newUrls.length === 0) {
            console.log('✅ 所有URL已处理完成');
            return;
        }
        
        console.log(`\n🎯 开始处理 ${newUrls.length} 个新URL\n`);
        
        // 并发处理
        const results = await this.processUrlsConcurrently(newUrls);
        
        // 生成最终报告
        this.generateFinalReport(results);
    }
    
    async readUrlFiles(urlFiles) {
        const allUrls = [];
        
        for (const file of urlFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const urls = content.split('\n')
                    .filter(line => line.trim().startsWith('https://'))
                    .map(line => line.trim());
                
                console.log(`📁 ${file}: ${urls.length} 个URL`);
                allUrls.push(...urls);
            } catch (error) {
                console.log(`⚠️ 无法读取文件 ${file}: ${error.message}`);
            }
        }
        
        return allUrls;
    }
    
    async saveCheckpoint() {
        const checkpointFile = `checkpoint_${this.checkpoint.sessionId}.json`;
        await fs.writeFile(checkpointFile, JSON.stringify(this.checkpoint, null, 2));
        console.log(`💾 检查点已保存: ${checkpointFile}`);
    }
    
    generateFinalReport(results) {
        const duration = Date.now() - this.stats.startTime;
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 处理完成 - 最终报告');
        console.log('='.repeat(60));
        console.log(`⏱️  总耗时: ${(duration / 1000 / 60).toFixed(1)} 分钟`);
        console.log(`📈 成功: ${this.stats.completed}`);
        console.log(`❌ 失败: ${this.stats.failed}`);
        console.log(`⏭️  跳过: ${this.stats.skipped}`);
        console.log(`📊 成功率: ${(this.stats.completed / this.stats.total * 100).toFixed(1)}%`);
        console.log(`⚡ 平均速度: ${(this.stats.completed / (duration / 1000 / 60)).toFixed(1)} 篇/分钟`);
        console.log('='.repeat(60));
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI接口
if (require.main === module) {
    const args = process.argv.slice(2);
    const urlFiles = args.filter(arg => !arg.startsWith('--'));
    
    // 解析选项
    const options = {};
    if (args.includes('--force')) options.skipExisting = false;
    if (args.includes('--fast')) options.concurrency = 3;
    
    const processor = new ResilientBatchProcessor(options);
    
    processor.processUrls(urlFiles)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ 处理失败:', error);
            process.exit(1);
        });
}

module.exports = ResilientBatchProcessor;