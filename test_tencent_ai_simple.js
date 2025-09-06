#!/usr/bin/env node

const { chromium } = require('playwright');
const axios = require('axios');

// 禁用代理
process.env.NO_PROXY = 'localhost,127.0.0.1';

async function testTencentAI() {
    console.log('🎯 专门测试腾讯AI检测网站访问\n');
    
    try {
        // 获取浏览器
        const listResponse = await axios.post('http://localhost:54345/browser/list', 
            { page: 0, pageSize: 100 },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.TEST_API_KEY || 'test-key-placeholder'
                },
                proxy: false 
            }
        );
        
        const browsers = listResponse.data?.data?.list || [];
        if (browsers.length === 0) {
            console.log('❌ 没有找到浏览器配置');
            return;
        }
        
        const browser = browsers[0];
        console.log(`📋 使用配置: ${browser.name || browser.id}\n`);
        
        // 启动浏览器
        const openResponse = await axios.post('http://localhost:54345/browser/open',
            { id: browser.id },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.TEST_API_KEY || 'test-key-placeholder'
                },
                proxy: false 
            }
        );
        
        const browserData = openResponse.data?.data;
        if (!browserData?.ws) {
            console.log('❌ 启动失败');
            return;
        }
        
        console.log('✅ 浏览器启动成功');
        console.log(`   WebSocket: ${browserData.ws}\n`);
        
        // 连接浏览器
        const browserInstance = await chromium.connectOverCDP(browserData.ws);
        const context = browserInstance.contexts()[0];
        const page = await context.newPage();
        
        // 测试策略
        console.log('📊 测试策略:');
        console.log('1. 首先访问腾讯主站建立连接');
        console.log('2. 然后访问AI检测页面\n');
        
        // 步骤1: 访问腾讯主站
        console.log('📍 步骤1: 访问 https://www.tencent.com');
        try {
            await page.goto('https://www.tencent.com', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            console.log('   ✅ 腾讯主站访问成功');
            await page.waitForTimeout(2000);
        } catch (e) {
            console.log('   ❌ 腾讯主站访问失败:', e.message);
        }
        
        // 步骤2: 访问AI检测页面
        console.log('\n📍 步骤2: 访问 https://matrix.tencent.com/ai-detect/');
        try {
            // 尝试不同的等待策略
            await page.goto('https://matrix.tencent.com/ai-detect/', {
                waitUntil: 'domcontentloaded', // 只等待DOM加载
                timeout: 120000  // 2分钟超时
            });
            
            console.log('   ✅ 页面导航成功！');
            
            // 等待页面稳定
            console.log('   ⏳ 等待页面加载...');
            await page.waitForTimeout(5000);
            
            // 获取页面信息
            const title = await page.title();
            console.log(`   📄 页面标题: ${title}`);
            
            // 截图
            const screenshotPath = `tencent_ai_success_${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`   📸 成功截图: ${screenshotPath}`);
            
            // 查找关键元素
            console.log('\n   🔍 查找页面元素:');
            
            // 查找输入框
            const inputSelectors = [
                'textarea[placeholder*="请输入"]',
                'textarea.el-textarea__inner',
                'textarea',
                'div[contenteditable="true"]',
                '.ai-detect-input',
                '#ai-text-input'
            ];
            
            for (const selector of inputSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        console.log(`   ✅ 找到输入框: ${selector}`);
                        break;
                    }
                } catch (e) {}
            }
            
            // 查找检测按钮
            const buttonSelectors = [
                'button:has-text("检测")',
                '.detect-btn',
                'button.el-button'
            ];
            
            for (const selector of buttonSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        console.log(`   ✅ 找到按钮: ${selector}`);
                        break;
                    }
                } catch (e) {}
            }
            
        } catch (error) {
            console.log(`   ❌ 访问失败: ${error.message}`);
            
            // 错误截图
            try {
                const errorScreenshot = `tencent_ai_error_${Date.now()}.png`;
                await page.screenshot({ path: errorScreenshot });
                console.log(`   📸 错误截图: ${errorScreenshot}`);
            } catch (e) {}
            
            // 尝试获取页面内容
            try {
                const url = page.url();
                console.log(`   📍 当前URL: ${url}`);
            } catch (e) {}
        }
        
        // 清理
        await browserInstance.close();
        await axios.post('http://localhost:54345/browser/close',
            { id: browser.id },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.TEST_API_KEY || 'test-key-placeholder'
                },
                proxy: false 
            }
        );
        
        console.log('\n✅ 测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 运行测试
testTencentAI();