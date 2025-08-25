#!/usr/bin/env node

/**
 * 检查未处理的Golf.com文章
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function checkUnprocessedGolf() {
    console.log('🔍 检查未处理的Golf.com文章');
    console.log('═'.repeat(60));
    
    try {
        // 读取发现的文章列表
        const allArticles = fs.readFileSync('golf_com_all_recent.txt', 'utf8')
            .split('\n')
            .filter(url => url.trim());
        
        console.log(`📋 总发现文章数: ${allArticles.length}`);
        
        // 获取已处理的文章URL
        const processedUrls = new Set();
        
        try {
            // 从HTML文件中提取已处理的URL
            const htmlFiles = execSync('find golf_content -name "*.html" -exec grep -l "golf.com" {} \\;')
                .toString()
                .split('\n')
                .filter(file => file.trim());
            
            console.log(`📁 找到 ${htmlFiles.length} 个包含golf.com的HTML文件`);
            
            htmlFiles.forEach(file => {
                try {
                    const content = fs.readFileSync(file, 'utf8');
                    const urlMatches = content.match(/https:\/\/golf\.com\/[^"'\s<>]+/g);
                    
                    if (urlMatches) {
                        urlMatches.forEach(url => {
                            // 清理URL，移除可能的HTML标记
                            const cleanUrl = url.replace(/[<>"']/g, '');
                            if (cleanUrl.includes('/news/') || 
                                cleanUrl.includes('/instruction/') || 
                                cleanUrl.includes('/gear/') || 
                                cleanUrl.includes('/travel/')) {
                                processedUrls.add(cleanUrl);
                            }
                        });
                    }
                } catch (error) {
                    console.log(`⚠️  读取文件失败: ${file}`);
                }
            });
            
        } catch (error) {
            console.log('⚠️  无法获取已处理文章列表，将处理所有文章');
        }
        
        console.log(`✅ 已处理文章数: ${processedUrls.size}`);
        
        // 找出未处理的文章
        const unprocessedArticles = allArticles.filter(url => !processedUrls.has(url));
        
        console.log(`\n📊 处理状态统计:`);
        console.log(`  总文章数: ${allArticles.length}`);
        console.log(`  已处理: ${processedUrls.size}`);
        console.log(`  未处理: ${unprocessedArticles.length}`);
        
        if (processedUrls.size > 0) {
            console.log('\n✅ 已处理的文章:');
            let i = 1;
            processedUrls.forEach(url => {
                console.log(`  ${i}. ${url}`);
                i++;
            });
        }
        
        if (unprocessedArticles.length > 0) {
            console.log(`\n📝 需要处理的文章 (${unprocessedArticles.length}篇):`);
            unprocessedArticles.forEach((url, i) => {
                console.log(`  ${i + 1}. ${url}`);
            });
            
            // 保存未处理的文章列表
            const unprocessedFile = 'golf_com_unprocessed_remaining.txt';
            fs.writeFileSync(unprocessedFile, unprocessedArticles.join('\n'));
            console.log(`\n💾 未处理文章列表已保存到: ${unprocessedFile}`);
            
            console.log('\n🚀 运行以下命令处理这些文章:');
            console.log(`node batch_process_articles.js ${unprocessedFile}`);
            
            return unprocessedFile;
        } else {
            console.log('\n🎉 所有Golf.com文章都已处理完成！');
            return null;
        }
        
    } catch (error) {
        console.error('❌ 检查过程出错:', error.message);
        return null;
    }
}

// 运行检查
if (require.main === module) {
    checkUnprocessedGolf().catch(console.error);
}

module.exports = checkUnprocessedGolf;