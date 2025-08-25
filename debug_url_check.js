#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Copy the isSameUrl function from web_server.js
function isSameUrl(url1, url2) {
    try {
        if (!url1 || !url2) return false;
        url1 = url1.trim().toLowerCase();
        url2 = url2.trim().toLowerCase();
        const normalize = (url) => {
            try {
                const parsed = new URL(url);
                parsed.hash = '';
                let normalized = parsed.toString();
                normalized = normalized.replace(/\/+$/, '');
                normalized = normalized.replace(/^https?:\/\//, '');
                normalized = normalized.replace(/^www\./, '');
                return normalized;
            } catch (e) {
                return url.replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
            }
        };
        const norm1 = normalize(url1);
        const norm2 = normalize(url2);
        return norm1 === norm2;
    } catch (error) {
        console.error('URL比较失败:', error);
        return false;
    }
}

const targetUrl = 'https://www.golfmonthly.com/tips/i-hit-60-putts-from-6ft-using-three-different-putting-grips-but-which-worked-best';
console.log('🔍 查找URL:', targetUrl);
console.log('');

const baseDir = 'golf_content';
const dateDirs = fs.readdirSync(baseDir)
    .filter(dir => {
        const fullPath = path.join(baseDir, dir);
        return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
    })
    .sort().reverse();

console.log(`📅 找到 ${dateDirs.length} 个日期目录`);

for (const dateDir of dateDirs) {
    const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
    
    if (fs.existsSync(urlsJsonPath)) {
        try {
            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
            
            // 检查是否有匹配的URL
            for (const [articleNum, recordedUrl] of Object.entries(urlMapping)) {
                if (isSameUrl(recordedUrl, targetUrl)) {
                    console.log(`\n✅ 在 ${dateDir}/article_urls.json 找到匹配！`);
                    console.log(`   文章编号: ${articleNum}`);
                    console.log(`   记录的URL: ${recordedUrl}`);
                    
                    // 检查对应的HTML文件是否存在
                    const htmlFile = `wechat_article_${articleNum}.html`;
                    const htmlPath = path.join(baseDir, dateDir, 'wechat_html', htmlFile);
                    
                    if (fs.existsSync(htmlPath)) {
                        console.log(`   ✅ HTML文件存在: ${htmlPath}`);
                    } else {
                        console.log(`   ❌ HTML文件不存在: ${htmlPath}`);
                    }
                }
            }
        } catch (e) {
            console.error(`❌ 读取 ${urlsJsonPath} 失败:`, e.message);
        }
    }
}

console.log('\n✅ 扫描完成');