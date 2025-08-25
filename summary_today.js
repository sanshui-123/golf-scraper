#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 获取今天的统计
function getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('./golf_content', today);
    
    if (!fs.existsSync(todayDir)) {
        console.log('今天还没有处理任何文章');
        return;
    }
    
    console.log(`📊 ${today} 处理统计\n`);
    
    // 读取文章URL
    const urlsFile = path.join(todayDir, 'article_urls.json');
    if (fs.existsSync(urlsFile)) {
        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        const urlList = Object.values(urls);
        
        // 按网站分组
        const byWebsite = {};
        urlList.forEach(url => {
            const domain = new URL(url).hostname.replace('www.', '');
            byWebsite[domain] = (byWebsite[domain] || 0) + 1;
        });
        
        console.log(`✅ 已处理文章总数: ${urlList.length} 篇\n`);
        console.log('📈 各网站分布:');
        Object.entries(byWebsite).sort((a, b) => b[1] - a[1]).forEach(([domain, count]) => {
            console.log(`   ${domain}: ${count} 篇`);
        });
        
        // 查看最新处理的文章
        const articleNums = Object.keys(urls).map(num => parseInt(num)).sort((a, b) => b - a);
        console.log(`\n📝 最新处理的文章编号: ${articleNums.slice(0, 5).join(', ')}`);
        
        // 检查HTML文件
        const htmlDir = path.join(todayDir, 'wechat_html');
        if (fs.existsSync(htmlDir)) {
            const htmlFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
            console.log(`\n📄 生成的HTML文件: ${htmlFiles.length} 个`);
        }
        
        // 检查图片
        const imageDir = path.join(todayDir, 'images');
        if (fs.existsSync(imageDir)) {
            const imageFiles = fs.readdirSync(imageDir);
            console.log(`🖼️  下载的图片: ${imageFiles.length} 张`);
        }
    }
    
    // 所有时间的统计
    console.log('\n' + '='.repeat(50));
    console.log('📊 所有时间统计\n');
    
    const allUrls = new Set();
    const allByWebsite = {};
    
    const dates = fs.readdirSync('./golf_content').filter(d => d.match(/^\d{4}-\d{2}-\d{2}$/));
    dates.forEach(date => {
        const urlsFile = path.join('./golf_content', date, 'article_urls.json');
        if (fs.existsSync(urlsFile)) {
            try {
                const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
                Object.values(urls).forEach(url => {
                    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
                    allUrls.add(cleanUrl);
                    const domain = new URL(url).hostname.replace('www.', '');
                    allByWebsite[domain] = (allByWebsite[domain] || 0) + 1;
                });
            } catch (e) {}
        }
    });
    
    console.log(`✅ 总处理文章数: ${allUrls.size} 篇`);
    console.log(`📅 处理天数: ${dates.length} 天\n`);
    
    console.log('📈 各网站总计:');
    Object.entries(allByWebsite).sort((a, b) => b[1] - a[1]).forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count} 篇`);
    });
}

// 执行
getTodaySummary();