#!/usr/bin/env node

/**
 * 测试处理单个Golfweek文章，验证图片抓取
 */

const fs = require('fs');
const { spawn } = require('child_process');

async function testSingleGolfweek() {
    console.log('🧪 测试处理单个Golfweek文章');
    console.log('='.repeat(60));
    
    // 创建一个临时文件，只包含一个Golfweek URL
    const testUrl = 'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/11/bmw-championship-2025-streaming-tv-channel-where-to-watch/85610872007/';
    const tempFile = 'temp_single_golfweek.txt';
    
    fs.writeFileSync(tempFile, testUrl + '\n');
    console.log(`📝 创建测试文件: ${tempFile}`);
    console.log(`🔗 测试URL: ${testUrl}`);
    console.log(`\n📌 这是已处理过的文章1500，现在使用修复后的代码重新处理\n`);
    
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
        
        // 检查最新的文章
        const todayDir = `golf_content/${new Date().toISOString().split('T')[0]}`;
        const articles = fs.readdirSync(`${todayDir}/wechat_ready/`)
            .filter(f => f.endsWith('.md'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/article_(\d+)\.md/)?.[1] || '0');
                const numB = parseInt(b.match(/article_(\d+)\.md/)?.[1] || '0');
                return numB - numA;
            });
        
        if (articles.length > 0) {
            const latestArticle = articles[0];
            const articleNum = latestArticle.match(/article_(\d+)\.md/)?.[1];
            
            console.log(`\n📄 最新处理的文章: ${latestArticle}`);
            
            // 检查该文章的图片
            const images = fs.readdirSync(`${todayDir}/images/`)
                .filter(f => f.includes(`article_${articleNum}_`));
            
            console.log(`\n📸 文章 ${articleNum} 的图片数量: ${images.length} 个`);
            if (images.length > 0) {
                console.log('✅ 成功！修复后的代码能够抓取Golfweek图片');
                console.log('\n图片列表:');
                images.forEach(img => console.log(`  - ${img}`));
            } else {
                console.log('❌ 失败！仍然没有抓取到图片');
            }
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
testSingleGolfweek();