#!/usr/bin/env node

/**
 * 简化版AI检测器 - 仅使用代理模式
 * 不依赖BitBrowser，适合快速部署和测试
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

class SimpleAIDetector {
    constructor() {
        this.detectionUrl = 'https://matrix.tencent.com/ai-detect/';
        this.timeout = 30000;
        this.proxies = [];
        this.currentProxyIndex = 0;
        this.cache = new Map();
    }
    
    /**
     * 初始化检测器
     */
    async initialize() {
        console.log('🚀 初始化简化版AI检测器（纯代理模式）...');
        
        // 加载代理配置
        await this.loadProxyConfig();
        
        console.log(`✅ 加载了 ${this.proxies.length} 个代理配置`);
    }
    
    /**
     * 加载代理配置
     */
    async loadProxyConfig() {
        try {
            const configPath = path.join(__dirname, 'proxy_config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // 过滤出可用的代理
            this.proxies = config.proxies.filter(proxy => {
                // 跳过示例代理
                if (proxy.host.includes('example.com')) return false;
                return true;
            });
            
            // 添加直连作为备选
            if (this.proxies.length === 0) {
                this.proxies.push({ type: 'direct', name: '直连' });
            }
        } catch (error) {
            console.warn('⚠️ 无法加载代理配置，使用直连模式');
            this.proxies = [{ type: 'direct', name: '直连' }];
        }
    }
    
    /**
     * 获取下一个代理
     */
    getNextProxy() {
        const proxy = this.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        return proxy;
    }
    
    /**
     * 检测文本的AI概率
     * @param {string} text - 要检测的文本
     * @returns {Promise<number|null>} - AI概率(0-100)或null
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
        
        // 尝试多个代理
        for (let i = 0; i < this.proxies.length; i++) {
            const proxy = this.getNextProxy();
            console.log(`🔄 尝试使用代理: ${proxy.name || '未命名'}`);
            
            const result = await this.detectWithProxy(text, proxy);
            if (result !== null) {
                // 缓存成功的结果
                this.cache.set(textHash, result);
                return result;
            }
        }
        
        console.error('❌ 所有代理都失败了');
        return null;
    }
    
    /**
     * 使用指定代理进行检测
     */
    async detectWithProxy(text, proxy) {
        let browser = null;
        
        try {
            // 配置浏览器选项
            const launchOptions = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            };
            
            // 配置代理
            if (proxy.type !== 'direct') {
                launchOptions.proxy = {
                    server: `${proxy.type}://${proxy.host}:${proxy.port}`
                };
                if (proxy.auth) {
                    launchOptions.proxy.username = proxy.auth.user;
                    launchOptions.proxy.password = proxy.auth.pass;
                }
            }
            
            browser = await chromium.launch(launchOptions);
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            
            const page = await context.newPage();
            page.setDefaultTimeout(this.timeout);
            
            // 访问检测页面
            console.log('   📍 访问AI检测页面...');
            await page.goto(this.detectionUrl, { waitUntil: 'networkidle' });
            
            // 等待页面加载
            await page.waitForTimeout(2000);
            
            // 查找输入框
            const textarea = await page.locator('textarea').first();
            if (!textarea) {
                throw new Error('未找到输入框');
            }
            
            // 输入文本
            await textarea.fill(text);
            console.log('   ✅ 已输入文本');
            
            // 查找并点击检测按钮
            const detectButton = await page.locator('button:has-text("检测"), button:has-text("开始检测"), button:has-text("AI检测")').first();
            if (detectButton) {
                await detectButton.click();
                console.log('   🔍 开始检测...');
            }
            
            // 等待结果
            await page.waitForTimeout(3000);
            
            // 获取结果
            const resultText = await page.textContent('body');
            const aiMatch = resultText.match(/(\d+(?:\.\d+)?)\s*%/);
            
            if (aiMatch) {
                const aiProbability = parseFloat(aiMatch[1]);
                console.log(`   ✅ 检测完成: ${aiProbability}%`);
                return aiProbability;
            }
            
            throw new Error('未找到检测结果');
            
        } catch (error) {
            console.error(`   ❌ 检测失败: ${error.message}`);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    
    /**
     * 计算文本哈希
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
}

// 命令行使用
if (require.main === module) {
    const detector = new SimpleAIDetector();
    
    (async () => {
        try {
            await detector.initialize();
            
            // 测试文本
            const testText = process.argv[2] || `
                高尔夫球是一项精彩的运动，它不仅考验技巧，还需要良好的心理素质。
                在球场上，每一杆都需要精心计算，考虑风向、地形和距离等因素。
                这项运动的魅力在于它永远充满挑战，即使是职业选手也会遇到困难。
            `;
            
            console.log('\n📝 检测文本:', testText.substring(0, 100) + '...');
            
            const result = await detector.detectText(testText);
            
            if (result !== null) {
                console.log(`\n✅ AI检测结果: ${result}%`);
                console.log(result > 50 ? '⚠️ AI生成概率较高' : '✅ AI生成概率较低');
            } else {
                console.log('\n❌ 检测失败');
            }
            
        } catch (error) {
            console.error('错误:', error.message);
        }
    })();
}

module.exports = SimpleAIDetector;