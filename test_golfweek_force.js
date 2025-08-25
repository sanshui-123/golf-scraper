#!/usr/bin/env node

/**
 * 强制测试Golfweek图片抓取（跳过重复检查）
 */

const fs = require('fs');
const { spawn } = require('child_process');

async function testGolfweekForce() {
    console.log('🧪 强制测试Golfweek图片抓取功能');
    console.log('='.repeat(60));
    
    // 使用已知的Golfweek文章URL
    const testUrl = 'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/11/bmw-championship-2025-streaming-tv-channel-where-to-watch/85610872007/';
    const tempFile = 'temp_force_golfweek.txt';
    
    fs.writeFileSync(tempFile, testUrl + '\n');
    console.log(`📝 创建测试文件: ${tempFile}`);
    console.log(`🔗 测试URL: ${testUrl}`);
    console.log(`\n📌 强制重新处理，跳过重复检查\n`);
    
    // 获取当前最大文章编号
    const todayDir = `golf_content/${new Date().toISOString().split('T')[0]}`;
    const articles = fs.readdirSync(`${todayDir}/wechat_ready/`)
        .filter(f => f.endsWith('.md'))
        .map(f => parseInt(f.match(/article_(\d+)\.md/)?.[1] || '0'));
    const maxNum = Math.max(...articles);
    
    console.log(`📊 当前最大文章编号: ${maxNum}`);
    
    try {
        // 创建一个临时的批处理脚本，强制处理
        const forceScript = `
const BatchProcessor = require('./batch_process_articles');
const processor = new BatchProcessor();

// 直接处理URL，跳过重复检查
(async () => {
    const url = '${testUrl}';
    console.log('🔧 强制处理Golfweek文章...');
    
    const page = await processor.browser.newPage();
    try {
        await processor.processArticle(url, page);
        console.log('✅ 处理完成');
    } catch (error) {
        console.error('❌ 处理失败:', error);
    } finally {
        await page.close();
        await processor.browser.close();
    }
})();
        `;
        
        fs.writeFileSync('temp_force_processor.js', forceScript);
        
        // 运行强制处理脚本
        const child = spawn('node', ['temp_force_processor.js'], {
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
        
        console.log('\n✅ 强制处理完成！');
        
        // 检查新文章
        const newArticles = fs.readdirSync(`${todayDir}/wechat_ready/`)
            .filter(f => f.endsWith('.md'))
            .map(f => {
                const num = parseInt(f.match(/article_(\d+)\.md/)?.[1] || '0');
                return { file: f, num };
            })
            .filter(a => a.num > maxNum)
            .sort((a, b) => b.num - a.num);
        
        if (newArticles.length > 0) {
            const latestArticle = newArticles[0];
            console.log(`\n📄 新处理的文章: ${latestArticle.file}`);
            
            // 检查该文章的图片
            const images = fs.readdirSync(`${todayDir}/images/`)
                .filter(f => f.includes(`article_${latestArticle.num}_`));
            
            console.log(`\n📸 文章 ${latestArticle.num} 的图片数量: ${images.length} 个`);
            if (images.length > 0) {
                console.log('✅ 成功！修复后的代码能够抓取Golfweek图片');
                console.log('\n图片列表:');
                images.forEach(img => console.log(`  - ${img}`));
            } else {
                console.log('❌ 失败！仍然没有抓取到图片');
                
                // 检查处理日志
                const logFiles = fs.readdirSync('.')
                    .filter(f => f.endsWith('.log'))
                    .sort((a, b) => {
                        const statA = fs.statSync(a);
                        const statB = fs.statSync(b);
                        return statB.mtime - statA.mtime;
                    });
                
                if (logFiles.length > 0) {
                    console.log(`\n📋 最新日志文件: ${logFiles[0]}`);
                    const logContent = fs.readFileSync(logFiles[0], 'utf-8');
                    const specialHandlerMatch = logContent.match(/使用.*专用抓取器/);
                    if (specialHandlerMatch) {
                        console.log('✅ 日志显示使用了专用抓取器');
                    } else {
                        console.log('⚠️ 日志中未找到专用抓取器的使用记录');
                    }
                }
            }
        } else {
            console.log('\n⚠️ 没有新文章被处理');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        // 清理临时文件
        ['temp_force_golfweek.txt', 'temp_force_processor.js'].forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`🧹 清理临时文件: ${file}`);
            }
        });
    }
}

// 运行测试
testGolfweekForce();