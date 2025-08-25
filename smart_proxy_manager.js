#!/usr/bin/env node

/**
 * 智能代理池管理器
 * 基于ProxyRotationManager的增强版本，提供智能管理功能
 * 用于访问腾讯AI检测平台 (https://matrix.tencent.com/ai-detect/)
 */

const ProxyRotationManager = require('./proxy_rotation_manager');
const fs = require('fs').promises;
const path = require('path');

// 优先队列实现
class PriorityQueue {
    constructor() {
        this.items = [];
    }
    
    enqueue(element, priority) {
        const queueElement = { element, priority };
        let added = false;
        
        for (let i = 0; i < this.items.length; i++) {
            if (queueElement.priority > this.items[i].priority) {
                this.items.splice(i, 0, queueElement);
                added = true;
                break;
            }
        }
        
        if (!added) {
            this.items.push(queueElement);
        }
    }
    
    dequeue() {
        return this.items.shift();
    }
    
    isEmpty() {
        return this.items.length === 0;
    }
    
    clear() {
        this.items = [];
    }
    
    size() {
        return this.items.length;
    }
}

class SmartProxyManager extends ProxyRotationManager {
    constructor() {
        super();
        
        // 智能管理配置
        this.smartConfig = {
            enableSmartManagement: true,
            healthCheckInterval: 300000, // 5分钟
            minSuccessRate: 0.3,
            maxConsecutiveFailures: 5,
            maxResponseTime: 10000,
            targetUrl: 'https://matrix.tencent.com/ai-detect/',
            testText: '这是一个测试文本，用于检测AI概率。'
        };
        
        // 优先队列
        this.proxyQueue = new PriorityQueue();
        
        // 分析数据存储路径
        this.analyticsPath = path.join(__dirname, 'proxy_analytics.json');
        this.blacklistPath = path.join(__dirname, 'proxy_blacklist.json');
        
        // 健康检查定时器
        this.healthCheckTimer = null;
        
        // 代理统计增强
        this.proxyStatistics = {};
        
        // 黑名单
        this.blacklist = new Set();
    }
    
    /**
     * 初始化智能代理管理器
     */
    async initialize() {
        try {
            // 调用父类初始化
            await super.initialize();
            
            // 加载智能配置
            await this.loadSmartConfig();
            
            // 加载分析数据
            await this.loadAnalytics();
            
            // 加载黑名单
            await this.loadBlacklist();
            
            // 初始化代理统计
            this.initializeStatistics();
            
            // 启动健康检查
            if (this.smartConfig.enableSmartManagement) {
                this.startHealthCheck();
            }
            
            // 构建优先队列
            await this.rebuildPriorityQueue();
            
            console.log('🚀 智能代理管理器初始化成功');
            console.log(`📊 智能管理: ${this.smartConfig.enableSmartManagement ? '已启用' : '已禁用'}`);
            
        } catch (error) {
            console.error('❌ 智能代理管理器初始化失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 加载智能配置
     */
    async loadSmartConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // 合并智能配置
            if (config.smartConfig) {
                this.smartConfig = { ...this.smartConfig, ...config.smartConfig };
            }
        } catch (error) {
            // 使用默认配置
        }
    }
    
    /**
     * 加载分析数据
     */
    async loadAnalytics() {
        try {
            const data = await fs.readFile(this.analyticsPath, 'utf8');
            const analytics = JSON.parse(data);
            this.proxyStatistics = analytics.statistics || {};
        } catch (error) {
            console.log('📊 初始化分析数据');
            this.proxyStatistics = {};
        }
    }
    
    /**
     * 加载黑名单
     */
    async loadBlacklist() {
        try {
            const data = await fs.readFile(this.blacklistPath, 'utf8');
            const blacklist = JSON.parse(data);
            this.blacklist = new Set(blacklist.proxies || []);
        } catch (error) {
            console.log('📋 初始化黑名单');
            this.blacklist = new Set();
        }
    }
    
    /**
     * 保存分析数据
     */
    async saveAnalytics() {
        try {
            const analytics = {
                timestamp: new Date().toISOString(),
                statistics: this.proxyStatistics,
                summary: await this.getSystemHealth()
            };
            
            await fs.writeFile(this.analyticsPath, JSON.stringify(analytics, null, 2));
        } catch (error) {
            console.error('❌ 保存分析数据失败:', error.message);
        }
    }
    
    /**
     * 保存黑名单
     */
    async saveBlacklist() {
        try {
            const blacklist = {
                timestamp: new Date().toISOString(),
                proxies: Array.from(this.blacklist)
            };
            
            await fs.writeFile(this.blacklistPath, JSON.stringify(blacklist, null, 2));
        } catch (error) {
            console.error('❌ 保存黑名单失败:', error.message);
        }
    }
    
    /**
     * 初始化代理统计
     */
    initializeStatistics() {
        for (const proxy of this.proxies) {
            const proxyKey = this.getProxyKey(proxy);
            
            if (!this.proxyStatistics[proxyKey]) {
                this.proxyStatistics[proxyKey] = {
                    total_requests: 0,
                    success_count: 0,
                    fail_count: 0,
                    total_response_time: 0,
                    avg_response_time: 0,
                    last_success_time: null,
                    consecutive_failures: 0,
                    health_score: 100,
                    last_check_time: null,
                    is_blocked: false,
                    failure_reasons: {}
                };
            }
        }
    }
    
    /**
     * 启动健康检查
     */
    startHealthCheck() {
        // 立即执行一次健康检查
        this.performHealthCheck();
        
        // 设置定期健康检查
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.smartConfig.healthCheckInterval);
        
        console.log('🏥 健康检查已启动，间隔:', this.smartConfig.healthCheckInterval / 1000, '秒');
    }
    
    /**
     * 停止健康检查
     */
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
            console.log('🏥 健康检查已停止');
        }
    }
    
    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        console.log('🏥 开始代理健康检查...');
        
        for (const proxy of this.proxies) {
            const proxyKey = this.getProxyKey(proxy);
            
            // 跳过黑名单中的代理
            if (this.blacklist.has(proxyKey)) {
                continue;
            }
            
            const startTime = Date.now();
            const isHealthy = await this.proxyHealthChecker(proxy);
            const responseTime = Date.now() - startTime;
            
            const stats = this.proxyStatistics[proxyKey];
            if (stats) {
                stats.last_check_time = new Date().toISOString();
                
                if (isHealthy) {
                    stats.consecutive_failures = 0;
                    stats.is_blocked = false;
                    
                    // 更新响应时间
                    stats.total_response_time += responseTime;
                    stats.avg_response_time = stats.total_response_time / (stats.success_count + 1);
                } else {
                    stats.consecutive_failures++;
                    
                    // 检查是否需要加入黑名单
                    if (stats.consecutive_failures >= this.smartConfig.maxConsecutiveFailures) {
                        await this.addToBlacklist(proxy, '连续健康检查失败');
                    }
                }
                
                // 更新健康评分
                stats.health_score = this.calculateHealthScore(stats);
            }
        }
        
        // 保存分析数据
        await this.saveAnalytics();
        
        // 重建优先队列
        await this.rebuildPriorityQueue();
        
        // 检查系统健康状态
        await this.checkSystemHealth();
    }
    
    /**
     * 代理健康检查器
     * @param {Object} proxy - 代理配置
     * @returns {Promise<boolean>} 是否健康
     */
    async proxyHealthChecker(proxy) {
        try {
            const { chromium } = require('playwright');
            const browser = await chromium.launch({
                headless: true,
                proxy: this.getPlaywrightProxyConfig(proxy),
                timeout: this.smartConfig.maxResponseTime
            });
            
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            const page = await context.newPage();
            
            // 访问腾讯AI检测平台
            await page.goto(this.smartConfig.targetUrl, {
                timeout: this.smartConfig.maxResponseTime,
                waitUntil: 'domcontentloaded'
            });
            
            // 检查页面是否正常加载
            const title = await page.title();
            const isAccessible = title && !title.includes('Error') && !title.includes('Blocked');
            
            await browser.close();
            
            if (isAccessible) {
                console.log(`✅ 代理健康: ${proxy.name || this.getProxyKey(proxy)}`);
                return true;
            } else {
                console.log(`❌ 代理可能被封禁: ${proxy.name || this.getProxyKey(proxy)}`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ 代理不健康: ${proxy.name || this.getProxyKey(proxy)} - ${error.message}`);
            
            // 记录失败原因
            const proxyKey = this.getProxyKey(proxy);
            const stats = this.proxyStatistics[proxyKey];
            if (stats) {
                const reason = this.categorizeError(error);
                stats.failure_reasons[reason] = (stats.failure_reasons[reason] || 0) + 1;
            }
            
            return false;
        }
    }
    
    /**
     * 计算健康评分
     * @param {Object} stats - 代理统计数据
     * @returns {number} 健康评分 (0-100)
     */
    calculateHealthScore(stats) {
        if (stats.total_requests === 0) return 100;
        
        const successRate = stats.success_count / stats.total_requests;
        const avgResponseTime = stats.avg_response_time || 0;
        const recentFailures = stats.consecutive_failures;
        
        // 计算各项得分
        const successScore = successRate * 100 * 0.5; // 50%权重
        const responseScore = Math.max(0, 100 - (avgResponseTime / 100)) * 0.3; // 30%权重
        const reliabilityScore = Math.max(0, 100 - (recentFailures * 20)) * 0.2; // 20%权重
        
        const totalScore = Math.round(successScore + responseScore + reliabilityScore);
        
        return Math.max(0, Math.min(100, totalScore));
    }
    
    /**
     * 计算代理优先级分数
     * @param {Object} proxy - 代理配置
     * @returns {number} 优先级分数
     */
    calculateProxyScore(proxy) {
        const proxyKey = this.getProxyKey(proxy);
        const stats = this.proxyStatistics[proxyKey];
        const status = this.proxyStatus[proxyKey];
        
        if (!stats || !status) return 0;
        
        // 黑名单代理得分为0
        if (this.blacklist.has(proxyKey)) return 0;
        
        // 不健康代理得分为0
        if (!status.isHealthy || stats.is_blocked) return 0;
        
        // 计算成功率 (40%权重)
        const successRate = stats.total_requests > 0 ? stats.success_count / stats.total_requests : 1;
        const successScore = successRate * 40;
        
        // 计算响应时间分数 (30%权重)
        const responseScore = stats.avg_response_time > 0 
            ? Math.max(0, 30 - (stats.avg_response_time / 1000) * 3)
            : 30;
        
        // 计算可用配额分数 (20%权重)
        const quotaRemaining = this.dailyLimit - status.usedToday;
        const quotaScore = (quotaRemaining / this.dailyLimit) * 20;
        
        // 计算最近使用时间分数 (10%权重)
        const lastUsedTime = status.lastUsedTime ? new Date(status.lastUsedTime) : new Date(0);
        const timeSinceLastUse = Date.now() - lastUsedTime.getTime();
        const timeScore = Math.min(10, timeSinceLastUse / (1000 * 60 * 60) * 2); // 每小时2分
        
        const totalScore = successScore + responseScore + quotaScore + timeScore;
        
        return Math.round(totalScore);
    }
    
    /**
     * 重建优先队列
     */
    async rebuildPriorityQueue() {
        this.proxyQueue.clear();
        
        for (const proxy of this.proxies) {
            const score = this.calculateProxyScore(proxy);
            if (score > 0) {
                this.proxyQueue.enqueue(proxy, score);
            }
        }
        
        console.log(`📊 优先队列已重建，可用代理数: ${this.proxyQueue.size()}`);
    }
    
    /**
     * 获取最优代理 (替代getNextProxy)
     * @param {boolean} excludeFailed - 是否排除失败的代理
     * @returns {Object|null} 代理配置或null
     */
    async getOptimalProxy(excludeFailed = true) {
        // 如果禁用智能管理，使用父类方法
        if (!this.smartConfig.enableSmartManagement) {
            return await super.getNextProxy(excludeFailed);
        }
        
        // 确保优先队列不为空
        if (this.proxyQueue.isEmpty()) {
            await this.rebuildPriorityQueue();
        }
        
        // 从优先队列中获取代理
        while (!this.proxyQueue.isEmpty()) {
            const item = this.proxyQueue.dequeue();
            const proxy = item.element;
            const proxyKey = this.getProxyKey(proxy);
            const status = this.proxyStatus[proxyKey];
            
            // 检查配额
            if (status && status.usedToday < this.dailyLimit) {
                console.log(`🎯 使用最优代理: ${proxy.name || proxyKey} (评分: ${item.priority}, 今日已用: ${status.usedToday}/${this.dailyLimit})`);
                return proxy;
            }
        }
        
        console.error('❌ 没有可用的代理');
        return null;
    }
    
    /**
     * 记录代理使用（增强版）
     * @param {Object} proxy - 代理配置
     * @param {boolean} success - 是否成功
     * @param {number} responseTime - 响应时间(ms)
     * @param {string} errorReason - 失败原因
     */
    async recordProxyUsage(proxy, success, responseTime = 0, errorReason = null) {
        // 调用父类方法
        await super.recordProxyUsage(proxy, success);
        
        const proxyKey = this.getProxyKey(proxy);
        const stats = this.proxyStatistics[proxyKey];
        
        if (!stats) return;
        
        // 更新统计数据
        stats.total_requests++;
        
        if (success) {
            stats.success_count++;
            stats.consecutive_failures = 0;
            stats.last_success_time = new Date().toISOString();
            
            // 更新响应时间
            if (responseTime > 0) {
                stats.total_response_time += responseTime;
                stats.avg_response_time = stats.total_response_time / stats.success_count;
            }
        } else {
            stats.fail_count++;
            stats.consecutive_failures++;
            
            // 记录失败原因
            if (errorReason) {
                stats.failure_reasons[errorReason] = (stats.failure_reasons[errorReason] || 0) + 1;
            }
            
            // 检查是否需要自动剔除
            await this.checkAutoRemoval(proxy, stats);
        }
        
        // 更新健康评分
        stats.health_score = this.calculateHealthScore(stats);
        
        // 保存分析数据
        await this.saveAnalytics();
        
        // 如果启用智能管理，重建优先队列
        if (this.smartConfig.enableSmartManagement) {
            await this.rebuildPriorityQueue();
        }
    }
    
    /**
     * 智能故障转移
     * @param {Object} failedProxy - 失败的代理
     * @param {string} errorType - 错误类型
     * @returns {Object|null} 新的代理或null
     */
    async smartFailover(failedProxy, errorType) {
        console.log(`🔄 智能故障转移: ${failedProxy.name || this.getProxyKey(failedProxy)} (错误: ${errorType})`);
        
        // 根据错误类型采取不同策略
        switch (errorType) {
            case 'NETWORK_ERROR':
            case 'TIMEOUT':
                // 网络错误或超时，尝试下一个代理
                return await this.getOptimalProxy(true);
                
            case 'BLOCKED':
                // 被封禁，加入黑名单并尝试下一个
                await this.addToBlacklist(failedProxy, '被腾讯平台封禁');
                return await this.getOptimalProxy(true);
                
            case 'QUOTA_EXCEEDED':
                // 配额用尽，只能尝试其他代理
                return await this.getOptimalProxy(true);
                
            default:
                // 其他错误，尝试下一个代理
                return await this.getOptimalProxy(true);
        }
    }
    
    /**
     * 错误分类
     * @param {Error} error - 错误对象
     * @returns {string} 错误类型
     */
    categorizeError(error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            return 'TIMEOUT';
        } else if (errorMessage.includes('blocked') || errorMessage.includes('forbidden')) {
            return 'BLOCKED';
        } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
            return 'QUOTA_EXCEEDED';
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
            return 'NETWORK_ERROR';
        } else {
            return 'UNKNOWN_ERROR';
        }
    }
    
    /**
     * 检查是否需要自动剔除
     * @param {Object} proxy - 代理配置
     * @param {Object} stats - 代理统计数据
     */
    async checkAutoRemoval(proxy, stats) {
        const successRate = stats.total_requests > 0 ? stats.success_count / stats.total_requests : 1;
        
        // 检查剔除条件
        let shouldRemove = false;
        let reason = '';
        
        if (successRate < this.smartConfig.minSuccessRate && stats.total_requests >= 10) {
            shouldRemove = true;
            reason = `成功率过低 (${(successRate * 100).toFixed(1)}%)`;
        } else if (stats.consecutive_failures >= this.smartConfig.maxConsecutiveFailures) {
            shouldRemove = true;
            reason = `连续失败 ${stats.consecutive_failures} 次`;
        } else if (stats.avg_response_time > this.smartConfig.maxResponseTime) {
            shouldRemove = true;
            reason = `响应时间过长 (${(stats.avg_response_time / 1000).toFixed(1)}秒)`;
        } else if (stats.is_blocked) {
            shouldRemove = true;
            reason = '被平台封禁';
        }
        
        if (shouldRemove) {
            await this.addToBlacklist(proxy, reason);
        }
    }
    
    /**
     * 添加到黑名单
     * @param {Object} proxy - 代理配置
     * @param {string} reason - 原因
     */
    async addToBlacklist(proxy, reason) {
        const proxyKey = this.getProxyKey(proxy);
        
        if (!this.blacklist.has(proxyKey)) {
            this.blacklist.add(proxyKey);
            console.log(`🚫 代理加入黑名单: ${proxy.name || proxyKey} (原因: ${reason})`);
            
            // 保存黑名单
            await this.saveBlacklist();
            
            // 发出警告
            await this.checkSystemHealth();
        }
    }
    
    /**
     * 从黑名单移除
     * @param {string} proxyKey - 代理标识
     */
    async removeFromBlacklist(proxyKey) {
        if (this.blacklist.has(proxyKey)) {
            this.blacklist.delete(proxyKey);
            console.log(`✅ 代理移出黑名单: ${proxyKey}`);
            
            // 重置统计数据
            if (this.proxyStatistics[proxyKey]) {
                this.proxyStatistics[proxyKey].consecutive_failures = 0;
                this.proxyStatistics[proxyKey].is_blocked = false;
            }
            
            // 保存黑名单
            await this.saveBlacklist();
        }
    }
    
    /**
     * 获取代理健康状态
     * @param {string} proxyKey - 代理标识
     * @returns {Object} 健康状态
     */
    getProxyHealth(proxyKey) {
        const stats = this.proxyStatistics[proxyKey];
        const status = this.proxyStatus[proxyKey];
        
        if (!stats || !status) {
            return { healthy: false, reason: '未找到代理' };
        }
        
        return {
            healthy: status.isHealthy && !this.blacklist.has(proxyKey),
            health_score: stats.health_score,
            success_rate: stats.total_requests > 0 ? stats.success_count / stats.total_requests : 0,
            avg_response_time: stats.avg_response_time,
            consecutive_failures: stats.consecutive_failures,
            used_today: status.usedToday,
            daily_limit: this.dailyLimit,
            in_blacklist: this.blacklist.has(proxyKey),
            last_check_time: stats.last_check_time
        };
    }
    
    /**
     * 强制健康检查
     */
    async forceHealthCheck() {
        console.log('🏥 执行强制健康检查...');
        await this.performHealthCheck();
    }
    
    /**
     * 获取系统健康状态
     * @returns {Object} 系统健康状态
     */
    async getSystemHealth() {
        const totalProxies = this.proxies.length;
        const blacklistedProxies = this.blacklist.size;
        const availableProxies = totalProxies - blacklistedProxies;
        
        let totalRequests = 0;
        let totalSuccess = 0;
        let totalResponseTime = 0;
        let healthyProxies = 0;
        
        for (const proxy of this.proxies) {
            const proxyKey = this.getProxyKey(proxy);
            
            if (this.blacklist.has(proxyKey)) continue;
            
            const stats = this.proxyStatistics[proxyKey];
            const status = this.proxyStatus[proxyKey];
            
            if (stats && status) {
                totalRequests += stats.total_requests;
                totalSuccess += stats.success_count;
                totalResponseTime += stats.total_response_time;
                
                if (status.isHealthy && stats.health_score >= 60) {
                    healthyProxies++;
                }
            }
        }
        
        const overallSuccessRate = totalRequests > 0 ? totalSuccess / totalRequests : 0;
        const avgResponseTime = totalSuccess > 0 ? totalResponseTime / totalSuccess : 0;
        
        return {
            total_proxies: totalProxies,
            available_proxies: availableProxies,
            healthy_proxies: healthyProxies,
            blacklisted_proxies: blacklistedProxies,
            overall_success_rate: overallSuccessRate,
            average_response_time: avgResponseTime,
            total_requests: totalRequests,
            total_success: totalSuccess,
            system_status: this.getSystemStatus(availableProxies, overallSuccessRate)
        };
    }
    
    /**
     * 获取系统状态
     * @param {number} availableProxies - 可用代理数
     * @param {number} successRate - 成功率
     * @returns {string} 系统状态
     */
    getSystemStatus(availableProxies, successRate) {
        if (availableProxies < 3) {
            return 'CRITICAL';
        } else if (successRate < 0.5) {
            return 'WARNING';
        } else {
            return 'HEALTHY';
        }
    }
    
    /**
     * 检查系统健康并发出警告
     */
    async checkSystemHealth() {
        const health = await this.getSystemHealth();
        
        if (health.system_status === 'CRITICAL') {
            console.error('🚨 系统状态危急: 可用代理数量不足！');
            console.error(`   可用代理: ${health.available_proxies}/${health.total_proxies}`);
        } else if (health.system_status === 'WARNING') {
            console.warn('⚠️  系统警告: 整体成功率过低！');
            console.warn(`   成功率: ${(health.overall_success_rate * 100).toFixed(1)}%`);
        }
    }
    
    /**
     * 导出分析数据
     * @returns {Object} 完整分析数据
     */
    async exportAnalytics() {
        return {
            timestamp: new Date().toISOString(),
            system_health: await this.getSystemHealth(),
            proxy_statistics: this.proxyStatistics,
            blacklist: Array.from(this.blacklist),
            configuration: this.smartConfig
        };
    }
    
    /**
     * 获取代理统计信息（增强版）
     * @returns {Object} 详细统计信息
     */
    async getProxyStatistics() {
        const baseStats = await super.getProxyStats();
        
        // 添加智能统计信息
        const smartStats = {
            ...baseStats,
            system_health: await this.getSystemHealth(),
            smart_management: this.smartConfig.enableSmartManagement,
            blacklisted_count: this.blacklist.size,
            priority_queue_size: this.proxyQueue.size(),
            detailed_proxy_info: []
        };
        
        // 添加每个代理的详细信息
        for (const detail of baseStats.proxyDetails) {
            const proxyKey = `${detail.type}://${detail.name}`;
            const stats = this.proxyStatistics[proxyKey] || {};
            
            smartStats.detailed_proxy_info.push({
                ...detail,
                health_score: stats.health_score || 0,
                success_rate: stats.total_requests > 0 ? (stats.success_count / stats.total_requests * 100).toFixed(1) + '%' : 'N/A',
                avg_response_time: stats.avg_response_time ? (stats.avg_response_time / 1000).toFixed(2) + 's' : 'N/A',
                consecutive_failures: stats.consecutive_failures || 0,
                in_blacklist: this.blacklist.has(proxyKey),
                priority_score: this.calculateProxyScore({ type: detail.type, host: detail.name.split(':')[0], port: detail.name.split(':')[1] })
            });
        }
        
        return smartStats;
    }
    
    /**
     * 清理方法
     */
    async cleanup() {
        // 停止健康检查
        this.stopHealthCheck();
        
        // 保存最终状态
        await this.saveAnalytics();
        await this.saveStatus();
        
        console.log('🧹 智能代理管理器已清理');
    }
}

// 向后兼容：保持getNextProxy方法
SmartProxyManager.prototype.getNextProxy = SmartProxyManager.prototype.getOptimalProxy;

// 导出模块
module.exports = SmartProxyManager;

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    const manager = new SmartProxyManager();
    
    (async () => {
        try {
            await manager.initialize();
            
            if (args[0] === 'stats') {
                // 显示增强统计信息
                const stats = await manager.getProxyStatistics();
                console.log('\n📊 智能代理池统计信息:');
                console.log('='.repeat(50));
                console.log(`系统状态: ${stats.system_health.system_status}`);
                console.log(`总代理数: ${stats.totalProxies}`);
                console.log(`可用代理: ${stats.system_health.available_proxies}`);
                console.log(`健康代理: ${stats.healthyProxies}`);
                console.log(`黑名单代理: ${stats.blacklisted_count}`);
                console.log(`整体成功率: ${(stats.system_health.overall_success_rate * 100).toFixed(1)}%`);
                console.log(`平均响应时间: ${(stats.system_health.average_response_time / 1000).toFixed(2)}秒`);
                console.log(`今日总配额: ${stats.totalQuotaToday}`);
                console.log(`今日已用: ${stats.usedQuotaToday}`);
                console.log(`今日剩余: ${stats.remainingQuotaToday}`);
                console.log('\n详细信息:');
                console.log('='.repeat(50));
                stats.detailed_proxy_info.forEach(detail => {
                    const status = detail.in_blacklist ? '🚫' : (detail.isHealthy ? '✅' : '❌');
                    console.log(`${status} ${detail.name}:`);
                    console.log(`   健康评分: ${detail.health_score}/100`);
                    console.log(`   成功率: ${detail.success_rate}`);
                    console.log(`   平均响应: ${detail.avg_response_time}`);
                    console.log(`   今日使用: ${detail.usedToday}/${detail.dailyLimit}`);
                    console.log(`   优先级分: ${detail.priority_score}`);
                    if (detail.consecutive_failures > 0) {
                        console.log(`   连续失败: ${detail.consecutive_failures}次`);
                    }
                });
                
            } else if (args[0] === 'health-check') {
                // 强制健康检查
                await manager.forceHealthCheck();
                
            } else if (args[0] === 'remove-blacklist' && args[1]) {
                // 从黑名单移除
                await manager.removeFromBlacklist(args[1]);
                
            } else if (args[0] === 'export') {
                // 导出分析数据
                const analytics = await manager.exportAnalytics();
                const filename = `proxy_analytics_export_${Date.now()}.json`;
                await fs.writeFile(filename, JSON.stringify(analytics, null, 2));
                console.log(`📊 分析数据已导出到: ${filename}`);
                
            } else if (args[0] === 'auto-clean') {
                // 自动清理低质量代理
                console.log('🧹 开始自动清理低质量代理...');
                const health = await manager.getSystemHealth();
                console.log(`清理前: ${health.available_proxies} 个可用代理`);
                
                // 执行健康检查（会自动剔除不合格的代理）
                await manager.forceHealthCheck();
                
                const healthAfter = await manager.getSystemHealth();
                console.log(`清理后: ${healthAfter.available_proxies} 个可用代理`);
                
            } else {
                console.log(`
智能代理池管理器 - 使用方法:
  node smart_proxy_manager.js stats         - 显示详细统计信息
  node smart_proxy_manager.js health-check  - 强制执行健康检查
  node smart_proxy_manager.js remove-blacklist <proxyKey> - 从黑名单移除
  node smart_proxy_manager.js export        - 导出完整分析数据
  node smart_proxy_manager.js auto-clean    - 自动清理低质量代理
                `);
            }
            
            // 清理
            await manager.cleanup();
            
        } catch (error) {
            console.error('执行失败:', error);
            process.exit(1);
        }
    })();
}