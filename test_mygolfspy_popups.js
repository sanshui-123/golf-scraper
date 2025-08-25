#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs').promises;

async function testMyGolfSpyPopups() {
    console.log('🔍 MyGolfSpy弹窗测试开始...');
    
    const browser = await chromium.launch({
        headless: false, // 有头模式，便于观察
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();

        // 监听所有对话框事件
        page.on('dialog', async dialog => {
            console.log(`📢 检测到对话框: ${dialog.type()} - ${dialog.message()}`);
            await dialog.dismiss();
        });

        console.log('🌐 访问 https://mygolfspy.com ...');
        
        try {
            await page.goto('https://mygolfspy.com', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            console.log('✅ 页面加载成功');
            
            // 等待页面稳定
            await page.waitForTimeout(5000);
            
            // 截图1：初始状态
            await page.screenshot({ path: 'mygolfspy_initial.png', fullPage: false });
            console.log('📸 已保存初始截图: mygolfspy_initial.png');
            
            // 检查各种可能的弹窗选择器
            const popupSelectors = [
                // 常见弹窗关闭按钮
                '[class*="popup-close"]',
                '[class*="modal-close"]',
                '[class*="close-button"]',
                '[class*="dismiss"]',
                '[aria-label="Close"]',
                '[aria-label="close"]',
                'button[class*="close"]',
                '.close-btn',
                '.close-button',
                
                // Cookie相关
                '[id*="cookie"] button',
                '[class*="cookie"] button',
                '[class*="gdpr"] button',
                '[class*="consent"] button',
                
                // 订阅相关
                '[class*="newsletter"] [class*="close"]',
                '[class*="subscribe"] [class*="close"]',
                '[id*="newsletter"] [class*="close"]',
                
                // 其他可能的弹窗
                '.fancybox-close',
                '.mfp-close',
                '.modal button.close',
                '.overlay [class*="close"]',
                '[class*="lightbox"] [class*="close"]'
            ];
            
            console.log('\n🔍 查找弹窗元素...');
            let foundPopups = false;
            
            for (const selector of popupSelectors) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        console.log(`✅ 找到弹窗元素: ${selector} (${elements.length}个)`);
                        foundPopups = true;
                        
                        // 尝试点击第一个可见的
                        for (const element of elements) {
                            const isVisible = await element.isVisible();
                            if (isVisible) {
                                const box = await element.boundingBox();
                                console.log(`  📍 位置: x=${box?.x}, y=${box?.y}`);
                                
                                try {
                                    await element.click();
                                    console.log(`  ✅ 已点击关闭`);
                                    await page.waitForTimeout(1000);
                                    break;
                                } catch (e) {
                                    console.log(`  ❌ 点击失败: ${e.message}`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    // 选择器可能无效，继续下一个
                }
            }
            
            if (!foundPopups) {
                console.log('❌ 未找到明显的弹窗元素');
            }
            
            // 检查是否有iframe（有些弹窗在iframe中）
            const iframes = await page.$$('iframe');
            if (iframes.length > 0) {
                console.log(`\n📋 发现 ${iframes.length} 个iframe，可能包含弹窗`);
                for (let i = 0; i < iframes.length; i++) {
                    const frame = await iframes[i].contentFrame();
                    if (frame) {
                        const url = frame.url();
                        console.log(`  iframe[${i}]: ${url}`);
                    }
                }
            }
            
            // 检查是否有覆盖层
            const overlaySelectors = [
                '[class*="overlay"]',
                '[class*="backdrop"]',
                '[class*="modal-bg"]',
                '.modal-backdrop'
            ];
            
            console.log('\n🔍 查找覆盖层...');
            for (const selector of overlaySelectors) {
                const overlays = await page.$$(selector);
                if (overlays.length > 0) {
                    console.log(`✅ 找到覆盖层: ${selector} (${overlays.length}个)`);
                    
                    for (const overlay of overlays) {
                        const isVisible = await overlay.isVisible();
                        if (isVisible) {
                            const styles = await overlay.evaluate(el => {
                                const computed = window.getComputedStyle(el);
                                return {
                                    display: computed.display,
                                    visibility: computed.visibility,
                                    opacity: computed.opacity,
                                    zIndex: computed.zIndex
                                };
                            });
                            console.log(`  样式:`, styles);
                        }
                    }
                }
            }
            
            // 再等待一下
            await page.waitForTimeout(2000);
            
            // 截图2：处理后状态
            await page.screenshot({ path: 'mygolfspy_after.png', fullPage: false });
            console.log('\n📸 已保存处理后截图: mygolfspy_after.png');
            
            // 尝试获取一篇文章
            console.log('\n🔍 尝试访问一篇文章...');
            const articleUrl = 'https://mygolfspy.com/buyers-guides/irons/top-3-longest-super-game-improvement-irons-2025/';
            
            try {
                await page.goto(articleUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
                
                console.log('✅ 文章页面加载成功');
                
                // 等待内容加载
                await page.waitForTimeout(3000);
                
                // 截图文章页面
                await page.screenshot({ path: 'mygolfspy_article.png', fullPage: false });
                console.log('📸 已保存文章页面截图: mygolfspy_article.png');
                
                // 检查文章内容是否可见
                const title = await page.$('h1');
                if (title) {
                    const titleText = await title.textContent();
                    console.log(`✅ 文章标题: ${titleText}`);
                }
                
            } catch (e) {
                console.log(`❌ 文章页面加载失败: ${e.message}`);
            }
            
        } catch (e) {
            console.log(`❌ 主页加载失败: ${e.message}`);
            
            // 截图错误页面
            await page.screenshot({ path: 'mygolfspy_error.png', fullPage: false });
            console.log('📸 已保存错误截图: mygolfspy_error.png');
        }
        
        console.log('\n📊 测试完成！请查看生成的截图文件。');
        console.log('提示：保持浏览器打开以便手动检查');
        
        // 保持浏览器打开30秒，便于手动检查
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('❌ 测试错误:', error);
    } finally {
        await browser.close();
    }
}

// 执行测试
testMyGolfSpyPopups().catch(console.error);