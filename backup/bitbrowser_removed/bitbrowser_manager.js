#!/usr/bin/env node

/**
 * 比特浏览器管理器
 * 用于管理比特浏览器的多个配置文件，实现浏览器环境轮换
 * 专门用于AI检测，突破IP和浏览器指纹限制
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');

class BitBrowserManager {
    constructor() {
        // 对于本地连接，不使用代理
        process.env.NO_PROXY = 'localhost,127.0.0.1';
        
        // 比特浏览器API配置
        this.apiHost = 'http://127.0.0.1';
        this.apiPort = 54345; // 默认端口，需要根据实际配置修改
        this.wsPort = 54346; // WebSocket端口
        
        // 配置文件路径
        this.configPath = path.join(__dirname, 'bitbrowser_config.json');
        this.statusPath = path.join(__dirname, 'bitbrowser_status.json');
        
        // 浏览器配置文件列表
        this.profiles = [];
        this.profileStatus = {};
        
        // 每日限制
        this.dailyLimit = 18; // 每个配置文件每日限制
        
        // 活跃的浏览器实例
        this.activeBrowsers = new Map();
    }
    
    /**
     * 初始化比特浏览器管理器
     */
    async initialize() {
        try {
            console.log('🌐 初始化比特浏览器管理器...');
            
            // 加载配置
            await this.loadConfig();
            
            // 加载状态
            await this.loadStatus();
            
            // 检查比特浏览器是否运行
            await this.checkBitBrowserConnection();
            
            // 获取配置文件列表
            await this.fetchProfileList();
            
            // 检查每日限制
            this.checkDailyReset();
            
            console.log(`✅ 比特浏览器管理器初始化成功，共有 ${this.profiles.length} 个配置文件`);
            
        } catch (error) {
            console.error('❌ 比特浏览器管理器初始化失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            
            this.apiHost = config.apiHost || this.apiHost;
            this.apiPort = config.apiPort || this.apiPort;
            this.wsPort = config.wsPort || this.wsPort;
            this.apiKey = config.apiKey || '';
            this.dailyLimit = config.dailyLimit || this.dailyLimit;
            
        } catch (error) {
            console.log('📝 创建默认配置文件');
            
            const defaultConfig = {
                apiHost: 'http://127.0.0.1',
                apiPort: 54345,
                wsPort: 54346,
                dailyLimit: 18,
                notes: {
                    "说明": "比特浏览器API配置",
                    "官方文档": "https://doc2.bitbrowser.cn/jiekou.html",
                    "注意事项": [
                        "确保比特浏览器客户端已启动",
                        "API端口默认为54345",
                        "每个配置文件建议配置不同的代理"
                    ]
                }
            };
            
            await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
            Object.assign(this, defaultConfig);
        }
    }
    
    /**
     * 加载状态
     */
    async loadStatus() {
        try {
            const statusData = await fs.readFile(this.statusPath, 'utf8');
            this.profileStatus = JSON.parse(statusData);
        } catch (error) {
            console.log('📝 初始化配置文件状态');
            this.profileStatus = {};
            await this.saveStatus();
        }
    }
    
    /**
     * 保存状态
     */
    async saveStatus() {
        try {
            await fs.writeFile(this.statusPath, JSON.stringify(this.profileStatus, null, 2));
        } catch (error) {
            console.error('❌ 保存状态失败:', error.message);
        }
    }
    
    /**
     * 检查比特浏览器连接
     */
    async checkBitBrowserConnection() {
        try {
            const response = await axios.post(`${this.apiHost}:${this.apiPort}/browser/list`, {
                page: 0,
                pageSize: 10
            }, {
                timeout: 5000,
                proxy: false,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.success !== false) {
                console.log('✅ 比特浏览器连接正常');
                return true;
            }
            
        } catch (error) {
            throw new Error('无法连接到比特浏览器，请确保客户端已启动');
        }
    }
    
    /**
     * 获取配置文件列表
     */
    async fetchProfileList() {
        try {
            const response = await axios.post(`${this.apiHost}:${this.apiPort}/browser/list`, {
                page: 0,
                pageSize: 100 // 获取前100个配置文件
            }, {
                proxy: false,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data && response.data.data) {
                this.profiles = response.data.data.list || [];
                console.log(`📋 获取到 ${this.profiles.length} 个浏览器配置文件`);
                
                // 初始化每个配置文件的状态
                this.profiles.forEach(profile => {
                    const profileId = profile.id;
                    if (!this.profileStatus[profileId]) {
                        this.profileStatus[profileId] = {
                            name: profile.name,
                            usedToday: 0,
                            totalUsed: 0,
                            lastUsedTime: null,
                            lastResetDate: new Date().toDateString(),
                            isHealthy: true,
                            consecutiveFailures: 0
                        };
                    }
                });
                
                await this.saveStatus();
            }
            
        } catch (error) {
            console.error('❌ 获取配置文件列表失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 检查并重置每日配额
     */
    checkDailyReset() {
        const today = new Date().toDateString();
        
        Object.keys(this.profileStatus).forEach(profileId => {
            if (this.profileStatus[profileId].lastResetDate !== today) {
                this.profileStatus[profileId].usedToday = 0;
                this.profileStatus[profileId].lastResetDate = today;
                this.profileStatus[profileId].consecutiveFailures = 0;
            }
        });
        
        this.saveStatus();
    }
    
    /**
     * 获取最优配置文件
     * @returns {Object|null} 配置文件信息
     */
    async getOptimalProfile() {
        // 筛选可用的配置文件
        const availableProfiles = this.profiles.filter(profile => {
            const status = this.profileStatus[profile.id];
            return status && 
                   status.isHealthy && 
                   status.usedToday < this.dailyLimit &&
                   status.consecutiveFailures < 3;
        });
        
        if (availableProfiles.length === 0) {
            console.error('❌ 没有可用的浏览器配置文件');
            return null;
        }
        
        // 按使用次数排序，优先使用次数少的
        availableProfiles.sort((a, b) => {
            const statusA = this.profileStatus[a.id];
            const statusB = this.profileStatus[b.id];
            return statusA.usedToday - statusB.usedToday;
        });
        
        const selectedProfile = availableProfiles[0];
        console.log(`🎯 选择配置文件: ${selectedProfile.name} (今日已用: ${this.profileStatus[selectedProfile.id].usedToday}/${this.dailyLimit})`);
        
        return selectedProfile;
    }
    
    /**
     * 启动浏览器实例
     * @param {string} profileId - 配置文件ID
     * @returns {Object} 包含WebSocket端点的信息
     */
    async launchBrowser(profileId) {
        try {
            console.log(`🚀 启动浏览器配置: ${profileId}`);
            
            // 打开浏览器
            const openResponse = await axios.post(
                `${this.apiHost}:${this.apiPort}/browser/open`,
                {
                    id: profileId,
                    loadExtensions: true,
                    args: [], // 可以添加额外的启动参数
                    extractIp: true // 提取IP信息
                },
                {
                    proxy: false,
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!openResponse.data || openResponse.data.success === false) {
                throw new Error(`启动浏览器失败: ${openResponse.data?.msg || '未知错误'}`);
            }
            
            const browserData = openResponse.data.data;
            
            // 等待浏览器完全启动
            await this.sleep(2000);
            
            // 构建WebSocket端点
            const wsEndpoint = browserData.ws || `ws://127.0.0.1:${browserData.http || this.wsPort}/devtools/browser/${browserData.webSocketDebuggerUrl || profileId}`;
            
            console.log(`✅ 浏览器启动成功`);
            console.log(`   配置ID: ${profileId}`);
            console.log(`   IP: ${browserData.ip || '未知'}`);
            console.log(`   WebSocket: ${wsEndpoint}`);
            
            return {
                profileId,
                wsEndpoint,
                browserData,
                ip: browserData.ip
            };
            
        } catch (error) {
            console.error(`❌ 启动浏览器失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 连接到浏览器实例
     * @param {string} wsEndpoint - WebSocket端点
     * @returns {Object} Playwright浏览器实例
     */
    async connectBrowser(wsEndpoint) {
        try {
            console.log(`🔌 连接到浏览器: ${wsEndpoint}`);
            
            // 使用Playwright连接到浏览器
            const browser = await chromium.connectOverCDP(wsEndpoint);
            
            // 获取默认上下文（比特浏览器的环境）
            const contexts = browser.contexts();
            const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
            
            console.log('✅ 成功连接到浏览器');
            
            return { browser, context };
            
        } catch (error) {
            console.error(`❌ 连接浏览器失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 关闭浏览器实例
     * @param {string} profileId - 配置文件ID
     */
    async closeBrowser(profileId) {
        try {
            console.log(`🔒 关闭浏览器配置: ${profileId}`);
            
            // 通过API关闭浏览器
            const response = await axios.post(
                `${this.apiHost}:${this.apiPort}/browser/close`,
                { id: profileId },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (response.data && response.data.success) {
                console.log('✅ 浏览器已关闭');
            }
            
            // 从活跃列表中移除
            this.activeBrowsers.delete(profileId);
            
        } catch (error) {
            console.error(`⚠️ 关闭浏览器失败: ${error.message}`);
        }
    }
    
    /**
     * 记录使用情况
     * @param {string} profileId - 配置文件ID
     * @param {boolean} success - 是否成功
     */
    async recordUsage(profileId, success) {
        const status = this.profileStatus[profileId];
        
        if (!status) {
            console.error('❌ 配置文件状态不存在:', profileId);
            return;
        }
        
        if (success) {
            status.usedToday++;
            status.totalUsed++;
            status.lastUsedTime = new Date().toISOString();
            status.consecutiveFailures = 0;
            console.log(`✅ 配置文件使用成功: ${status.name} (今日: ${status.usedToday}/${this.dailyLimit})`);
        } else {
            status.consecutiveFailures++;
            if (status.consecutiveFailures >= 3) {
                status.isHealthy = false;
                console.error(`❌ 配置文件标记为不健康: ${status.name}`);
            }
        }
        
        await this.saveStatus();
    }
    
    /**
     * 获取统计信息
     */
    async getStatistics() {
        const stats = {
            totalProfiles: this.profiles.length,
            healthyProfiles: 0,
            totalQuotaToday: 0,
            usedQuotaToday: 0,
            profileDetails: []
        };
        
        this.profiles.forEach(profile => {
            const status = this.profileStatus[profile.id];
            if (status && status.isHealthy) {
                stats.healthyProfiles++;
                stats.totalQuotaToday += this.dailyLimit;
                stats.usedQuotaToday += status.usedToday;
            }
            
            if (status) {
                stats.profileDetails.push({
                    id: profile.id,
                    name: profile.name,
                    usedToday: status.usedToday,
                    dailyLimit: this.dailyLimit,
                    isHealthy: status.isHealthy,
                    lastUsedTime: status.lastUsedTime
                });
            }
        });
        
        stats.remainingQuotaToday = stats.totalQuotaToday - stats.usedQuotaToday;
        
        return stats;
    }
    
    /**
     * 辅助函数：延迟
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        // 关闭所有活跃的浏览器
        for (const [profileId, browserInfo] of this.activeBrowsers.entries()) {
            await this.closeBrowser(profileId);
        }
        
        await this.saveStatus();
        console.log('🧹 比特浏览器管理器已清理');
    }
}

// 导出模块
module.exports = BitBrowserManager;

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    const manager = new BitBrowserManager();
    
    (async () => {
        try {
            await manager.initialize();
            
            if (args[0] === 'list') {
                // 列出所有配置文件
                console.log('\n📋 浏览器配置文件列表:');
                manager.profiles.forEach(profile => {
                    const status = manager.profileStatus[profile.id];
                    console.log(`- ${profile.name} (ID: ${profile.id})`);
                    if (status) {
                        console.log(`  使用情况: ${status.usedToday}/${manager.dailyLimit} | 健康: ${status.isHealthy ? '✅' : '❌'}`);
                    }
                });
                
            } else if (args[0] === 'stats') {
                // 显示统计信息
                const stats = await manager.getStatistics();
                console.log('\n📊 比特浏览器统计信息:');
                console.log(`总配置文件数: ${stats.totalProfiles}`);
                console.log(`健康配置: ${stats.healthyProfiles}`);
                console.log(`今日总配额: ${stats.totalQuotaToday}`);
                console.log(`今日已用: ${stats.usedQuotaToday}`);
                console.log(`今日剩余: ${stats.remainingQuotaToday}`);
                
            } else if (args[0] === 'test' && args[1]) {
                // 测试指定配置文件
                const profileId = args[1];
                console.log(`\n🧪 测试配置文件: ${profileId}`);
                
                const browserInfo = await manager.launchBrowser(profileId);
                const { browser, context } = await manager.connectBrowser(browserInfo.wsEndpoint);
                
                // 创建测试页面
                const page = await context.newPage();
                await page.goto('https://www.baidu.com');
                console.log('✅ 页面加载成功');
                
                await page.waitForTimeout(3000);
                
                await browser.close();
                await manager.closeBrowser(profileId);
                
            } else {
                console.log(`
使用方法:
  node bitbrowser_manager.js list     - 列出所有配置文件
  node bitbrowser_manager.js stats    - 显示统计信息
  node bitbrowser_manager.js test <profileId> - 测试指定配置文件
                `);
            }
            
        } catch (error) {
            console.error('执行失败:', error);
        } finally {
            await manager.cleanup();
        }
    })();
}