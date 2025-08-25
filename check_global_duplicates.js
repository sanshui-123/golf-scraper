#!/usr/bin/env node

// 全局去重检查工具 - 在处理失败文章前检查是否已在其他日期成功
const fs = require('fs');
const path = require('path');

/**
 * 检查URL是否在任何日期已经成功处理
 * @param {string} url - 要检查的URL
 * @returns {Object|null} 如果找到，返回 {date, articleNum, status}
 */
function checkGlobalDuplicate(url) {
    const golfContentDir = path.join(__dirname, 'golf_content');
    const results = [];
    
    // 扫描所有日期目录
    const dates = fs.readdirSync(golfContentDir)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
    
    for (const date of dates) {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (!fs.existsSync(urlsFile)) continue;
        
        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        
        // 检查每个条目
        for (const [num, value] of Object.entries(urls)) {
            let urlToCheck = typeof value === 'string' ? value : value.url;
            
            if (urlToCheck === url) {
                // 检查是否真的完成了（有md文件）
                const mdFile = path.join(golfContentDir, date, 'wechat_ready', `wechat_article_${num}.md`);
                const hasContent = fs.existsSync(mdFile);
                
                results.push({
                    date,
                    articleNum: num,
                    status: typeof value === 'object' ? value.status : (hasContent ? 'completed' : 'unknown'),
                    hasContent,
                    value
                });
            }
        }
    }
    
    // 返回成功处理的记录（优先返回有内容的）
    const successful = results.find(r => r.hasContent);
    return successful || results[0] || null;
}

/**
 * 批量检查失败文章的全局重复情况
 */
function checkFailedArticlesGlobally() {
    const golfContentDir = path.join(__dirname, 'golf_content');
    const duplicates = [];
    const genuinelyFailed = [];
    
    console.log('🔍 检查失败文章的全局重复情况...\n');
    
    // 收集所有失败的文章
    const dates = fs.readdirSync(golfContentDir)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
    
    for (const date of dates) {
        const urlsFile = path.join(golfContentDir, date, 'article_urls.json');
        if (!fs.existsSync(urlsFile)) continue;
        
        const urls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
        
        for (const [num, value] of Object.entries(urls)) {
            if (typeof value === 'object' && value.status === 'failed') {
                const duplicate = checkGlobalDuplicate(value.url);
                
                if (duplicate && duplicate.hasContent && duplicate.date !== date) {
                    duplicates.push({
                        failedDate: date,
                        failedNum: num,
                        successDate: duplicate.date,
                        successNum: duplicate.articleNum,
                        url: value.url
                    });
                } else {
                    genuinelyFailed.push({
                        date,
                        num,
                        url: value.url,
                        error: value.error
                    });
                }
            }
        }
    }
    
    // 输出报告
    console.log('📊 检查结果：\n');
    
    if (duplicates.length > 0) {
        console.log(`❌ 发现 ${duplicates.length} 篇重复处理的文章：\n`);
        duplicates.forEach(d => {
            console.log(`   📄 ${d.failedDate}/文章${d.failedNum} → 已在 ${d.successDate}/文章${d.successNum} 成功`);
            console.log(`      ${d.url}\n`);
        });
    }
    
    console.log(`✅ ${genuinelyFailed.length} 篇真正失败的文章需要重试\n`);
    
    return { duplicates, genuinelyFailed };
}

// 导出函数供其他模块使用
module.exports = { checkGlobalDuplicate, checkFailedArticlesGlobally };

// 如果直接运行此脚本
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // 批量检查模式
        const { duplicates, genuinelyFailed } = checkFailedArticlesGlobally();
        
        // 生成真正需要重试的URL列表
        if (genuinelyFailed.length > 0) {
            const retryFile = 'truly_failed_urls.txt';
            const urls = genuinelyFailed.map(f => f.url).join('\n');
            fs.writeFileSync(retryFile, urls);
            console.log(`💾 真正失败的URL已保存到: ${retryFile}`);
        }
    } else {
        // 单个URL检查模式
        const url = args[0];
        const result = checkGlobalDuplicate(url);
        
        if (result) {
            console.log('✅ 找到记录:');
            console.log(`   日期: ${result.date}`);
            console.log(`   编号: ${result.articleNum}`);
            console.log(`   状态: ${result.status}`);
            console.log(`   有内容: ${result.hasContent ? '是' : '否'}`);
        } else {
            console.log('❌ 未找到此URL的处理记录');
        }
    }
}