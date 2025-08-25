#!/usr/bin/env node

/**
 * 清理重复文章
 * 保留最早的版本，删除后续重复
 */

const fs = require('fs');
const path = require('path');

function cleanDuplicates() {
    const baseDir = path.join(process.cwd(), 'golf_content', '2025-07-24');
    const urlMapFile = path.join(baseDir, 'article_urls.json');
    
    if (!fs.existsSync(urlMapFile)) {
        console.log('❌ 找不到URL映射文件');
        return;
    }
    
    // 读取URL映射
    const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
    
    // 找出重复的URL
    const urlToNumbers = {};
    for (const [num, url] of Object.entries(urlMapping)) {
        if (!urlToNumbers[url]) {
            urlToNumbers[url] = [];
        }
        urlToNumbers[url].push(num);
    }
    
    // 统计重复
    console.log('🔍 检测到的重复文章：\n');
    const duplicates = {};
    for (const [url, numbers] of Object.entries(urlToNumbers)) {
        if (numbers.length > 1) {
            // 按编号排序，保留最小的
            numbers.sort((a, b) => parseInt(a) - parseInt(b));
            duplicates[url] = {
                keep: numbers[0],
                remove: numbers.slice(1)
            };
            
            console.log(`📄 ${url.split('/').pop()}`);
            console.log(`   保留: ${numbers[0]}`);
            console.log(`   删除: ${numbers.slice(1).join(', ')}\n`);
        }
    }
    
    if (Object.keys(duplicates).length === 0) {
        console.log('✅ 没有发现重复文章');
        return;
    }
    
    // 确认删除
    console.log(`\n⚠️ 将删除 ${Object.values(duplicates).reduce((sum, d) => sum + d.remove.length, 0)} 个重复文章\n`);
    
    // 执行删除
    let deletedCount = 0;
    for (const [url, data] of Object.entries(duplicates)) {
        for (const num of data.remove) {
            // 删除相关文件
            const files = [
                path.join(baseDir, 'wechat_ready', `wechat_article_${num}.md`),
                path.join(baseDir, 'wechat_html', `wechat_article_${num}.html`),
                path.join(baseDir, 'articles', `article_${num}.md`)
            ];
            
            // 查找并删除相关图片
            const imagesDir = path.join(baseDir, 'images');
            if (fs.existsSync(imagesDir)) {
                const imageFiles = fs.readdirSync(imagesDir)
                    .filter(f => f.includes(`_${num}_`) || f.includes(`article_${num}_`));
                imageFiles.forEach(f => {
                    files.push(path.join(imagesDir, f));
                });
            }
            
            // 删除文件
            for (const file of files) {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`   🗑️ 删除: ${path.basename(file)}`);
                    deletedCount++;
                }
            }
            
            // 从URL映射中删除
            delete urlMapping[num];
        }
    }
    
    // 保存更新后的URL映射
    fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2));
    console.log(`\n✅ 清理完成！删除了 ${deletedCount} 个文件`);
    
    // 显示清理后的状态
    const remainingCount = Object.keys(urlMapping).length;
    console.log(`📊 剩余文章数: ${remainingCount}`);
}

// 运行清理
if (require.main === module) {
    cleanDuplicates();
}