#!/usr/bin/env node

/**
 * 测试Today's Golfer图片处理修复
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SiteSpecificScrapers = require('./site_specific_scrapers');
const ImageProcessorFinal = require('./image_processor_final');

async function testTodaysGolferFix() {
    console.log('🧪 测试Today\'s Golfer图片处理修复...\n');
    
    const browser = await chromium.launch({ headless: true });
    
    try {
        const scrapers = new SiteSpecificScrapers();
        const testUrl = 'https://www.todays-golfer.com/news-and-events/equipment-news/2025-drivers-with-highest-smash-factor/';
        
        console.log(`📍 测试URL: ${testUrl}`);
        
        // 抓取文章内容
        const page = await browser.newPage();
        await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const articleData = await scrapers.scrapeTodaysGolferArticle(page);
        await page.close();
        
        if (!articleData) {
            console.error('❌ 无法抓取文章内容');
            return;
        }
        
        console.log(`\n📄 文章标题: ${articleData.title}`);
        console.log(`📷 原始图片数量: ${articleData.images.length}`);
        
        // 显示原始图片列表
        console.log('\n🖼️ 原始图片列表:');
        articleData.images.forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.alt} - ${img.url.substring(0, 80)}...`);
        });
        
        // 测试图片处理器
        const testDir = path.join(process.cwd(), 'test_todays_golfer');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        const imageProcessor = new ImageProcessorFinal(testDir);
        const currentDate = new Date().toISOString().split('T')[0];
        
        console.log('\n🔄 处理图片...');
        const processedImages = await imageProcessor.downloadImages(
            browser,
            articleData.images,
            9999, // 测试文章编号
            currentDate,
            testUrl
        );
        
        console.log(`\n✅ 处理后图片数量: ${processedImages.length}`);
        
        // 显示处理后的图片
        console.log('\n📸 处理后的图片:');
        processedImages.forEach((img, i) => {
            if (img.downloaded) {
                console.log(`  ✅ ${i + 1}. ${img.alt} -> ${img.filename}`);
            } else {
                console.log(`  ❌ ${i + 1}. ${img.alt} - 下载失败`);
            }
        });
        
        // 分析去重效果
        const originalCount = articleData.images.length;
        const downloadedCount = processedImages.filter(img => img.downloaded).length;
        const dedupeRate = ((originalCount - downloadedCount) / originalCount * 100).toFixed(1);
        
        console.log('\n📊 统计结果:');
        console.log(`  - 原始图片数: ${originalCount}`);
        console.log(`  - 实际下载数: ${downloadedCount}`);
        console.log(`  - 去重率: ${dedupeRate}%`);
        
        // 检查是否还有重复的alt文本
        const altTexts = processedImages.map(img => img.alt);
        const uniqueAlts = new Set(altTexts);
        
        if (altTexts.length !== uniqueAlts.size) {
            console.log('\n⚠️ 警告: 仍有重复的图片描述');
            const duplicates = altTexts.filter((alt, index) => altTexts.indexOf(alt) !== index);
            console.log('  重复的描述:', [...new Set(duplicates)]);
        } else {
            console.log('\n✅ 所有图片描述都是唯一的');
        }
        
        // 生成测试HTML
        const testHtml = generateTestHtml(articleData.title, articleData.content, processedImages);
        const htmlPath = path.join(testDir, 'test_article.html');
        fs.writeFileSync(htmlPath, testHtml);
        console.log(`\n📄 测试HTML已生成: ${htmlPath}`);
        
        // 清理测试目录
        console.log('\n🧹 清理测试文件...');
        const files = fs.readdirSync(testDir);
        files.forEach(file => {
            if (file.startsWith('article_9999_')) {
                fs.unlinkSync(path.join(testDir, file));
            }
        });
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await browser.close();
    }
}

function generateTestHtml(title, content, images) {
    // 替换图片占位符
    let htmlContent = content;
    images.forEach(img => {
        if (img.downloaded && img.filename) {
            const placeholder = new RegExp(`\\[IMAGE_${img.index}:[^\\]]+\\]`, 'g');
            const imgTag = `<img src="${img.filename}" alt="${img.alt}" style="max-width: 100%; margin: 20px 0;">`;
            htmlContent = htmlContent.replace(placeholder, imgTag);
        }
    });
    
    // 转换Markdown到HTML
    htmlContent = htmlContent
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            margin-top: 2em;
        }
        .test-info {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="test-info">
        <h3>测试信息</h3>
        <p>生成时间: ${new Date().toLocaleString()}</p>
        <p>图片数量: ${images.filter(img => img.downloaded).length}</p>
    </div>
    <h1>${title}</h1>
    ${htmlContent}
</body>
</html>`;
}

// 运行测试
testTodaysGolferFix().catch(console.error);