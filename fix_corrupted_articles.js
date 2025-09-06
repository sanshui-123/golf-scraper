#!/usr/bin/env node

/**
 * 修复被错误改写的文章
 * 扫描并重新处理包含确认消息而非实际内容的文章
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 确认消息模式
const confirmationPatterns = [
    /^已完成.*改写/,
    /^改写完成/,
    /^文章已.*改写/,
    /深度人性化处理/,
    /按照.*习惯.*处理/
];

// 扫描目录中的损坏文章
function scanCorruptedArticles() {
    const dates = fs.readdirSync('./golf_content').filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const corruptedArticles = [];
    
    for (const date of dates) {
        const wechatDir = path.join('./golf_content', date, 'wechat_ready');
        if (!fs.existsSync(wechatDir)) continue;
        
        const files = fs.readdirSync(wechatDir).filter(f => f.endsWith('.md') && f.startsWith('wechat_article_'));
        
        for (const file of files) {
            const content = fs.readFileSync(path.join(wechatDir, file), 'utf8');
            
            // 移除元数据注释
            const mainContent = content.replace(/^<!--.*?-->\n/gm, '').trim();
            
            // 检查是否为确认消息
            const isCorrupted = confirmationPatterns.some(pattern => pattern.test(mainContent)) && mainContent.length < 200;
            
            if (isCorrupted) {
                const articleNum = file.match(/wechat_article_(\d+)\.md/)?.[1];
                corruptedArticles.push({
                    date,
                    file,
                    articleNum,
                    content: mainContent,
                    path: path.join(wechatDir, file)
                });
            }
        }
    }
    
    return corruptedArticles;
}

// 从failed_articles.json查找原始URL
function findOriginalUrl(articleNum, date) {
    const failedFile = path.join('./golf_content', date, 'failed_articles', 'failed_articles.json');
    if (!fs.existsSync(failedFile)) return null;
    
    try {
        const failed = JSON.parse(fs.readFileSync(failedFile, 'utf8'));
        // 查找包含该文章编号的记录
        for (const entry of failed) {
            if (entry.articlePath && entry.articlePath.includes(`article_${articleNum}`)) {
                return entry.url;
            }
        }
    } catch (e) {
        console.error(`读取失败文章记录出错: ${e.message}`);
    }
    
    return null;
}

// 主函数
async function main() {
    console.log('🔍 扫描损坏的文章...\n');
    
    const corrupted = scanCorruptedArticles();
    
    if (corrupted.length === 0) {
        console.log('✅ 没有发现损坏的文章！');
        return;
    }
    
    console.log(`❌ 发现 ${corrupted.length} 篇损坏的文章：\n`);
    
    for (const article of corrupted) {
        console.log(`📄 ${article.date}/${article.file}`);
        console.log(`   内容: "${article.content.substring(0, 50)}..."`);
        
        // 尝试查找原始URL
        const originalUrl = findOriginalUrl(article.articleNum, article.date);
        if (originalUrl) {
            console.log(`   原始URL: ${originalUrl}`);
            
            // 创建URL文件供批处理使用
            const urlFile = `fix_article_${article.articleNum}.txt`;
            fs.writeFileSync(urlFile, originalUrl + '\n', 'utf8');
            console.log(`   ✅ 已创建修复文件: ${urlFile}`);
        } else {
            console.log(`   ⚠️ 未找到原始URL`);
        }
        
        console.log('');
    }
    
    console.log('\n💡 修复建议：');
    console.log('1. 使用批处理器重新处理这些URL文件：');
    console.log('   node batch_process_articles.js fix_article_*.txt\n');
    console.log('2. 或者手动删除损坏的文章，让系统重新抓取');
}

// 执行主函数
main().catch(console.error);