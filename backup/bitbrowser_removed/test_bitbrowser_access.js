#!/usr/bin/env node

const { chromium } = require('playwright');
const axios = require('axios');

// 禁用代理
process.env.NO_PROXY = 'localhost,127.0.0.1';

async function testAccess() {
    console.log('🌐 测试BitBrowser网络访问能力\n');
    
    try {
        // 获取浏览器列表
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
                    'x-api-key': '34f2d7b955974ed8ae29759243693681'
                },
                proxy: false 
            }
        );
        
        const browserData = openResponse.data?.data;
        if (!browserData?.ws) {
            console.log('❌ 启动失败');
            return;
        }
        
        console.log('✅ 浏览器启动成功\n');
        
        // 连接到浏览器
        const browserInstance = await chromium.connectOverCDP(browserData.ws);
        const context = browserInstance.contexts()[0];
        const page = await context.newPage();
        
        // 测试访问不同的网站
        const testSites = [
            { name: '百度', url: 'https://www.baidu.com', expectedText: '百度一下' },
            { name: 'IP查询', url: 'https://www.ipip.net/', expectedText: 'IP' },
            { name: '腾讯AI检测', url: 'https://matrix.tencent.com/ai-detect/', expectedText: '检测' }
        ];
        
        for (const site of testSites) {
            console.log(`📍 测试访问: ${site.name} (${site.url})`);
            
            try {
                await page.goto(site.url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
                
                const title = await page.title();
                console.log(`   ✅ 访问成功`);
                console.log(`   📄 页面标题: ${title}`);
                
                // 截图
                const screenshotPath = `test_${site.name}_${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath });
                console.log(`   📸 截图: ${screenshotPath}`);
                
                // 如果是IP查询网站，获取IP信息
                if (site.name === 'IP查询') {
                    try {
                        // 等待页面加载
                        await page.waitForTimeout(3000);
                        
                        // 获取页面文本内容
                        const bodyText = await page.evaluate(() => document.body.innerText);
                        console.log(`   🌍 页面内容预览:`);
                        console.log(`   ${bodyText.substring(0, 200)}...`);
                    } catch (e) {
                        console.log(`   ⚠️ 无法获取IP信息`);
                    }
                }
                
            } catch (error) {
                console.log(`   ❌ 访问失败: ${error.message}`);
                
                // 错误截图
                try {
                    const errorScreenshot = `error_${site.name}_${Date.now()}.png`;
                    await page.screenshot({ path: errorScreenshot });
                    console.log(`   📸 错误截图: ${errorScreenshot}`);
                } catch (e) {}
            }
            
            console.log('');
        }
        
        // 关闭浏览器
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
        
        console.log('✅ 测试完成！');
        console.log('\n💡 提示：');
        console.log('   • 如果无法访问腾讯AI检测，请确保BitBrowser配置了中国IP代理');
        console.log('   • 在BitBrowser中为该配置文件设置代理');
        console.log('   • 或者使用已经配置好中国IP的浏览器配置文件');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 运行测试
testAccess();