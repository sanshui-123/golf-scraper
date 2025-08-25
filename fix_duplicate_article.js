#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 检查并修复重复文章...\n');

// 要检查的重复文章
const duplicateArticles = [
    {
        date1: '2025-07-21',
        article1: '30',
        date2: '2025-07-22', 
        article2: '24',
        url: 'https://mygolfspy.com/news-opinion/only-one-club-changed-in-scotties-bag-this-week/'
    }
];

duplicateArticles.forEach(dup => {
    console.log(`📋 检查重复: ${dup.date1}/文章${dup.article1} vs ${dup.date2}/文章${dup.article2}`);
    console.log(`   URL: ${dup.url}`);
    
    // 检查两个文章是否确实存在
    const path1 = path.join('golf_content', dup.date1, 'wechat_html', `wechat_article_${dup.article1}.html`);
    const path2 = path.join('golf_content', dup.date2, 'wechat_html', `wechat_article_${dup.article2}.html`);
    
    const exists1 = fs.existsSync(path1);
    const exists2 = fs.existsSync(path2);
    
    console.log(`   ${dup.date1}/文章${dup.article1}: ${exists1 ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   ${dup.date2}/文章${dup.article2}: ${exists2 ? '✅ 存在' : '❌ 不存在'}`);
    
    if (exists1 && exists2) {
        console.log('\n   ⚠️  确认是重复文章，建议删除较新的文章（保留较早的）');
        
        // 读取两个文章的内容摘要
        const content1 = fs.readFileSync(path1, 'utf8');
        const content2 = fs.readFileSync(path2, 'utf8');
        
        // 提取标题
        const title1Match = content1.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const title2Match = content2.match(/<h1[^>]*>([^<]+)<\/h1>/);
        
        console.log(`   ${dup.date1} 标题: ${title1Match ? title1Match[1] : '未找到标题'}`);
        console.log(`   ${dup.date2} 标题: ${title2Match ? title2Match[1] : '未找到标题'}`);
        
        // 删除较新的文章（7月22日的）
        console.log(`\n   🗑️  删除重复文章: ${dup.date2}/文章${dup.article2}`);
        
        // 删除HTML文件
        fs.unlinkSync(path2);
        console.log(`   ✅ 已删除: ${path2}`);
        
        // 删除MD文件
        const mdPath = path.join('golf_content', dup.date2, 'wechat_ready', `wechat_article_${dup.article2}.md`);
        if (fs.existsSync(mdPath)) {
            fs.unlinkSync(mdPath);
            console.log(`   ✅ 已删除: ${mdPath}`);
        }
        
        // 删除图片文件
        const imageDir = path.join('golf_content', dup.date2, 'images');
        if (fs.existsSync(imageDir)) {
            const imagesToDelete = fs.readdirSync(imageDir)
                .filter(file => file.includes(`_${dup.article2}_`));
            
            imagesToDelete.forEach(img => {
                const imgPath = path.join(imageDir, img);
                fs.unlinkSync(imgPath);
                console.log(`   ✅ 已删除图片: ${img}`);
            });
        }
        
        // 更新article_urls.json
        const urlsJsonPath = path.join('golf_content', dup.date2, 'article_urls.json');
        if (fs.existsSync(urlsJsonPath)) {
            const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
            if (urlMapping[dup.article2]) {
                delete urlMapping[dup.article2];
                fs.writeFileSync(urlsJsonPath, JSON.stringify(urlMapping, null, 2));
                console.log(`   ✅ 已更新article_urls.json`);
            }
        }
        
        console.log(`\n   ✅ 重复文章处理完成！`);
    }
});

console.log('\n🎉 所有重复文章检查完成！');

// 建议
console.log('\n💡 建议:');
console.log('1. 重启Web服务器以更新缓存');
console.log('2. 运行 node check_processing_status.js 确认状态');
console.log('3. 未来处理文章时，确保Web服务器始终运行以避免重复');