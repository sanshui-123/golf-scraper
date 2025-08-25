#!/usr/bin/env node

/**
 * 替代AI检测方案 - 使用多个免费API
 * 不需要BitBrowser或代理，直接调用API
 */

const axios = require('axios');
const { chromium } = require('playwright');

class AlternativeAIDetector {
    constructor() {
        this.detectors = [
            {
                name: 'ZeroGPT',
                url: 'https://www.zerogpt.com/',
                type: 'web',
                selector: {
                    input: 'textarea[name="textArea"]',
                    button: 'button[type="submit"]',
                    result: '.result-container'
                }
            },
            {
                name: 'GPTZero',
                url: 'https://gptzero.me/',
                type: 'web',
                selector: {
                    input: 'textarea',
                    button: 'button:has-text("Get Results")',
                    result: '.results'
                }
            },
            {
                name: 'Writer AI Detector',
                url: 'https://writer.com/ai-content-detector/',
                type: 'web',
                selector: {
                    input: 'textarea',
                    button: 'button[type="submit"]',
                    result: '.result'
                }
            },
            {
                name: 'Copyleaks',
                url: 'https://copyleaks.com/ai-content-detector',
                type: 'web',
                selector: {
                    input: 'textarea',
                    button: 'button:has-text("Check")',
                    result: '.result-percentage'
                }
            }
        ];
        
        this.cache = new Map();
    }
    
    /**
     * 检测文本（尝试多个服务）
     */
    async detectText(text, preferredService = null) {
        if (!text || text.length < 50) {
            console.log('⚠️ 文本太短，跳过检测');
            return null;
        }
        
        // 检查缓存
        const cacheKey = this.hashText(text);
        if (this.cache.has(cacheKey)) {
            console.log('📦 使用缓存结果');
            return this.cache.get(cacheKey);
        }
        
        // 如果指定了服务，优先使用
        if (preferredService) {
            const service = this.detectors.find(d => d.name === preferredService);
            if (service) {
                const result = await this.detectWithService(text, service);
                if (result !== null) {
                    this.cache.set(cacheKey, result);
                    return result;
                }
            }
        }
        
        // 尝试所有服务
        for (const detector of this.detectors) {
            console.log(`\n🔍 尝试 ${detector.name}...`);
            const result = await this.detectWithService(text, detector);
            if (result !== null) {
                this.cache.set(cacheKey, result);
                return result;
            }
        }
        
        console.error('❌ 所有检测服务都失败了');
        return null;
    }
    
    /**
     * 使用特定服务进行检测
     */
    async detectWithService(text, service) {
        if (service.type === 'web') {
            return await this.detectWithWeb(text, service);
        } else if (service.type === 'api') {
            return await this.detectWithAPI(text, service);
        }
        return null;
    }
    
    /**
     * 通过网页进行检测
     */
    async detectWithWeb(text, service) {
        let browser = null;
        
        try {
            browser = await chromium.launch({
                headless: false, // 某些网站需要可见模式
                args: ['--no-sandbox']
            });
            
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            });
            
            const page = await context.newPage();
            
            // 访问检测页面
            await page.goto(service.url, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            
            // 输入文本
            const input = await page.locator(service.selector.input).first();
            await input.fill(text);
            console.log('   ✅ 已输入文本');
            
            // 点击检测按钮
            const button = await page.locator(service.selector.button).first();
            await button.click();
            console.log('   ⏳ 等待结果...');
            
            // 等待结果
            await page.waitForTimeout(5000);
            
            // 提取结果
            const resultText = await page.textContent('body');
            
            // 查找AI概率
            const patterns = [
                /(\d+(?:\.\d+)?)\s*%.*(?:AI|GPT|generated)/i,
                /(?:AI|GPT|generated).*?(\d+(?:\.\d+)?)\s*%/i,
                /Human.*?(\d+(?:\.\d+)?)\s*%/i,
                /Score.*?(\d+(?:\.\d+)?)/i
            ];
            
            for (const pattern of patterns) {
                const match = resultText.match(pattern);
                if (match) {
                    let probability = parseFloat(match[1]);
                    
                    // 如果是人类概率，转换为AI概率
                    if (resultText.includes('Human') && match[0].includes('Human')) {
                        probability = 100 - probability;
                    }
                    
                    console.log(`   ✅ ${service.name} 检测结果: ${probability}% AI概率`);
                    return probability;
                }
            }
            
            throw new Error('未找到检测结果');
            
        } catch (error) {
            console.error(`   ❌ ${service.name} 检测失败:`, error.message);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    
    /**
     * 通过API进行检测（预留接口）
     */
    async detectWithAPI(text, service) {
        // 未来可以添加直接API调用
        return null;
    }
    
    /**
     * 基于规则的简单检测（备用）
     */
    simpleDetection(text) {
        console.log('\n🤖 使用基于规则的简单检测...');
        
        let score = 0;
        const factors = {
            // AI特征词
            aiPhrases: [
                'it is important to note',
                'it\'s worth noting',
                'in conclusion',
                'furthermore',
                'additionally',
                'however, it',
                'on the other hand',
                'it is crucial',
                'it is essential'
            ],
            // 过度使用的连接词
            overusedConnectors: [
                'moreover',
                'nevertheless',
                'consequently',
                'subsequently',
                'accordingly'
            ],
            // 重复模式
            repetitiveStructure: /(\w+\s+\w+\s+\w+).*\1/gi
        };
        
        // 检查AI特征词
        factors.aiPhrases.forEach(phrase => {
            if (text.toLowerCase().includes(phrase)) {
                score += 5;
            }
        });
        
        // 检查过度使用的连接词
        factors.overusedConnectors.forEach(connector => {
            const count = (text.toLowerCase().match(new RegExp(connector, 'g')) || []).length;
            score += count * 3;
        });
        
        // 检查句子长度一致性
        const sentences = text.split(/[.!?]+/);
        const lengths = sentences.map(s => s.trim().split(' ').length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
        
        if (variance < 10) {
            score += 20; // 句子长度过于一致
        }
        
        // 限制在0-100范围
        score = Math.min(100, Math.max(0, score));
        
        console.log(`   📊 规则检测结果: ${score}% AI概率`);
        return score;
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

// 命令行测试
if (require.main === module) {
    const detector = new AlternativeAIDetector();
    
    (async () => {
        const testText = process.argv[2] || `
            Golf is a sport that requires precision and patience. Players must carefully consider
            each shot, taking into account factors such as wind direction, terrain, and distance.
            The mental aspect of the game is just as important as the physical skills required.
        `;
        
        console.log('📝 测试文本:', testText.substring(0, 100) + '...\n');
        
        // 尝试网页检测
        const webResult = await detector.detectText(testText);
        
        if (webResult !== null) {
            console.log(`\n🎯 AI检测结果: ${webResult}%`);
        } else {
            // 使用备用的规则检测
            const ruleResult = detector.simpleDetection(testText);
            console.log(`\n🎯 最终结果: ${ruleResult}% (基于规则)`);
        }
    })();
}

module.exports = AlternativeAIDetector;