#!/usr/bin/env node

/**
 * 直接测试AI检测（使用Playwright）
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testDirectAIDetection() {
    console.log('🧪 直接测试AI检测功能\n');
    
    let browser;
    try {
        // 1. 启动浏览器
        console.log('1️⃣ 启动浏览器...');
        browser = await chromium.launch({
            headless: false, // 设置为false以便观察
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        // 2. 访问腾讯AI检测平台
        console.log('2️⃣ 访问腾讯AI检测平台...');
        try {
            await page.goto('https://matrix.tencent.com/ai-detect/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            console.log('✅ 成功访问AI检测平台');
        } catch (error) {
            console.log('❌ 访问失败:', error.message);
            console.log('尝试访问备用地址...');
            await page.goto('https://app.xiezuocat.com/aichat', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        }
        
        // 3. 等待页面加载
        await page.waitForTimeout(3000);
        
        // 4. 测试文本
        const testText = '这是一段测试文本，用于验证AI检测功能是否正常工作。我们需要确认系统能够正确识别文本内容并返回AI检测概率。';
        console.log('3️⃣ 输入测试文本...');
        console.log(`   文本: ${testText.substring(0, 50)}...`);
        
        // 5. 获取一篇实际文章进行测试
        const today = new Date().toISOString().split('T')[0];
        const articlesDir = path.join('golf_content', today, 'wechat_ready');
        
        if (fs.existsSync(articlesDir)) {
            const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
            if (files.length > 0) {
                const content = fs.readFileSync(path.join(articlesDir, files[0]), 'utf8');
                let articleText = content
                    .replace(/<!-- AI检测:.*?-->\n/, '') // 移除已有的AI检测注释
                    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 保留链接文本
                    .substring(0, 1000); // 限制长度
                
                console.log('4️⃣ 使用实际文章文本进行测试');
                console.log(`   文章: ${files[0]}`);
                console.log(`   长度: ${articleText.length} 字符`);
            }
        }
        
        // 6. 保持浏览器开启以便手动测试
        console.log('\n⏳ 浏览器将保持开启30秒，您可以手动进行测试...');
        console.log('📌 手动测试步骤：');
        console.log('1. 在页面中找到文本输入框');
        console.log('2. 粘贴文本内容');
        console.log('3. 点击"检测"或"开始检测"按钮');
        console.log('4. 查看检测结果');
        
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('\n🔚 浏览器已关闭');
        }
    }
}

// 运行
if (require.main === module) {
    testDirectAIDetection()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = testDirectAIDetection;