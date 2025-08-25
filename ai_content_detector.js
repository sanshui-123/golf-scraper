#!/usr/bin/env node

/**
 * AI文本检测模块
 * 使用腾讯AI检测平台检测文章内容的AI生成概率
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const SmartProxyManager = require('./smart_proxy_manager');

class AIContentDetector {
    constructor() {
        this.detectionUrl = 'https://matrix.tencent.com/ai-detect/';
        this.browser = null;
        this.context = null;
        this.cache = new Map(); // 缓存检测结果，避免重复检测
        this.maxRetries = 3;
        this.timeout = 30000; // 30秒超时
        this.proxyManager = new SmartProxyManager(); // 智能代理管理器
        this.currentProxy = null; // 当前使用的代理
    }

    /**
     * 初始化浏览器和代理管理器
     */
    async initialize() {
        try {
            // 初始化代理管理器
            await this.proxyManager.initialize();
            
            // 获取第一个可用代理
            this.currentProxy = await this.proxyManager.getNextProxy();
            
            // 创建浏览器实例（先不启动，等检测时再启动）
            console.log('🚀 AI检测器初始化成功');
        } catch (error) {
            console.error('❌ AI检测器初始化失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 使用指定代理创建浏览器上下文
     * @param {Object} proxy - 代理配置
     * @returns {Promise<Object>} 浏览器上下文
     */
    async createBrowserContext(proxy = null) {
        try {
            // 关闭现有浏览器
            if (this.browser) {
                await this.browser.close();
            }
            
            // 获取代理配置
            const launchOptions = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            };
            
            if (proxy && proxy.type !== 'direct') {
                launchOptions.proxy = this.proxyManager.getPlaywrightProxyConfig(proxy);
                console.log(`🌐 使用代理: ${proxy.name || this.proxyManager.getProxyKey(proxy)}`);
            }
            
            this.browser = await chromium.launch(launchOptions);
            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            return this.context;
        } catch (error) {
            console.error('❌ 创建浏览器上下文失败:', error.message);
            throw error;
        }
    }

    /**
     * 检测文本的AI概率
     * @param {string} text - 要检测的文本内容
     * @returns {Promise<number|null>} - AI概率(0-100)或null(失败时)
     */
    async detectText(text) {
        if (!text || text.length < 10) {
            console.log('⚠️ 文本内容太短，跳过检测');
            return null;
        }

        // 检查缓存
        const textHash = this.hashText(text);
        if (this.cache.has(textHash)) {
            console.log('📦 使用缓存的检测结果');
            return this.cache.get(textHash);
        }

        let proxyAttempts = 0;
        const maxProxyAttempts = 5; // 最多尝试5个不同的代理

        while (proxyAttempts < maxProxyAttempts) {
            // 确保有可用代理
            if (!this.currentProxy) {
                this.currentProxy = await this.proxyManager.getNextProxy();
                if (!this.currentProxy) {
                    console.error('❌ 没有可用的代理');
                    break;
                }
            }

            const startTime = Date.now(); // 记录开始时间
            
            try {
                // 使用当前代理创建浏览器上下文
                await this.createBrowserContext(this.currentProxy);
                
                // 尝试检测
                const result = await this._performDetection(text);
                
                if (result !== null) {
                    const responseTime = Date.now() - startTime;
                    // 检测成功，记录代理使用（包含响应时间）
                    await this.proxyManager.recordProxyUsage(this.currentProxy, true, responseTime);
                    this.cache.set(textHash, result);
                    return result;
                }
                
                // 检测返回null，可能是页面结构问题，尝试下一个代理
                console.warn('⚠️ 检测返回null，尝试切换代理');
                await this.proxyManager.recordProxyUsage(this.currentProxy, false);
                
            } catch (error) {
                console.error(`❌ 使用代理 ${this.currentProxy.name || '未知'} 检测失败:`, error.message);
                
                // 获取错误类型
                const errorType = this.proxyManager.categorizeError(error);
                const responseTime = Date.now() - (startTime || Date.now());
                
                // 记录代理失败（增强版）
                await this.proxyManager.recordProxyUsage(this.currentProxy, false, responseTime, errorType);
                
                // 使用智能故障转移
                console.log(`🔄 智能故障转移 (错误类型: ${errorType})`);
                this.currentProxy = await this.proxyManager.smartFailover(this.currentProxy, errorType);
                
                if (!this.currentProxy) {
                    console.error('❌ 智能故障转移失败，没有可用代理');
                    break;
                }
                
                continue; // 继续下一次尝试
            }

            // 正常情况下获取下一个代理
            this.currentProxy = await this.proxyManager.getOptimalProxy();
            proxyAttempts++;
        }

        console.error('❌ 所有代理尝试都失败了');
        return null;
    }

    /**
     * 执行实际的检测操作
     */
    async _performDetection(text) {
        const page = await this.context.newPage();
        
        try {
            // 访问检测页面
            await page.goto(this.detectionUrl, { 
                waitUntil: 'networkidle',
                timeout: this.timeout 
            });

            // 等待输入框加载
            await page.waitForSelector('textarea', { timeout: 10000 });

            // 清空并输入文本
            await page.fill('textarea', text);

            // 查找并点击检测按钮
            const detectButton = await page.locator('button:has-text("检测"), button:has-text("开始检测"), button:has-text("AI检测")').first();
            if (!detectButton) {
                throw new Error('未找到检测按钮');
            }
            
            await detectButton.click();

            // 等待结果显示
            await page.waitForTimeout(3000); // 等待检测完成

            // 尝试多种可能的结果选择器
            const resultSelectors = [
                '.result-percentage',
                '.ai-probability',
                '.detection-result',
                '[class*="result"]',
                '[class*="probability"]',
                '[data-testid*="result"]'
            ];

            let aiProbability = null;
            for (const selector of resultSelectors) {
                try {
                    const element = await page.locator(selector).first();
                    if (await element.isVisible()) {
                        const text = await element.textContent();
                        const match = text.match(/(\d+(?:\.\d+)?)\s*%?/);
                        if (match) {
                            aiProbability = parseFloat(match[1]);
                            break;
                        }
                    }
                } catch (e) {
                    // 继续尝试下一个选择器
                }
            }

            // 如果没有找到结果，尝试获取页面上所有包含百分比的文本
            if (aiProbability === null) {
                const pageText = await page.textContent('body');
                const percentageMatches = pageText.match(/(\d+(?:\.\d+)?)\s*%/g);
                if (percentageMatches && percentageMatches.length > 0) {
                    // 假设第一个百分比是AI概率
                    const match = percentageMatches[0].match(/(\d+(?:\.\d+)?)/);
                    if (match) {
                        aiProbability = parseFloat(match[1]);
                    }
                }
            }

            console.log(`🤖 AI检测结果: ${aiProbability}%`);
            return aiProbability;

        } catch (error) {
            console.error('检测过程出错:', error.message);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * 计算文本哈希值用于缓存
     */
    hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    /**
     * 批量检测文章
     * @param {string} folderPath - 文章文件夹路径
     */
    async batchDetect(folderPath) {
        try {
            const files = await fs.readdir(folderPath);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            
            console.log(`📁 找到 ${mdFiles.length} 篇文章待检测`);
            
            for (const file of mdFiles) {
                const filePath = path.join(folderPath, file);
                await this.detectAndUpdateFile(filePath);
                
                // 避免请求过快
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.error('批量检测失败:', error);
        }
    }

    /**
     * 检测并更新单个文件
     * @param {string} filePath - 文件路径
     */
    async detectAndUpdateFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // 检查是否已经有AI检测结果
            if (content.includes('ai_detection:')) {
                console.log(`✅ ${path.basename(filePath)} 已有检测结果，跳过`);
                return;
            }

            // 提取文章正文（去除元数据）
            const bodyMatch = content.match(/---[\s\S]*?---\s*([\s\S]+)/);
            if (!bodyMatch) {
                console.log(`⚠️ ${path.basename(filePath)} 无法提取正文`);
                return;
            }

            const articleBody = bodyMatch[1];
            const aiProbability = await this.detectText(articleBody);

            if (aiProbability !== null) {
                // 更新文件元数据
                const updatedContent = this.updateFileMetadata(content, aiProbability);
                await fs.writeFile(filePath, updatedContent, 'utf8');
                console.log(`✅ ${path.basename(filePath)} 检测完成: ${aiProbability}%`);
            } else {
                console.log(`❌ ${path.basename(filePath)} 检测失败`);
            }

        } catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error);
        }
    }

    /**
     * 更新文件元数据，添加AI检测结果
     */
    updateFileMetadata(content, aiProbability) {
        const metadataEnd = content.indexOf('---', 3);
        if (metadataEnd === -1) return content;

        const metadata = content.substring(0, metadataEnd);
        const rest = content.substring(metadataEnd);

        const detectionTime = new Date().toISOString().replace('T', ' ').split('.')[0];
        const newMetadata = metadata + 
            `ai_detection: "${aiProbability}%"\n` +
            `detection_time: "${detectionTime}"\n`;

        return newMetadata + rest;
    }

    /**
     * 关闭浏览器
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔚 AI检测器已关闭');
        }
        
        // 显示代理使用统计
        try {
            const stats = await this.proxyManager.getProxyStats();
            console.log('\n📊 代理使用统计:');
            console.log(`- 总配额: ${stats.totalQuotaToday}`);
            console.log(`- 已使用: ${stats.usedQuotaToday}`);
            console.log(`- 剩余: ${stats.remainingQuotaToday}`);
        } catch (e) {
            // 忽略错误
        }
    }
}

// 导出模块
module.exports = AIContentDetector;

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
使用方法:
  node ai_content_detector.js <文本内容>
  node ai_content_detector.js --batch <文件夹路径>
  node ai_content_detector.js --file <文件路径>

示例:
  node ai_content_detector.js "这是一篇测试文章的内容..."
  node ai_content_detector.js --batch golf_content/2025-08-13/
  node ai_content_detector.js --file golf_content/2025-08-13/article1.md
        `);
        process.exit(0);
    }

    const detector = new AIContentDetector();
    
    (async () => {
        try {
            await detector.initialize();

            if (args[0] === '--batch' && args[1]) {
                // 批量检测模式
                await detector.batchDetect(args[1]);
            } else if (args[0] === '--file' && args[1]) {
                // 单文件检测模式
                await detector.detectAndUpdateFile(args[1]);
            } else {
                // 直接文本检测模式
                const text = args.join(' ');
                const result = await detector.detectText(text);
                console.log(`检测结果: ${result !== null ? result + '%' : '检测失败'}`);
            }

        } catch (error) {
            console.error('执行失败:', error);
        } finally {
            await detector.close();
        }
    })();
}