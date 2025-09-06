#!/usr/bin/env node

/**
 * 紧急处理失败URL - 绕过所有检查直接处理
 * 用于解决批处理器缓存bug导致的失败URL无法处理问题
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
    console.log('🚨 紧急失败URL处理器');
    console.log('====================\n');
    
    // 1. 收集最近的失败URL（从failed_articles.json）
    const failedUrls = [];
    
    if (fs.existsSync('failed_articles.json')) {
        const failedArticles = JSON.parse(fs.readFileSync('failed_articles.json', 'utf8'));
        
        for (const [url, data] of Object.entries(failedArticles)) {
            if (data.status === 'pending_retry') {
                // 排除永久失败的
                if (!data.reason || !data.reason.includes('404') && !data.reason.includes('403')) {
                    failedUrls.push(url);
                }
            }
        }
    }
    
    console.log(`📊 找到 ${failedUrls.length} 个待重试的URL\n`);
    
    if (failedUrls.length === 0) {
        console.log('✅ 没有需要处理的URL');
        return;
    }
    
    // 2. 只处理前10个作为测试
    const testUrls = failedUrls.slice(0, 10);
    console.log('🧪 测试处理前10个URL:');
    testUrls.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
    });
    
    // 3. 创建临时文件并删除已存在的记录
    const tempFile = `emergency_urls_${Date.now()}.txt`;
    
    // 清理这些URL在article_urls.json中的记录
    console.log('\n🧹 清理失败记录...');
    for (const url of testUrls) {
        try {
            // 从所有日期目录的article_urls.json中删除这个URL
            const golfContentDir = 'golf_content';
            if (fs.existsSync(golfContentDir)) {
                const dateDirs = fs.readdirSync(golfContentDir)
                    .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir));
                
                for (const dateDir of dateDirs) {
                    const urlsJsonPath = path.join(golfContentDir, dateDir, 'article_urls.json');
                    if (fs.existsSync(urlsJsonPath)) {
                        const urlsData = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                        let modified = false;
                        
                        // 查找并删除包含此URL的记录
                        for (const [key, record] of Object.entries(urlsData)) {
                            const recordUrl = typeof record === 'string' ? record : record.url;
                            if (recordUrl === url) {
                                delete urlsData[key];
                                modified = true;
                                console.log(`   ✅ 从 ${dateDir} 删除了 ${url} 的失败记录`);
                            }
                        }
                        
                        if (modified) {
                            fs.writeFileSync(urlsJsonPath, JSON.stringify(urlsData, null, 2));
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`   ❌ 清理 ${url} 时出错:`, e.message);
        }
    }
    
    // 4. 写入临时文件
    fs.writeFileSync(tempFile, testUrls.join('\n'));
    console.log(`\n📄 创建临时文件: ${tempFile}`);
    
    // 5. 使用批处理器处理（现在缓存已经清理）
    console.log('\n🚀 开始处理...\n');
    
    try {
        execSync(`node batch_process_articles.js ${tempFile}`, {
            stdio: 'inherit'
        });
    } catch (e) {
        console.error('处理过程中出错:', e.message);
    }
    
    // 6. 清理临时文件
    try {
        fs.unlinkSync(tempFile);
    } catch (e) {}
    
    console.log('\n✅ 紧急处理完成！');
    console.log('\n💡 如果成功，可以继续处理剩余的URL');
}

main().catch(console.error);