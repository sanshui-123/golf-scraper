#!/usr/bin/env node

const BatchArticleProcessor = require('./batch_process_articles');
const fs = require('fs');
const path = require('path');

async function processArticleDirectly() {
    console.log('🔧 直接处理推杆握把文章...\n');
    
    const url = 'https://www.golfmonthly.com/tips/i-hit-60-putts-from-6ft-using-three-different-putting-grips-but-which-worked-best';
    
    // 清理所有可能的错误映射
    console.log('1️⃣ 清理错误映射...');
    const baseDir = 'golf_content';
    const dateDirs = fs.readdirSync(baseDir)
        .filter(dir => {
            const fullPath = path.join(baseDir, dir);
            return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
        });
    
    for (const dateDir of dateDirs) {
        const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
        if (fs.existsSync(urlsJsonPath)) {
            try {
                const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                let modified = false;
                
                // 检查并删除任何指向不存在文件的映射
                for (const [articleNum, recordedUrl] of Object.entries(urlMapping)) {
                    const htmlFile = `wechat_article_${articleNum}.html`;
                    const htmlPath = path.join(baseDir, dateDir, 'wechat_html', htmlFile);
                    
                    if (!fs.existsSync(htmlPath)) {
                        console.log(`  ❌ 删除无效映射: ${dateDir}/article_urls.json 中的 ${articleNum} -> ${recordedUrl}`);
                        delete urlMapping[articleNum];
                        modified = true;
                    }
                }
                
                if (modified) {
                    fs.writeFileSync(urlsJsonPath, JSON.stringify(urlMapping, null, 2), 'utf8');
                    console.log(`  ✅ 已更新 ${dateDir}/article_urls.json`);
                }
            } catch (e) {
                console.error(`  ❌ 处理 ${urlsJsonPath} 失败:`, e.message);
            }
        }
    }
    
    console.log('\n2️⃣ 创建临时的批量处理器（跳过URL检查）...');
    
    // 创建处理器实例
    const processor = new BatchArticleProcessor();
    
    // 临时覆盖 checkUrlsForDuplicates 方法，跳过重复检查
    processor.checkUrlsForDuplicates = async (urls) => {
        console.log('⏭️  跳过URL重复检查（修复模式）');
        return {
            newUrls: urls,
            duplicateUrls: [],
            skippedCount: 0
        };
    };
    
    console.log('\n3️⃣ 开始处理文章...');
    
    try {
        await processor.processArticles([url]);
        console.log('\n✅ 文章处理完成！');
    } catch (error) {
        console.error('\n❌ 处理失败:', error.message);
        process.exit(1);
    }
}

// 执行
processArticleDirectly().catch(console.error);