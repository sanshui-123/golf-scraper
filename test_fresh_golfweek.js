#!/usr/bin/env node

/**
 * 使用全新的Golfweek URL测试图片抓取
 */

const fs = require('fs');
const { spawn } = require('child_process');

async function testFreshGolfweek() {
    console.log('🧪 测试处理全新的Golfweek文章');
    console.log('='.repeat(60));
    
    // 使用一个很可能是新的URL（带有独特参数）
    const testUrl = 'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/12/bmw-championship-test-article-fresh/99999999007/';
    const tempFile = 'temp_fresh_golfweek.txt';
    
    // 创建真实存在的文章URL（从deep_urls文件中取最后一个）
    const allUrls = fs.readFileSync('deep_urls_golfweek_usatoday_com.txt', 'utf-8')
        .split('\n')
        .filter(line => line.startsWith('https://'));
    
    // 使用最后一个URL（最不可能被处理过）
    const freshUrl = allUrls[allUrls.length - 1];
    
    fs.writeFileSync(tempFile, freshUrl + '\n');
    console.log(`📝 创建测试文件: ${tempFile}`);
    console.log(`🔗 测试URL: ${freshUrl}`);
    console.log(`\n📌 使用修复后的代码处理新的Golfweek文章\n`);
    
    // 记录处理前的文章数
    const todayDir = `golf_content/${new Date().toISOString().split('T')[0]}`;
    const beforeCount = fs.readdirSync(`${todayDir}/wechat_ready/`)
        .filter(f => f.endsWith('.md')).length;
    
    console.log(`⏰ 处理前文章数: ${beforeCount}`);
    
    try {
        // 运行批处理器
        const child = spawn('node', ['batch_process_articles.js', tempFile], {
            stdio: 'inherit'
        });
        
        await new Promise((resolve, reject) => {
            child.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Process exited with code ${code}`));
                }
            });
            child.on('error', reject);
        });
        
        console.log('\n✅ 处理完成！');
        
        // 检查处理后的文章数
        const afterCount = fs.readdirSync(`${todayDir}/wechat_ready/`)
            .filter(f => f.endsWith('.md')).length;
        
        console.log(`⏰ 处理后文章数: ${afterCount}`);
        
        if (afterCount > beforeCount) {
            // 找到新处理的文章
            const articles = fs.readdirSync(`${todayDir}/wechat_ready/`)
                .filter(f => f.endsWith('.md'))
                .sort((a, b) => {
                    const numA = parseInt(a.match(/article_(\d+)\.md/)?.[1] || '0');
                    const numB = parseInt(b.match(/article_(\d+)\.md/)?.[1] || '0');
                    return numB - numA;
                });
            
            const latestArticle = articles[0];
            const articleNum = latestArticle.match(/article_(\d+)\.md/)?.[1];
            
            console.log(`\n📄 新处理的文章: ${latestArticle}`);
            
            // 检查该文章的图片
            const images = fs.readdirSync(`${todayDir}/images/`)
                .filter(f => f.includes(`article_${articleNum}_`));
            
            console.log(`\n📸 文章 ${articleNum} 的图片数量: ${images.length} 个`);
            if (images.length > 0) {
                console.log('✅ 成功！修复后的代码能够抓取Golfweek图片');
                console.log('\n图片列表:');
                images.forEach(img => console.log(`  - ${img}`));
                
                // 读取文章内容查看是否使用了专用抓取器
                const articleContent = fs.readFileSync(`${todayDir}/wechat_ready/${latestArticle}`, 'utf-8');
                console.log('\n📖 文章预览（前200字符）:');
                console.log(articleContent.substring(0, 200) + '...');
            } else {
                console.log('❌ 失败！仍然没有抓取到图片');
                console.log('🔍 请检查处理日志确认是否使用了专用抓取器');
            }
        } else {
            console.log('\n⚠️ 没有新文章被处理，URL可能已经处理过了');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        // 清理临时文件
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            console.log(`\n🧹 清理临时文件: ${tempFile}`);
        }
    }
}

// 运行测试
testFreshGolfweek();