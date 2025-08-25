#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 从web_server.js复制的相关函数
function extractSourceUrl(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const match = content.match(/原文链接：\s*<a[^>]*href=["']([^"']+)["'][^>]*>/);
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}

function isSameUrl(url1, url2) {
    try {
        const normalizeUrl = (url) => {
            if (!url || typeof url !== 'string') {
                return '';
            }
            return url
                .toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/$/, '')
                .replace(/\?.*$/, '')
                .replace(/#.*$/, '');
        };
        
        const normalized1 = normalizeUrl(url1);
        const normalized2 = normalizeUrl(url2);
        
        return normalized1 === normalized2;
    } catch (e) {
        return false;
    }
}

// 获取所有日期的文章URL
function getAllArticleUrls() {
    const allUrls = new Map(); // url -> {date, filename}
    const baseDir = 'golf_content';
    
    if (!fs.existsSync(baseDir)) {
        console.log('❌ golf_content目录不存在');
        return allUrls;
    }
    
    const dates = fs.readdirSync(baseDir)
        .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item));
    
    dates.forEach(date => {
        // 检查article_urls.json
        const urlsJsonPath = path.join(baseDir, date, 'article_urls.json');
        if (fs.existsSync(urlsJsonPath)) {
            try {
                const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                for (const [articleNum, record] of Object.entries(urlMapping)) {
                    if (record.url && record.status === 'completed') {
                        const normalizedUrl = record.url.toLowerCase()
                            .replace(/^https?:\/\//, '')
                            .replace(/^www\./, '')
                            .replace(/\/$/, '')
                            .replace(/\?.*$/, '')
                            .replace(/#.*$/, '');
                        
                        if (!allUrls.has(normalizedUrl)) {
                            allUrls.set(normalizedUrl, []);
                        }
                        allUrls.get(normalizedUrl).push({
                            date,
                            filename: `wechat_article_${articleNum}.html`,
                            originalUrl: record.url
                        });
                    }
                }
            } catch (e) {
                console.error(`读取 ${urlsJsonPath} 失败:`, e.message);
            }
        }
        
        // 检查HTML文件
        const htmlDir = path.join(baseDir, date, 'wechat_html');
        if (fs.existsSync(htmlDir)) {
            const htmlFiles = fs.readdirSync(htmlDir)
                .filter(file => file.endsWith('.html') && !file.includes('backup'));
                
            htmlFiles.forEach(file => {
                const filePath = path.join(htmlDir, file);
                const sourceUrl = extractSourceUrl(filePath);
                
                if (sourceUrl) {
                    const normalizedUrl = sourceUrl.toLowerCase()
                        .replace(/^https?:\/\//, '')
                        .replace(/^www\./, '')
                        .replace(/\/$/, '')
                        .replace(/\?.*$/, '')
                        .replace(/#.*$/, '');
                    
                    if (!allUrls.has(normalizedUrl)) {
                        allUrls.set(normalizedUrl, []);
                    }
                    
                    // 检查是否已经存在相同日期和文件名的记录
                    const existing = allUrls.get(normalizedUrl).find(
                        item => item.date === date && item.filename === file
                    );
                    
                    if (!existing) {
                        allUrls.get(normalizedUrl).push({
                            date,
                            filename: file,
                            originalUrl: sourceUrl
                        });
                    }
                }
            });
        }
    });
    
    return allUrls;
}

// 分析重复情况
console.log('🔍 开始分析文章重复情况...\n');

const allUrls = getAllArticleUrls();
const duplicates = [];
let totalArticles = 0;

// 找出重复的URL
allUrls.forEach((occurrences, normalizedUrl) => {
    totalArticles += occurrences.length;
    if (occurrences.length > 1) {
        duplicates.push({
            url: normalizedUrl,
            occurrences: occurrences
        });
    }
});

console.log(`📊 统计结果：`);
console.log(`   总文章数: ${totalArticles}`);
console.log(`   唯一URL数: ${allUrls.size}`);
console.log(`   重复URL数: ${duplicates.length}\n`);

if (duplicates.length > 0) {
    console.log('🔁 重复文章详情：\n');
    duplicates.forEach((dup, index) => {
        console.log(`${index + 1}. URL: ${dup.url}`);
        console.log(`   出现次数: ${dup.occurrences.length}`);
        dup.occurrences.forEach(occ => {
            console.log(`   - ${occ.date} / ${occ.filename}`);
            console.log(`     原始URL: ${occ.originalUrl}`);
        });
        console.log('');
    });
    
    // 显示今日重复的文章
    const today = '2025-08-12';
    const todayDuplicates = duplicates.filter(dup => 
        dup.occurrences.some(occ => occ.date === today)
    );
    
    if (todayDuplicates.length > 0) {
        console.log(`\n⚠️  今日(${today})的重复文章：`);
        todayDuplicates.forEach(dup => {
            const todayOcc = dup.occurrences.find(occ => occ.date === today);
            const otherOccs = dup.occurrences.filter(occ => occ.date !== today);
            
            console.log(`\n文件: ${todayOcc.filename}`);
            console.log(`URL: ${todayOcc.originalUrl}`);
            console.log(`已在以下日期处理过:`);
            otherOccs.forEach(occ => {
                console.log(`  - ${occ.date} / ${occ.filename}`);
            });
        });
    } else {
        console.log(`\n✅ 今日(${today})没有重复文章`);
    }
} else {
    console.log('✅ 没有发现重复文章');
}