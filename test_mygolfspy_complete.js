#!/usr/bin/env node

/**
 * 测试MyGolfSpy.com完整流程
 * 包括文章抓取、图片下载和内容处理
 */

const { chromium } = require('playwright');
const BatchArticleProcessor = require('./batch_process_articles');

async function testMyGolfSpyArticle() {
    // 测试用的文章URL数组（已验证可访问）
    const testUrls = [
        'https://mygolfspy.com/news-opinion/instruction/putting-fundamentals-why-are-my-putts-coming-up-short/',
        'https://mygolfspy.com/news-opinion/instruction/how-to-put-spin-on-a-golf-ball-3-simple-tricks/',
        'https://mygolfspy.com/news-opinion/why-am-i-hitting-the-ground-before-the-ball-6-quick-fixes/',
        'https://mygolfspy.com/news-opinion/scotty-camerons-phantom-black-putters-more-than-just-a-new-color/',
        'https://mygolfspy.com/news-opinion/first-look/new-course-openings-were-excited-about-in-2025/'
    ];
    
    console.log('🔍 测试MyGolfSpy.com文章抓取');
    console.log('═'.repeat(60));
    
    const processor = new BatchArticleProcessor();
    
    try {
        // 初始化浏览器
        processor.browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        // 尝试每个URL，直到找到一个有效的
        for (const testUrl of testUrls) {
            console.log(`\n🔗 尝试URL: ${testUrl}`);
            
            try {
                // 先测试URL是否可访问
                const page = await processor.browser.newPage();
                const response = await page.goto(testUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 30000 
                });
                
                if (!response || !response.ok()) {
                    console.log(`❌ URL无法访问: ${response ? response.status() : 'timeout'}`);
                    await page.close();
                    continue;
                }
                
                // 检查是否是404页面
                const isNotFound = await page.evaluate(() => {
                    const title = document.title.toLowerCase();
                    const body = document.body.textContent.toLowerCase();
                    return title.includes('404') || title.includes('not found') || 
                           body.includes('uh oh') || body.includes('lost this one');
                });
                
                await page.close();
                
                if (isNotFound) {
                    console.log(`❌ 页面不存在（404）`);
                    continue;
                }
                
                console.log(`✅ URL有效，开始处理文章...`);
                console.log('─'.repeat(50));
                
                // 处理文章
                const results = await processor.processArticles([testUrl]);
                
                if (results && results.length > 0) {
                    const article = results[0];
                    console.log('\n✅ 文章处理成功！\n');
                    
                    // 显示结果
                    console.log('📊 处理结果：');
                    console.log('─'.repeat(40));
                    console.log(`标题: ${article.title}`);
                    console.log(`内容长度: ${article.content.length} 字符`);
                    console.log(`段落数: ${(article.content.match(/\n\n/g) || []).length}`);
                    console.log(`图片总数: ${article.images.length}`);
                    
                    // 统计下载成功的图片
                    const downloadedImages = article.images.filter(img => img.downloaded);
                    console.log(`成功下载: ${downloadedImages.length} 张`);
                    
                    if (article.images.length > 0) {
                        console.log('\n📷 图片详情：');
                        console.log('─'.repeat(40));
                        article.images.forEach((img, i) => {
                            const status = img.downloaded ? '✅' : '❌';
                            const filename = img.filename || '未下载';
                            console.log(`${i + 1}. ${status} ${filename}`);
                            if (img.alt) {
                                console.log(`   描述: ${img.alt}`);
                            }
                            if (img.url) {
                                console.log(`   原始URL: ${img.url.substring(0, 80)}...`);
                            }
                        });
                    }
                    
                    // 显示内容预览
                    console.log('\n📝 内容预览（前500字符）：');
                    console.log('─'.repeat(40));
                    console.log(article.content.substring(0, 500) + '...\n');
                    
                    // 检查图片格式分布
                    const fs = require('fs');
                    const path = require('path');
                    const formatCount = { jpg: 0, png: 0, webp: 0, avif: 0 };
                    
                    downloadedImages.forEach(img => {
                        if (img.filename) {
                            const imagePath = path.join('./golf_content/images', img.filename);
                            if (fs.existsSync(imagePath)) {
                                const ext = path.extname(img.filename).toLowerCase().slice(1);
                                if (formatCount.hasOwnProperty(ext)) {
                                    formatCount[ext]++;
                                }
                            }
                        }
                    });
                    
                    console.log('🎯 图片格式分布：');
                    console.log('─'.repeat(40));
                    Object.entries(formatCount).forEach(([format, count]) => {
                        if (count > 0) {
                            console.log(`${format.toUpperCase()}: ${count} 张`);
                        }
                    });
                    
                    // 检查是否正确使用了MyGolfSpy专用处理器
                    if (downloadedImages.some(img => img.filename && img.filename.includes('mygolfspy_image_'))) {
                        console.log('\n🎉 成功使用MyGolfSpy专用图片处理器！');
                    }
                    
                    // 显示处理统计
                    console.log('\n📈 处理统计：');
                    console.log('─'.repeat(40));
                    console.log(`处理成功率: ${Math.round((downloadedImages.length / article.images.length) * 100)}%`);
                    
                    if (downloadedImages.length > 0) {
                        const totalSize = downloadedImages.reduce((sum, img) => {
                            const imagePath = path.join('./golf_content/images', img.filename || '');
                            if (fs.existsSync(imagePath)) {
                                return sum + fs.statSync(imagePath).size;
                            }
                            return sum;
                        }, 0);
                        console.log(`总图片大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
                    }
                    
                    console.log('\n🎯 测试完成！');
                    break; // 成功处理了一个URL，退出循环
                } else {
                    console.log('\n❌ 文章处理失败');
                    continue;
                }
                
            } catch (error) {
                console.error(`❌ 处理URL时出错: ${error.message}`);
                continue;
            }
        }
        
    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    } finally {
        if (processor.browser) {
            await processor.browser.close();
        }
    }
}

// 运行测试
testMyGolfSpyArticle().catch(console.error);