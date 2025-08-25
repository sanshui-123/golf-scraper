#!/usr/bin/env node

// 🔍 完整URL处理流程测试 - 模拟batch_process_articles.js的完整逻辑
const fs = require('fs');
const path = require('path');
const { checkGlobalDuplicate } = require('./check_global_duplicates');

async function testCompleteUrlFlow() {
    console.log('🔍 完整URL处理流程测试');
    console.log('模拟 batch_process_articles.js 的完整逻辑\n');
    
    // 1. 读取所有URL文件（模拟多文件处理）
    const urlFiles = ['deep_urls_golf_com.txt', 'deep_urls_golfmonthly_com.txt', 'deep_urls_mygolfspy_com.txt', 'deep_urls_www_golfdigest_com.txt', 'deep_urls_www_golfwrx_com.txt'];
    
    let allUrls = [];
    console.log('1️⃣ 读取URL文件:');
    for (const filename of urlFiles) {
        try {
            const content = fs.readFileSync(filename, 'utf8');
            const urls = content.split('\n').filter(url => url.trim());
            allUrls = allUrls.concat(urls);
            console.log(`   📋 ${filename}: ${urls.length} URLs`);
        } catch (error) {
            console.error(`   ❌ ${filename}: 读取失败`);
        }
    }
    console.log(`   🎯 总计: ${allUrls.length} URLs\n`);
    
    // 2. 模拟智能状态检查（这里我们已知都会通过）
    console.log('2️⃣ 智能状态检查: 所有URL都会通过（fresh URL标记生效）\n');
    const newUrls = allUrls; // 假设所有URL都通过状态检查
    
    // 3. 模拟处理循环中的getOrAssignArticleNumber逻辑
    console.log('3️⃣ 文章编号分配和过滤:');
    const finalUrls = [];
    const skippedUrls = [];
    const todayDate = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < newUrls.length; i++) {
        const url = newUrls[i];
        const site = url.includes('golf.com') ? 'Golf.com' :
                    url.includes('golfmonthly.com') ? 'Golf Monthly' :
                    url.includes('mygolfspy.com') ? 'MyGolfSpy' :
                    url.includes('golfdigest.com') ? 'Golf Digest' :
                    url.includes('golfwrx.com') ? 'GolfWRX' : 'Unknown';
        
        console.log(`\n   📝 ${i + 1}/${newUrls.length} - ${site}`);
        console.log(`      ${url.substring(0, 60)}...`);
        
        // 模拟getOrAssignArticleNumber逻辑中的全局去重检查
        const globalCheck = checkGlobalDuplicate(url);
        
        if (globalCheck && globalCheck.hasContent && globalCheck.date !== todayDate) {
            console.log(`      🚨 被全局去重跳过: ${globalCheck.date}/文章${globalCheck.articleNum}`);
            skippedUrls.push({ url, reason: 'global_duplicate', site, info: globalCheck });
        } else {
            console.log(`      ✅ 将处理`);
            finalUrls.push({ url, site });
        }
    }
    
    // 4. 统计最终结果
    console.log(`\n📊 最终处理统计:`);
    console.log(`   ✅ 将处理: ${finalUrls.length} URLs`);
    console.log(`   🚨 被跳过: ${skippedUrls.length} URLs`);
    
    // 按网站分组显示
    const siteStats = {};
    finalUrls.forEach(item => {
        siteStats[item.site] = (siteStats[item.site] || 0) + 1;
    });
    
    const skippedStats = {};
    skippedUrls.forEach(item => {
        skippedStats[item.site] = (skippedStats[item.site] || 0) + 1;
    });
    
    console.log(`\n📊 按网站分布:`);
    ['Golf.com', 'Golf Monthly', 'MyGolfSpy', 'Golf Digest', 'GolfWRX'].forEach(site => {
        const processed = siteStats[site] || 0;
        const skipped = skippedStats[site] || 0;
        const total = processed + skipped;
        console.log(`   ${site}: ${processed}/${total} 将处理 (${skipped} 被跳过)`);
    });
    
    // 5. 分析跳过原因
    if (skippedUrls.length > 0) {
        console.log(`\n🔍 跳过原因分析:`);
        skippedUrls.forEach(item => {
            console.log(`   🚨 ${item.site}: ${item.reason} - ${item.info.date}/文章${item.info.articleNum}`);
        });
    }
    
    // 6. 验证是否符合预期
    console.log(`\n🔍 预期vs实际分析:`);
    if (finalUrls.length === 11) {
        console.log(`   ⚠️  实际处理${finalUrls.length}个URL，符合用户反馈的"只处理11个Golf.com文章"`);
        const golfComCount = siteStats['Golf.com'] || 0;
        if (golfComCount === 11) {
            console.log(`   ✅ 确认：只有${golfComCount}个Golf.com文章被处理`);
        }
    } else {
        console.log(`   ❓ 实际处理${finalUrls.length}个URL，不符合用户反馈`);
    }
}

testCompleteUrlFlow().catch(console.error);