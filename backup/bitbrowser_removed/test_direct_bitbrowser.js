#!/usr/bin/env node

const { chromium } = require('playwright');
const axios = require('axios');

// 禁用代理
process.env.NO_PROXY = 'localhost,127.0.0.1';

async function testBitBrowser() {
    console.log('🚀 直接测试BitBrowser连接...\n');
    
    try {
        // 1. 获取浏览器列表
        console.log('1️⃣ 获取浏览器列表...');
        const listResponse = await axios.post('http://localhost:54345/browser/list', 
            { page: 0, pageSize: 100 },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': '34f2d7b955974ed8ae29759243693681'
                },
                proxy: false 
            }
        );
        
        const browsers = listResponse.data?.data?.list || [];
        console.log(`   找到 ${browsers.length} 个浏览器配置\n`);
        
        if (browsers.length === 0) {
            console.log('❌ 没有找到浏览器配置');
            return;
        }
        
        // 2. 选择第一个健康的配置
        const browser = browsers[0];
        console.log(`2️⃣ 使用配置: ${browser.name || browser.id}`);
        console.log(`   ID: ${browser.id}\n`);
        
        // 3. 启动浏览器
        console.log('3️⃣ 启动浏览器...');
        const openResponse = await axios.post('http://localhost:54345/browser/open',
            { id: browser.id },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': '34f2d7b955974ed8ae29759243693681'
                },
                proxy: false 
            }
        );
        
        const browserData = openResponse.data?.data;
        if (!browserData?.ws) {
            console.log('❌ 启动失败:', openResponse.data);
            return;
        }
        
        console.log('   ✅ 浏览器启动成功');
        console.log(`   WebSocket: ${browserData.ws}\n`);
        
        // 4. 连接到浏览器
        console.log('4️⃣ 连接到浏览器...');
        const browserInstance = await chromium.connectOverCDP(browserData.ws);
        console.log('   ✅ 连接成功\n');
        
        // 5. 创建新页面并测试
        console.log('5️⃣ 创建新页面...');
        const context = browserInstance.contexts()[0];
        const page = await context.newPage();
        console.log('   ✅ 页面创建成功\n');
        
        // 6. 访问AI检测页面
        console.log('6️⃣ 访问AI检测页面...');
        console.log('   正在导航到: https://matrix.tencent.com/ai-detect/');
        
        try {
            await page.goto('https://matrix.tencent.com/ai-detect/', {
                waitUntil: 'networkidle',
                timeout: 60000
            });
            console.log('   ✅ 页面加载成功！\n');
            
            // 7. 测试页面内容
            console.log('7️⃣ 检查页面内容...');
            const title = await page.title();
            console.log(`   页面标题: ${title}`);
            
            // 截图
            const screenshotPath = `bitbrowser_test_${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath });
            console.log(`   📸 截图保存: ${screenshotPath}\n`);
            
            // 8. 查找输入框
            console.log('8️⃣ 查找输入框...');
            const selectors = [
                'textarea[placeholder*="请输入"]',
                'textarea.el-textarea__inner',
                'textarea',
                'div[contenteditable="true"]'
            ];
            
            let inputFound = false;
            for (const selector of selectors) {
                const element = await page.$(selector);
                if (element) {
                    console.log(`   ✅ 找到输入框: ${selector}`);
                    inputFound = true;
                    
                    // 输入测试文本
                    await element.fill('这是一个测试文本，用于检测AI内容。');
                    console.log('   ✅ 已输入测试文本\n');
                    break;
                }
            }
            
            if (!inputFound) {
                console.log('   ❌ 未找到输入框\n');
            }
            
        } catch (error) {
            console.log(`   ❌ 页面加载失败: ${error.message}\n`);
            
            // 错误截图
            const errorScreenshot = `bitbrowser_error_${Date.now()}.png`;
            await page.screenshot({ path: errorScreenshot });
            console.log(`   📸 错误截图: ${errorScreenshot}\n`);
        }
        
        // 9. 关闭浏览器
        console.log('9️⃣ 关闭浏览器...');
        await browserInstance.close();
        
        await axios.post('http://localhost:54345/browser/close',
            { id: browser.id },
            { 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': '34f2d7b955974ed8ae29759243693681'
                },
                proxy: false 
            }
        );
        console.log('   ✅ 浏览器已关闭\n');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('   响应数据:', error.response.data);
        }
    }
}

// 运行测试
testBitBrowser();