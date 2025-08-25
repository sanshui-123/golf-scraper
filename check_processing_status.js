#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function checkProcessingStatus() {
    console.log('📊 检查文章处理状态...\n');
    
    const today = new Date().toISOString().split('T')[0];
    const todayDir = path.join('golf_content', today);
    const wechatDir = path.join(todayDir, 'wechat_ready');
    
    // 获取已处理的文章编号
    const processedNumbers = [];
    if (fs.existsSync(wechatDir)) {
        const files = fs.readdirSync(wechatDir)
            .filter(f => f.match(/wechat_article_(\d+)\.md/));
        
        files.forEach(file => {
            const match = file.match(/wechat_article_(\d+)\.md/);
            if (match) {
                processedNumbers.push(parseInt(match[1]));
            }
        });
    }
    
    processedNumbers.sort((a, b) => a - b);
    
    console.log(`✅ 已处理文章数: ${processedNumbers.length}`);
    console.log(`📝 文章编号: ${processedNumbers.join(', ')}`);
    
    // 查找缺失的编号
    const maxNum = Math.max(...processedNumbers);
    const missing = [];
    for (let i = 1; i <= maxNum; i++) {
        if (!processedNumbers.includes(i)) {
            missing.push(i);
        }
    }
    
    if (missing.length > 0) {
        console.log(`\n❌ 缺失的文章编号: ${missing.join(', ')}`);
    } else {
        console.log('\n✅ 所有编号都已处理完成！');
    }
    
    // 读取URL映射
    const urlsFile = path.join(todayDir, 'article_urls.json');
    if (fs.existsSync(urlsFile)) {
        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        
        console.log('\n📌 按网站统计:');
        const byWebsite = {
            'golf.com': 0,
            'golfmonthly.com': 0,
            'mygolfspy.com': 0,
            'golfwrx.com': 0
        };
        
        Object.values(urls).forEach(url => {
            for (const site of Object.keys(byWebsite)) {
                if (url.includes(site)) {
                    byWebsite[site]++;
                    break;
                }
            }
        });
        
        console.log(`  Golf.com: ${byWebsite['golf.com']} 篇`);
        console.log(`  Golf Monthly: ${byWebsite['golfmonthly.com']} 篇`);
        console.log(`  MyGolfSpy: ${byWebsite['mygolfspy.com']} 篇`);
        console.log(`  GolfWRX: ${byWebsite['golfwrx.com']} 篇`);
        
        // 显示最新的5篇文章
        console.log('\n📰 最新处理的文章:');
        const sortedEntries = Object.entries(urls)
            .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
            .slice(0, 5);
        
        sortedEntries.forEach(([num, url]) => {
            const domain = new URL(url).hostname;
            console.log(`  #${num} [${domain}]`);
            console.log(`    ${url}`);
        });
    }
}

checkProcessingStatus();