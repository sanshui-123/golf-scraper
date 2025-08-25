#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 检查同一天内是否有相同URL被多次处理
function checkSameDayDuplicates(date) {
    console.log(`🔍 检查日期 ${date} 的文章重复情况...\n`);
    
    const articleUrlsPath = path.join('golf_content', date, 'article_urls.json');
    
    if (!fs.existsSync(articleUrlsPath)) {
        console.log(`❌ 找不到 ${articleUrlsPath}`);
        return;
    }
    
    // 读取article_urls.json
    const urlMapping = JSON.parse(fs.readFileSync(articleUrlsPath, 'utf8'));
    
    // 统计URL出现次数
    const urlCount = new Map();
    const articlesByUrl = new Map();
    
    for (const [articleNum, record] of Object.entries(urlMapping)) {
        if (!record.url) continue;
        
        const normalizedUrl = record.url.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .replace(/\?.*$/, '')
            .replace(/#.*$/, '');
        
        if (!urlCount.has(normalizedUrl)) {
            urlCount.set(normalizedUrl, 0);
            articlesByUrl.set(normalizedUrl, []);
        }
        
        urlCount.set(normalizedUrl, urlCount.get(normalizedUrl) + 1);
        articlesByUrl.get(normalizedUrl).push({
            articleNum,
            originalUrl: record.url,
            status: record.status
        });
    }
    
    // 找出重复的URL
    const duplicates = [];
    urlCount.forEach((count, url) => {
        if (count > 1) {
            duplicates.push({
                url,
                count,
                articles: articlesByUrl.get(url)
            });
        }
    });
    
    console.log(`📊 统计结果：`);
    console.log(`   总文章条目数: ${Object.keys(urlMapping).length}`);
    console.log(`   唯一URL数: ${urlCount.size}`);
    console.log(`   同日重复URL数: ${duplicates.length}\n`);
    
    if (duplicates.length > 0) {
        console.log('⚠️  同一天内的重复文章：\n');
        duplicates.forEach((dup, index) => {
            console.log(`${index + 1}. URL: ${dup.url}`);
            console.log(`   出现次数: ${dup.count}`);
            dup.articles.forEach(article => {
                console.log(`   - 文章编号: ${article.articleNum}`);
                console.log(`     状态: ${article.status}`);
                console.log(`     原始URL: ${article.originalUrl}`);
            });
            console.log('');
        });
    } else {
        console.log('✅ 当天没有重复处理的文章');
    }
    
    // 检查文件系统中的实际文件
    console.log('\n📁 检查文件系统中的实际文件...\n');
    
    const htmlDir = path.join('golf_content', date, 'wechat_html');
    const mdDir = path.join('golf_content', date, 'wechat_ready');
    
    const htmlFiles = fs.existsSync(htmlDir) ? fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')) : [];
    const mdFiles = fs.existsSync(mdDir) ? fs.readdirSync(mdDir).filter(f => f.endsWith('.md')) : [];
    
    console.log(`HTML文件数: ${htmlFiles.length}`);
    console.log(`Markdown文件数: ${mdFiles.length}`);
    
    // 检查文件编号是否有重复
    const htmlNumbers = htmlFiles.map(f => {
        const match = f.match(/wechat_article_(\d+)\.html/);
        return match ? match[1] : null;
    }).filter(n => n);
    
    const mdNumbers = mdFiles.map(f => {
        const match = f.match(/wechat_article_(\d+)\.md/);
        return match ? match[1] : null;
    }).filter(n => n);
    
    const duplicateHtml = htmlNumbers.filter((n, i) => htmlNumbers.indexOf(n) !== i);
    const duplicateMd = mdNumbers.filter((n, i) => mdNumbers.indexOf(n) !== i);
    
    if (duplicateHtml.length > 0) {
        console.log(`\n⚠️  重复的HTML文件编号: ${duplicateHtml.join(', ')}`);
    }
    
    if (duplicateMd.length > 0) {
        console.log(`\n⚠️  重复的Markdown文件编号: ${duplicateMd.join(', ')}`);
    }
    
    if (duplicateHtml.length === 0 && duplicateMd.length === 0) {
        console.log('\n✅ 文件编号没有重复');
    }
}

// 运行检查
const targetDate = process.argv[2] || '2025-08-12';
checkSameDayDuplicates(targetDate);