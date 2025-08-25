#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function checkUnprocessedArticles() {
    console.log('📊 检查未处理文章状态...\n');
    
    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('golf_content', today);
    
    console.log(`📅 今日日期: ${today}`);
    
    // 检查今天的目录
    if (!fs.existsSync(todayDir)) {
        console.log('❌ 今天还没有处理任何文章');
        return;
    }
    
    // 读取已处理的URL
    const urlsFile = path.join(todayDir, 'article_urls.json');
    const processedUrls = fs.existsSync(urlsFile) 
        ? JSON.parse(fs.readFileSync(urlsFile, 'utf8'))
        : {};
    
    console.log(`\n✅ 已处理文章: ${Object.keys(processedUrls).length} 篇`);
    
    // 按网站分组
    const byWebsite = {};
    for (const [num, url] of Object.entries(processedUrls)) {
        let site = 'Unknown';
        if (url.includes('golf.com')) site = 'Golf.com';
        else if (url.includes('golfmonthly.com')) site = 'Golf Monthly';
        else if (url.includes('mygolfspy.com')) site = 'MyGolfSpy';
        else if (url.includes('golfwrx.com')) site = 'GolfWRX';
        
        if (!byWebsite[site]) byWebsite[site] = [];
        byWebsite[site].push({ num, url });
    }
    
    // 显示每个网站的统计
    console.log('\n📈 按网站统计:');
    for (const [site, articles] of Object.entries(byWebsite)) {
        console.log(`\n${site}: ${articles.length} 篇`);
        articles.forEach(({ num, url }) => {
            const mdFile = path.join(todayDir, 'wechat_ready', `wechat_article_${num}.md`);
            const exists = fs.existsSync(mdFile);
            const status = exists ? '✅' : '❌';
            console.log(`  ${status} #${num}: ${url.substring(0, 80)}...`);
        });
    }
    
    // 检查正在处理的文章
    console.log('\n⏳ 检查正在处理的文章...');
    const wechatDir = path.join(todayDir, 'wechat_ready');
    if (fs.existsSync(wechatDir)) {
        const files = fs.readdirSync(wechatDir)
            .filter(f => f.match(/wechat_article_(\d+)\.md/))
            .sort((a, b) => {
                const numA = parseInt(a.match(/(\d+)/)[1]);
                const numB = parseInt(b.match(/(\d+)/)[1]);
                return numA - numB;
            });
        
        console.log(`\n📁 文章文件总数: ${files.length}`);
        console.log(`🔢 编号范围: ${files[0]} - ${files[files.length - 1]}`);
    }
    
    // 显示最近的文章
    console.log('\n📰 最近处理的5篇文章:');
    const recentArticles = Object.entries(processedUrls)
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
        .slice(0, 5);
    
    recentArticles.forEach(([num, url]) => {
        console.log(`  #${num}: ${url}`);
    });
}

checkUnprocessedArticles();