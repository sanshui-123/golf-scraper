#!/usr/bin/env node

/**
 * 直接AI内容检测器 - 不使用代理
 * 使用Playwright直接访问腾讯AI检测服务
 */

const { chromium } = require('playwright');
const crypto = require('crypto');

class DirectAIContentDetector {
    constructor() {
        this.cache = new Map();
        this.timeout = 60000; // 60秒超时
    }

    /**
     * 检测文本的AI率
     */
    async detectText(text) {
        if (!text || text.trim().length < 10) {
            console.log('⚠️ 文本太短，跳过检测');
            return null;
        }

        // 使用缓存
        const textHash = crypto.createHash('md5').update(text).digest('hex');
        if (this.cache.has(textHash)) {
            console.log('📦 使用缓存的检测结果');
            return this.cache.get(textHash);
        }

        let browser = null;
        try {
            console.log('🌐 启动浏览器...');
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                viewport: { width: 1920, height: 1080 }
            });

            const page = await context.newPage();
            
            console.log('📍 访问AI检测页面...');
            await page.goto('https://matrix.tencent.com/ai-detect/', {
                waitUntil: 'networkidle',
                timeout: this.timeout
            });

            // 等待页面加载
            await page.waitForTimeout(2000);

            // 查找文本框
            const textarea = await page.locator('textarea, [contenteditable="true"], input[type="text"]').first();
            if (!textarea) {
                throw new Error('未找到输入框');
            }

            console.log('📝 输入文本...');
            await textarea.fill(text);
            await page.waitForTimeout(1000);

            // 查找并点击检测按钮
            const detectButton = await page.locator('button:has-text("检测"), button:has-text("开始检测"), button:has-text("立即检测")').first();
            if (!detectButton) {
                throw new Error('未找到检测按钮');
            }

            console.log('🔍 开始检测...');
            await detectButton.click();

            // 等待结果
            await page.waitForTimeout(3000);

            // 提取结果
            const resultText = await page.locator('[class*="result"], [class*="probability"], [class*="score"]').textContent();
            const probabilityMatch = resultText.match(/(\d+)%/);
            
            if (probabilityMatch) {
                const probability = parseInt(probabilityMatch[1]);
                console.log(`✅ 检测完成: ${probability}%`);
                
                // 缓存结果
                this.cache.set(textHash, probability);
                
                return probability;
            } else {
                throw new Error('无法解析检测结果');
            }

        } catch (error) {
            console.error('❌ 检测失败:', error.message);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * 检测文件
     */
    async detectFile(filePath) {
        const fs = require('fs').promises;
        try {
            let content = await fs.readFile(filePath, 'utf8');
            
            // 移除AI检测注释
            content = content.replace(/<!-- AI检测:.*?-->\n?/g, '');
            
            // 提取纯文本
            content = content.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
            content = content.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
            content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            content = content.replace(/\n\n\n+/g, '\n\n');
            
            const probability = await this.detectText(content.trim());
            
            if (probability !== null) {
                // 更新文件
                const originalContent = await fs.readFile(filePath, 'utf8');
                const aiComment = `<!-- AI检测: ${probability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->`;
                
                let updatedContent;
                if (originalContent.includes('<!-- AI检测:')) {
                    updatedContent = originalContent.replace(/<!-- AI检测:.*?-->/, aiComment);
                } else {
                    updatedContent = aiComment + '\n' + originalContent;
                }
                
                await fs.writeFile(filePath, updatedContent, 'utf8');
                console.log(`📄 已更新文件: ${filePath}`);
            }
            
            return probability;
        } catch (error) {
            console.error('❌ 文件处理失败:', error.message);
            return null;
        }
    }
}

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === '--file' && args[1]) {
        const detector = new DirectAIContentDetector();
        detector.detectFile(args[1]).then(probability => {
            if (probability !== null) {
                console.log(`\n🎯 最终AI检测率: ${probability}%`);
            }
            process.exit(0);
        });
    } else {
        console.log(`
使用方法:
  node ai_content_detector_direct.js --file <文件路径>

示例:
  node ai_content_detector_direct.js --file article.md
        `);
    }
}