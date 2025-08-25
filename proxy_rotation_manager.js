#!/usr/bin/env node

/**
 * 代理池轮换管理器
 * 用于管理和轮换代理，突破AI检测平台的访问限制
 */

const fs = require('fs').promises;
const path = require('path');

class ProxyRotationManager {
    constructor() {
        this.configPath = path.join(__dirname, 'proxy_config.json');
        this.statusPath = path.join(__dirname, 'proxy_status.json');
        this.proxies = [];
        this.proxyStatus = {};
        this.currentIndex = 0;
        this.dailyLimit = 18; // 每个代理每日限制
        this.rotationStrategy = 'round-robin'; // 轮换策略
    }

    /**
     * 初始化代理管理器
     */
    async initialize() {
        try {
            // 加载配置
            await this.loadConfig();
            
            // 加载或初始化状态
            await this.loadStatus();
            
            // 检查是否需要重置日配额
            this.checkDailyReset();
            
            console.log(`🌐 代理管理器初始化成功，共有 ${this.proxies.length} 个代理`);
            
        } catch (error) {
            console.error('❌ 代理管理器初始化失败:', error.message);
            throw error;
        }
    }

    /**
     * 加载代理配置
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            this.proxies = config.proxies || [];
            this.dailyLimit = config.dailyLimit || 18;
            this.rotationStrategy = config.rotationStrategy || 'round-robin';
            
            // 验证代理配置
            this.proxies = this.proxies.filter(proxy => {
                if (!proxy.host || (!proxy.port && proxy.type !== 'direct')) {
                    console.warn('⚠️ 无效的代理配置:', proxy);
                    return false;
                }
                return true;
            });
            
        } catch (error) {
            console.warn('⚠️ 未找到代理配置文件，使用默认配置');
            
            // 创建默认配置
            const defaultConfig = {
                proxies: [
                    { type: 'direct', host: 'direct', name: '直连' }
                ],
                rotationStrategy: 'round-robin',
                dailyLimit: 18,
                retryWithNextProxy: true
            };
            
            await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
            this.proxies = defaultConfig.proxies;
        }
    }

    /**
     * 加载代理状态
     */
    async loadStatus() {
        try {
            const statusData = await fs.readFile(this.statusPath, 'utf8');
            this.proxyStatus = JSON.parse(statusData);
        } catch (error) {
            console.log('📝 初始化代理状态');
            this.proxyStatus = {};
            await this.saveStatus();
        }
    }

    /**
     * 保存代理状态
     */
    async saveStatus() {
        try {
            await fs.writeFile(this.statusPath, JSON.stringify(this.proxyStatus, null, 2));
        } catch (error) {
            console.error('❌ 保存代理状态失败:', error.message);
        }
    }

    /**
     * 检查并重置日配额
     */
    checkDailyReset() {
        const today = new Date().toDateString();
        
        for (const proxyKey of Object.keys(this.proxyStatus)) {
            if (this.proxyStatus[proxyKey].lastResetDate !== today) {
                this.proxyStatus[proxyKey] = {
                    usedToday: 0,
                    totalUsed: this.proxyStatus[proxyKey]?.totalUsed || 0,
                    lastUsedTime: this.proxyStatus[proxyKey]?.lastUsedTime,
                    lastResetDate: today,
                    isHealthy: true,
                    failureCount: 0
                };
            }
        }
        
        this.saveStatus();
    }

    /**
     * 检查代理健康恢复
     * 如果代理失败超过1小时，自动恢复健康状态
     */
    async checkHealthRecovery() {
        const now = Date.now();
        const recoveryTime = 60 * 60 * 1000; // 1小时
        let hasChanges = false;
        
        for (const proxyKey in this.proxyStatus) {
            const status = this.proxyStatus[proxyKey];
            
            if (!status.isHealthy && status.lastUsedTime) {
                const timeSinceLastUse = now - new Date(status.lastUsedTime).getTime();
                
                if (timeSinceLastUse > recoveryTime) {
                    status.isHealthy = true;
                    status.failureCount = 0;
                    console.log(`🔄 代理 ${proxyKey} 健康状态已自动恢复`);
                    hasChanges = true;
                }
            }
        }
        
        if (hasChanges) {
            await this.saveStatus();
        }
    }

    /**
     * 获取代理的唯一标识
     */
    getProxyKey(proxy) {
        if (proxy.type === 'direct') {
            return 'direct';
        }
        return `${proxy.type}://${proxy.host}:${proxy.port}`;
    }

    /**
     * 获取下一个可用代理
     * @param {boolean} excludeFailed - 是否排除失败的代理
     * @returns {Object|null} 代理配置或null
     */
    async getNextProxy(excludeFailed = true) {
        // 检查是否需要恢复健康状态
        await this.checkHealthRecovery();
        
        if (this.proxies.length === 0) {
            console.error('❌ 没有可用的代理');
            return null;
        }

        let attempts = 0;
        const maxAttempts = this.proxies.length;

        while (attempts < maxAttempts) {
            const proxy = this.proxies[this.currentIndex];
            const proxyKey = this.getProxyKey(proxy);

            // 初始化代理状态
            if (!this.proxyStatus[proxyKey]) {
                this.proxyStatus[proxyKey] = {
                    usedToday: 0,
                    totalUsed: 0,
                    lastUsedTime: null,
                    lastResetDate: new Date().toDateString(),
                    isHealthy: true,
                    failureCount: 0
                };
            }

            const status = this.proxyStatus[proxyKey];

            // 检查代理是否可用
            if (status.isHealthy && status.usedToday < this.dailyLimit) {
                // 更新索引（轮询策略）
                this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
                
                console.log(`🔄 使用代理: ${proxy.name || proxyKey} (今日已用: ${status.usedToday}/${this.dailyLimit})`);
                return proxy;
            }

            // 如果代理不可用，尝试下一个
            this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
            attempts++;
        }

        console.error('❌ 所有代理都已达到限制或不可用');
        return null;
    }

    /**
     * 记录代理使用
     * @param {Object} proxy - 代理配置
     * @param {boolean} success - 是否成功
     * @param {string} errorType - 错误类型（可选）
     */
    async recordProxyUsage(proxy, success, errorType = null) {
        const proxyKey = this.getProxyKey(proxy);
        const status = this.proxyStatus[proxyKey];

        if (!status) {
            console.error('❌ 代理状态不存在:', proxyKey);
            return;
        }

        if (success) {
            status.usedToday++;
            status.totalUsed++;
            status.lastUsedTime = new Date().toISOString();
            status.failureCount = 0;
            status.isHealthy = true;
            
            console.log(`✅ 代理使用成功: ${proxy.name || proxyKey} (今日: ${status.usedToday}/${this.dailyLimit})`);
        } else {
            // 临时性错误（网络超时等）不应永久禁用代理
            const temporaryErrors = ['TIMEOUT', 'NETWORK_ERROR', 'CONNECTION_REFUSED', 'NET_ERR_TIMED_OUT'];
            const isPermanentError = errorType && !temporaryErrors.includes(errorType);
            
            status.lastUsedTime = new Date().toISOString();
            
            if (isPermanentError) {
                status.failureCount++;
            } else {
                // 临时错误只警告，不增加失败计数
                console.warn(`⚠️ 代理临时错误: ${errorType || '未知'} - ${proxy.name || proxyKey}`);
            }
            
            // 只有永久性错误累计3次才标记为不健康
            if (isPermanentError && status.failureCount >= 3) {
                status.isHealthy = false;
                console.error(`❌ 代理标记为不健康: ${proxy.name || proxyKey} (连续永久错误 ${status.failureCount} 次)`);
            } else if (isPermanentError) {
                console.warn(`⚠️ 代理使用失败: ${proxy.name || proxyKey} (失败次数: ${status.failureCount})`);
            }
        }

        await this.saveStatus();
    }

    /**
     * 获取代理统计信息
     */
    async getProxyStats() {
        const stats = {
            totalProxies: this.proxies.length,
            healthyProxies: 0,
            totalQuotaToday: 0,
            usedQuotaToday: 0,
            proxyDetails: []
        };

        for (const proxy of this.proxies) {
            const proxyKey = this.getProxyKey(proxy);
            const status = this.proxyStatus[proxyKey] || {
                usedToday: 0,
                isHealthy: true,
                failureCount: 0
            };

            if (status.isHealthy) {
                stats.healthyProxies++;
                stats.totalQuotaToday += this.dailyLimit;
                stats.usedQuotaToday += status.usedToday;
            }

            stats.proxyDetails.push({
                name: proxy.name || proxyKey,
                type: proxy.type,
                usedToday: status.usedToday,
                dailyLimit: this.dailyLimit,
                isHealthy: status.isHealthy,
                failureCount: status.failureCount,
                lastUsedTime: status.lastUsedTime
            });
        }

        stats.remainingQuotaToday = stats.totalQuotaToday - stats.usedQuotaToday;
        
        return stats;
    }

    /**
     * 重置代理状态（手动重置）
     * @param {string} proxyKey - 代理标识，如果为空则重置所有
     */
    async resetProxyStatus(proxyKey = null) {
        const today = new Date().toDateString();

        if (proxyKey) {
            if (this.proxyStatus[proxyKey]) {
                this.proxyStatus[proxyKey] = {
                    usedToday: 0,
                    totalUsed: this.proxyStatus[proxyKey].totalUsed || 0,
                    lastUsedTime: null,
                    lastResetDate: today,
                    isHealthy: true,
                    failureCount: 0
                };
                console.log(`🔄 已重置代理状态: ${proxyKey}`);
            }
        } else {
            // 重置所有代理
            for (const key of Object.keys(this.proxyStatus)) {
                this.proxyStatus[key] = {
                    usedToday: 0,
                    totalUsed: this.proxyStatus[key].totalUsed || 0,
                    lastUsedTime: null,
                    lastResetDate: today,
                    isHealthy: true,
                    failureCount: 0
                };
            }
            console.log('🔄 已重置所有代理状态');
        }

        await this.saveStatus();
    }

    /**
     * 测试代理连接
     * @param {Object} proxy - 代理配置
     * @returns {Promise<boolean>} 是否可用
     */
    async testProxy(proxy) {
        try {
            const { chromium } = require('playwright');
            const browser = await chromium.launch({
                headless: true,
                proxy: this.getPlaywrightProxyConfig(proxy),
                timeout: 10000
            });

            const context = await browser.newContext();
            const page = await context.newPage();

            // 测试访问
            await page.goto('https://www.baidu.com', { 
                timeout: 10000,
                waitUntil: 'domcontentloaded' 
            });

            await browser.close();
            
            console.log(`✅ 代理测试成功: ${proxy.name || this.getProxyKey(proxy)}`);
            return true;

        } catch (error) {
            console.error(`❌ 代理测试失败: ${proxy.name || this.getProxyKey(proxy)} - ${error.message}`);
            return false;
        }
    }

    /**
     * 获取Playwright代理配置
     * @param {Object} proxy - 代理配置
     * @returns {Object} Playwright代理配置
     */
    getPlaywrightProxyConfig(proxy) {
        if (proxy.type === 'direct') {
            return undefined; // 直连不需要代理配置
        }

        const config = {
            server: `${proxy.type}://${proxy.host}:${proxy.port}`
        };

        if (proxy.auth) {
            config.username = proxy.auth.user;
            config.password = proxy.auth.pass;
        }

        return config;
    }
}

// 导出模块
module.exports = ProxyRotationManager;

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    const manager = new ProxyRotationManager();

    (async () => {
        try {
            await manager.initialize();

            if (args[0] === 'stats') {
                // 显示统计信息
                const stats = await manager.getProxyStats();
                console.log('\n📊 代理池统计信息:');
                console.log(`总代理数: ${stats.totalProxies}`);
                console.log(`健康代理: ${stats.healthyProxies}`);
                console.log(`今日总配额: ${stats.totalQuotaToday}`);
                console.log(`今日已用: ${stats.usedQuotaToday}`);
                console.log(`今日剩余: ${stats.remainingQuotaToday}`);
                console.log('\n详细信息:');
                stats.proxyDetails.forEach(detail => {
                    console.log(`- ${detail.name}: ${detail.usedToday}/${detail.dailyLimit} ${detail.isHealthy ? '✅' : '❌'}`);
                });
            } else if (args[0] === 'reset') {
                // 重置代理状态
                await manager.resetProxyStatus(args[1]);
            } else if (args[0] === 'test') {
                // 测试所有代理
                console.log('🧪 开始测试所有代理...');
                for (const proxy of manager.proxies) {
                    await manager.testProxy(proxy);
                }
            } else {
                console.log(`
使用方法:
  node proxy_rotation_manager.js stats    - 显示代理统计信息
  node proxy_rotation_manager.js reset    - 重置所有代理状态
  node proxy_rotation_manager.js reset <proxyKey> - 重置指定代理
  node proxy_rotation_manager.js test     - 测试所有代理连接
                `);
            }
        } catch (error) {
            console.error('执行失败:', error);
        }
    })();
}