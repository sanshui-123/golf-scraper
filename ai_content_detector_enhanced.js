#!/usr/bin/env node

/**
 * 增强版AI文本检测模块
 * 使用智能代理模式访问腾讯AI检测平台
 * 检测文章内容的AI生成概率
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const SmartProxyManager = require('./smart_proxy_manager');
const crypto = require('crypto');

class EnhancedAIContentDetector {
    constructor() {
        this.detectionUrl = 'https://matrix.tencent.com/ai-detect/';
        this.cache = new Map(); // 缓存检测结果
        this.maxRetries = 3;
        this.timeout = 30000; // 30秒超时
        
        // 检测模式：默认使用本地检测
        this.detectionMode = 'local';
        
        // 代理管理器实例
        this.proxyManager = null;
        
        // 使用统计
        this.stats = { attempts: 0, success: 0 };
        
        // 调试模式
        this.debug = process.env.AI_DETECTOR_DEBUG === 'true';
        
        // AI生成文本的特征词
        this.aiPatterns = {
            transitions: ['此外', '然而', '因此', '总之', '首先', '其次', '最后', '综上所述', '值得注意的是', '需要指出的是'],
            hedging: ['可能', '或许', '大概', '似乎', '看起来', '通常', '一般来说', '在某种程度上'],
            formal: ['显著', '潜在', '关键', '重要', '主要', '核心', '基本', '根本', '实质'],
            structures: ['不仅...而且', '一方面...另一方面', '既...又', '无论...都'],
            conclusions: ['总的来说', '综合考虑', '由此可见', '不难发现', '我们可以看到']
        };
    }
    
    /**
     * 初始化检测器
     */
    async initialize() {
        try {
            console.log('🚀 初始化AI检测器...');
            
            // 初始化代理管理器
            this.proxyManager = new SmartProxyManager();
            await this.proxyManager.initialize();
            console.log('✅ 智能代理管理器初始化成功');
            console.log(`🎯 检测模式: 本地AI特征分析`);
            
        } catch (error) {
            console.error('❌ AI检测器初始化失败:', error.message);
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
        
        // 优先使用本地检测
        console.log('🎯 使用本地AI检测算法...');
        const result = await this.detectWithLocal(text);
        
        // 如果本地检测成功，缓存结果
        if (result !== null) {
            this.cache.set(textHash, result);
            return result;
        }
        
        // 如果本地检测失败，可以尝试代理模式（但目前代理不可用）
        // console.log('🔄 本地检测失败，尝试代理模式...');
        // const proxyResult = await this.detectWithProxy(text);
        // if (proxyResult !== null) {
        //     this.cache.set(textHash, proxyResult);
        //     return proxyResult;
        // }
        
        return result;
    }
    
    /**
     * 使用本地AI检测算法
     * @param {string} text - 要检测的文本
     * @returns {Promise<number|null>} - AI概率或null
     */
    async detectWithLocal(text) {
        console.log('🔍 执行本地AI特征分析...');
        
        if (!text || text.length < 100) return 0;
        
        let score = 0;
        const textLower = text.toLowerCase();
        const sentences = text.split(/[。！？.!?]/).filter(s => s.trim());
        
        // 1. 检查特征词频率
        for (const [category, patterns] of Object.entries(this.aiPatterns)) {
            for (const pattern of patterns) {
                const count = (text.match(new RegExp(pattern, 'gi')) || []).length;
                if (count > 0) {
                    score += count * 2;
                }
            }
        }
        
        // 2. 检查句子长度一致性（AI倾向生成相似长度的句子）
        if (sentences.length > 3) {
            const lengths = sentences.map(s => s.trim().length);
            const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
            const stdDev = Math.sqrt(variance);
            
            // 标准差越小，句子长度越一致，越可能是AI
            if (stdDev < avgLength * 0.3) {
                score += 10;
            }
        }
        
        // 3. 检查段落结构（AI喜欢生成结构化的内容）
        const paragraphs = text.split(/\n\n+/);
        if (paragraphs.length > 2) {
            const paraLengths = paragraphs.map(p => p.length);
            const avgParaLength = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
            
            // 段落长度过于均匀
            const paraVariance = paraLengths.reduce((sum, len) => sum + Math.pow(len - avgParaLength, 2), 0) / paraLengths.length;
            if (Math.sqrt(paraVariance) < avgParaLength * 0.2) {
                score += 15;
            }
        }
        
        // 4. 检查重复性（AI容易重复某些表达）
        const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
        const wordFreq = {};
        words.forEach(word => {
            if (word.length > 2) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        // 检查高频词
        const highFreqWords = Object.entries(wordFreq)
            .filter(([word, count]) => count > 3 && !['的', '了', '和', '在', '是', '有'].includes(word))
            .length;
        
        score += highFreqWords * 3;
        
        // 5. 检查标点符号使用（AI倾向规范使用标点）
        const punctuationPattern = /[，。！？；：""''（）【】《》]/g;
        const punctuations = text.match(punctuationPattern) || [];
        const punctuationRatio = punctuations.length / text.length;
        
        // 标点符号比例在特定范围内
        if (punctuationRatio > 0.05 && punctuationRatio < 0.08) {
            score += 5;
        }
        
        // 转换为百分比（最高100%）
        const probability = Math.min(100, Math.round(score * 1.5));
        
        console.log(`✅ 本地检测完成: ${probability}%`);
        this.stats.success++;
        
        return probability;
    }
    
    /**
     * 使用代理模式检测
     * @param {string} text - 要检测的文本
     * @returns {Promise<number|null>} - AI概率或null
     */
    async detectWithProxy(text) {
        console.log('🔄 使用智能代理模式检测');
        this.stats.attempts++;
        
        let browser = null;
        let context = null;
        let currentProxy = null;
        const startTime = Date.now();
        
        try {
            // 获取最优代理
            currentProxy = await this.proxyManager.getOptimalProxy();
            if (!currentProxy) {
                console.error('❌ 没有可用的代理');
                return null;
            }
            
            // 创建浏览器实例
            const launchOptions = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            };
            
            if (currentProxy.type !== 'direct') {
                launchOptions.proxy = this.proxyManager.getPlaywrightProxyConfig(currentProxy);
                console.log(`🌐 使用代理: ${currentProxy.name || this.proxyManager.getProxyKey(currentProxy)}`);
            }
            
            browser = await chromium.launch(launchOptions);
            context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            
            // 执行检测
            const result = await this._performDetection(context, text);
            const responseTime = Date.now() - startTime;
            
            if (result !== null) {
                // 记录成功
                await this.proxyManager.recordProxyUsage(currentProxy, true, responseTime);
                this.stats.success++;
                console.log(`✅ 代理检测成功: ${result}%`);
            } else {
                // 记录失败
                await this.proxyManager.recordProxyUsage(currentProxy, false, responseTime, 'DETECTION_FAILED');
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ 代理检测失败:', error.message);
            
            if (currentProxy) {
                const errorType = this.proxyManager.categorizeError(error);
                const responseTime = Date.now() - startTime;
                await this.proxyManager.recordProxyUsage(currentProxy, false, responseTime, errorType);
            }
            
            return null;
            
        } finally {
            // 清理资源
            if (browser) {
                await browser.close();
            }
        }
    }
    
    /**
     * 执行实际的检测操作
     * @param {Object} context - 浏览器上下文
     * @param {string} text - 要检测的文本
     * @returns {Promise<number|null>} - AI概率或null
     */
    async _performDetection(context, text) {
        const page = await context.newPage();
        let screenshotCount = 0;
        const debugDir = path.join(__dirname, 'ai_detection_debug');
        
        // 创建调试目录
        if (this.debug) {
            try {
                await fs.mkdir(debugDir, { recursive: true });
            } catch (e) {}
        }
        
        try {
            // 设置页面超时
            page.setDefaultTimeout(this.timeout);
            
            // 访问检测页面
            console.log('   📍 访问AI检测页面...');
            const response = await page.goto(this.detectionUrl, { 
                waitUntil: 'networkidle',
                timeout: this.timeout 
            });
            
            // 检查页面是否正常加载
            if (!response || response.status() !== 200) {
                console.warn(`   ⚠️ 页面加载异常: ${response ? response.status() : '无响应'}`);
                throw new Error(`页面加载失败: ${response ? response.status() : '无响应'}`);
            }
            
            // 等待页面完全加载
            console.log('   ⏳ 等待页面加载...');
            await page.waitForTimeout(3000);
            
            // 截图1：页面加载后
            if (this.debug) {
                const screenshotPath = path.join(debugDir, `step1_loaded_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`   📸 已截图: ${screenshotPath}`);
            }
            
            // 尝试多种输入框选择器
            console.log('   🔍 查找输入框...');
            const textareaSelectors = [
                // 通用选择器
                'textarea',
                'textarea[placeholder*="输入"]',
                'textarea[placeholder*="文本"]',
                'textarea[placeholder*="内容"]',
                'textarea[placeholder*="请输入"]',
                // 框架特定选择器
                '.el-textarea__inner',
                '.el-textarea textarea',
                '.ant-input',
                '.ant-input-textarea textarea',
                // 富文本编辑器
                '[contenteditable="true"]',
                '[role="textbox"]',
                'div[contenteditable="true"]',
                // 更具体的选择器
                '#text-input',
                '#ai-detect-input',
                '.ai-detect-textarea',
                '.detection-input'
            ];
            
            let inputElement = null;
            let inputSelector = null;
            
            // 等待输入框出现
            for (const selector of textareaSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 5000 });
                    const element = await page.locator(selector).first();
                    if (await element.isVisible()) {
                        inputElement = element;
                        inputSelector = selector;
                        console.log(`   ✅ 找到输入框: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // 继续尝试下一个选择器
                }
            }
            
            if (!inputElement) {
                // 如果还是找不到，尝试通过其他方式查找
                console.log('   🔍 尝试其他方式查找输入框...');
                
                // 查找所有可能的输入元素
                const allInputs = await page.evaluate(() => {
                    const inputs = [];
                    // 查找所有textarea
                    document.querySelectorAll('textarea').forEach((el, index) => {
                        inputs.push({
                            type: 'textarea',
                            index: index,
                            visible: el.offsetParent !== null,
                            placeholder: el.placeholder,
                            className: el.className
                        });
                    });
                    // 查找所有contenteditable
                    document.querySelectorAll('[contenteditable="true"]').forEach((el, index) => {
                        inputs.push({
                            type: 'contenteditable',
                            index: index,
                            visible: el.offsetParent !== null,
                            className: el.className
                        });
                    });
                    return inputs;
                });
                
                console.log(`   📋 找到的输入元素: ${JSON.stringify(allInputs, null, 2)}`);
                
                if (this.debug) {
                    const screenshotPath = path.join(debugDir, `step1_5_no_input_found_${Date.now()}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    console.log(`   📸 调试截图: ${screenshotPath}`);
                }
                
                throw new Error('未找到输入框');
            }
            
            // 清空并输入文本
            console.log('   ✏️ 输入文本...');
            
            // 根据元素类型选择输入方式
            if (inputSelector && inputSelector.includes('contenteditable')) {
                // 对于contenteditable元素
                await inputElement.click();
                await page.keyboard.press('Control+A');
                await page.keyboard.press('Delete');
                await inputElement.type(text);
            } else {
                // 对于普通输入框
                await inputElement.click();
                await inputElement.fill('');
                await inputElement.fill(text);
            }
            
            await page.waitForTimeout(1500);
            
            // 截图2：输入文本后
            if (this.debug) {
                const screenshotPath = path.join(debugDir, `step2_text_input_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`   📸 已截图: ${screenshotPath}`);
            }
            
            // 查找并点击检测按钮
            console.log('   🔍 查找检测按钮...');
            const buttonSelectors = [
                // 文本匹配
                'button:has-text("检测")',
                'button:has-text("开始检测")',
                'button:has-text("AI检测")',
                'button:has-text("开始")',
                'button:has-text("提交")',
                'button:has-text("立即检测")',
                // 类名匹配
                '.submit-btn',
                '.detect-btn',
                '.detection-btn',
                '.ai-detect-btn',
                // 通用按钮
                'button[type="submit"]',
                'button.el-button',
                'button.el-button--primary',
                'button.ant-btn',
                'button.ant-btn-primary',
                // ID匹配
                '#detect-btn',
                '#submit-btn',
                // 其他可能的按钮
                'a:has-text("检测")',
                'span:has-text("检测")',
                'div[role="button"]:has-text("检测")'
            ];
            
            let detectButton = null;
            let buttonSelector = null;
            
            for (const selector of buttonSelectors) {
                try {
                    const button = await page.locator(selector).first();
                    if (await button.isVisible()) {
                        detectButton = button;
                        buttonSelector = selector;
                        console.log(`   ✅ 找到检测按钮: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!detectButton) {
                // 尝试通过evaluate查找按钮
                console.log('   🔍 尝试其他方式查找按钮...');
                
                const allButtons = await page.evaluate(() => {
                    const buttons = [];
                    document.querySelectorAll('button, a, div[role="button"]').forEach((el, index) => {
                        const text = el.textContent || '';
                        if (text.includes('检测') || text.includes('开始') || text.includes('提交')) {
                            buttons.push({
                                tag: el.tagName,
                                text: text.trim(),
                                className: el.className,
                                visible: el.offsetParent !== null
                            });
                        }
                    });
                    return buttons;
                });
                
                console.log(`   📋 找到的按钮: ${JSON.stringify(allButtons, null, 2)}`);
                
                if (this.debug) {
                    const screenshotPath = path.join(debugDir, `step2_5_no_button_found_${Date.now()}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    console.log(`   📸 调试截图: ${screenshotPath}`);
                }
                
                throw new Error('未找到检测按钮');
            }
            
            console.log('   🖱️ 点击检测按钮...');
            await detectButton.click();
            
            // 等待结果显示
            console.log('   ⏳ 等待检测结果...');
            
            // 等待可能的加载动画消失
            try {
                await page.waitForSelector('.loading', { state: 'hidden', timeout: 10000 });
            } catch (e) {
                // 忽略，可能没有加载动画
            }
            
            await page.waitForTimeout(5000);
            
            // 截图3：检测结果
            if (this.debug) {
                const screenshotPath = path.join(debugDir, `step3_result_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`   📸 已截图: ${screenshotPath}`);
            }
            
            // 尝试多种可能的结果选择器
            console.log('   🔍 查找检测结果...');
            const resultSelectors = [
                // 具体的结果选择器
                '.result-percentage',
                '.ai-probability',
                '.detection-result',
                '.ai-detection-result',
                // 类名包含关键词
                '[class*="result"]',
                '[class*="probability"]',
                '[class*="percent"]',
                '[class*="score"]',
                '[class*="rate"]',
                // 弹窗和模态框
                '.el-dialog',
                '.el-dialog__body',
                '.ant-modal',
                '.ant-modal-body',
                '.modal-content',
                // 数据属性
                '[data-testid*="result"]',
                '[data-role*="result"]',
                // 文本内容包含百分号
                'span:has-text("%")',
                'div:has-text("%")',
                'p:has-text("%")',
                'strong:has-text("%")',
                'b:has-text("%")',
                // 特定的结果区域
                '.result-container',
                '.detection-output',
                '#detection-result'
            ];
            
            let aiProbability = null;
            
            // 首先尝试等待结果出现
            try {
                await page.waitForFunction(() => {
                    return document.body.innerText.includes('%');
                }, { timeout: 10000 });
            } catch (e) {
                console.log('   ⚠️ 未检测到百分号');
            }
            
            // 尝试各种选择器
            for (const selector of resultSelectors) {
                try {
                    const elements = await page.locator(selector).all();
                    for (const element of elements) {
                        if (await element.isVisible()) {
                            const text = await element.textContent();
                            // 更宽松的匹配模式
                            const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g);
                            if (matches) {
                                // 如果有多个百分比，选择第一个合理的值
                                for (const match of matches) {
                                    const value = parseFloat(match);
                                    if (value >= 0 && value <= 100) {
                                        aiProbability = value;
                                        console.log(`   ✅ 找到检测结果: ${aiProbability}% (来自: ${selector})`);
                                        break;
                                    }
                                }
                            }
                        }
                        if (aiProbability !== null) break;
                    }
                    if (aiProbability !== null) break;
                } catch (e) {
                    continue;
                }
            }
            
            // 如果还是没找到，尝试从整个页面文本中提取
            if (aiProbability === null) {
                console.log('   🔍 尝试从页面文本中提取结果...');
                
                const pageText = await page.evaluate(() => document.body.innerText);
                const allMatches = pageText.match(/(\d+(?:\.\d+)?)\s*%/g);
                
                if (allMatches) {
                    console.log(`   📋 页面中找到的所有百分比: ${allMatches.join(', ')}`);
                    
                    // 选择一个合理的值（通常是第一个0-100之间的值）
                    for (const match of allMatches) {
                        const value = parseFloat(match);
                        if (value >= 0 && value <= 100) {
                            aiProbability = value;
                            console.log(`   ✅ 从页面文本提取结果: ${aiProbability}%`);
                            break;
                        }
                    }
                }
            }
            
            // 最终调试截图
            if (aiProbability === null) {
                console.warn('   ⚠️ 未找到检测结果，保存调试信息');
                
                const debugInfo = {
                    url: page.url(),
                    title: await page.title(),
                    bodyText: await page.evaluate(() => document.body.innerText.substring(0, 1000)),
                    timestamp: new Date().toISOString()
                };
                
                const debugPath = path.join(debugDir, `debug_info_${Date.now()}.json`);
                await fs.writeFile(debugPath, JSON.stringify(debugInfo, null, 2));
                console.log(`   📝 调试信息已保存: ${debugPath}`);
                
                const screenshotPath = path.join(debugDir, `final_debug_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`   📸 最终调试截图: ${screenshotPath}`);
            }
            
            return aiProbability;
            
        } catch (error) {
            console.error('   ❌ 检测过程出错:', error.message);
            
            if (this.debug) {
                const screenshotPath = path.join(debugDir, `error_${Date.now()}.png`);
                try {
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    console.log(`   📸 错误截图: ${screenshotPath}`);
                } catch (e) {}
            }
            
            return null;
        } finally {
            await page.close();
        }
    }
    
    /**
     * 批量检测
     * @param {Array<Object>} items - 待检测项目列表 [{id, text}]
     * @returns {Array<Object>} - 检测结果列表 [{id, probability}]
     */
    async batchDetect(items) {
        console.log(`📋 开始批量检测 ${items.length} 个项目`);
        const results = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`\n[${i + 1}/${items.length}] 检测项目: ${item.id}`);
            
            const probability = await this.detectText(item.text);
            results.push({
                id: item.id,
                probability: probability,
                timestamp: new Date().toISOString()
            });
            
            // 批量检测间隔，避免过于频繁
            if (i < items.length - 1) {
                await this.sleep(2000);
            }
        }
        
        // 显示统计信息
        this.showStatistics();
        
        return results;
    }
    
    /**
     * 显示统计信息
     */
    showStatistics() {
        console.log('\n📊 检测统计:');
        console.log(`  尝试: ${this.stats.attempts}`);
        console.log(`  成功: ${this.stats.success}`);
        console.log(`  成功率: ${this.stats.attempts > 0 ? 
            (this.stats.success / this.stats.attempts * 100).toFixed(1) : 0}%`);
    }
    
    
    /**
     * 计算文本哈希值
     */
    hashText(text) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(text).digest('hex');
    }
    
    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        if (this.proxyManager) {
            await this.proxyManager.cleanup();
        }
        console.log('🧹 AI检测器已清理');
    }
}

// 导出模块
module.exports = EnhancedAIContentDetector;

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    
    (async () => {
        const detector = new EnhancedAIContentDetector();
        
        try {
            
            await detector.initialize();
            
            if (args[0] === '--file' && args[1]) {
                // 检测文件
                const filePath = args[1];
                const content = await fs.readFile(filePath, 'utf8');
                
                // 提取文章正文（去除元数据）
                const bodyMatch = content.match(/---[\s\S]*?---\s*([\s\S]*)/);
                const text = bodyMatch ? bodyMatch[1] : content;
                
                console.log(`\n📄 检测文件: ${filePath}`);
                const probability = await detector.detectText(text);
                
                if (probability !== null) {
                    console.log(`\n🤖 AI生成概率: ${probability}%`);
                } else {
                    console.log('\n❌ 检测失败');
                }
                
            } else if (args[0] === '--batch' && args[1]) {
                // 批量检测目录
                const dirPath = args[1];
                const files = await fs.readdir(dirPath);
                const mdFiles = files.filter(f => f.endsWith('.md'));
                
                const items = [];
                for (const file of mdFiles) {
                    const filePath = path.join(dirPath, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const bodyMatch = content.match(/---[\s\S]*?---\s*([\s\S]*)/);
                    const text = bodyMatch ? bodyMatch[1] : content;
                    
                    items.push({ id: file, text });
                }
                
                const results = await detector.batchDetect(items);
                
                console.log('\n📊 批量检测结果:');
                results.forEach(result => {
                    console.log(`${result.id}: ${result.probability !== null ? result.probability + '%' : '失败'}`);
                });
                
            } else if (args.length > 0 && !args[0].startsWith('--')) {
                // 直接检测文本
                const text = args.join(' ');
                console.log('\n📝 检测文本内容...');
                const probability = await detector.detectText(text);
                
                if (probability !== null) {
                    console.log(`\n🤖 AI生成概率: ${probability}%`);
                } else {
                    console.log('\n❌ 检测失败');
                }
                
            } else {
                console.log(`
增强版AI内容检测器 - 使用方法:

  node ai_content_detector_enhanced.js [选项] <文本或文件>

选项:
  --file <path>        检测指定文件
  --batch <dir>        批量检测目录中的所有.md文件

示例:
  node ai_content_detector_enhanced.js "这是要检测的文本"
  node ai_content_detector_enhanced.js --file article.md
  node ai_content_detector_enhanced.js --batch golf_content/2025-08-14/

说明:
  - 系统使用智能代理模式进行AI检测
  - 自动管理代理池，优化检测成功率
                `);
            }
            
        } catch (error) {
            console.error('执行失败:', error);
        } finally {
            await detector.cleanup();
        }
    })();
}