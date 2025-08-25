#!/usr/bin/env node

/**
 * 测试重新处理一个Golfweek文章，验证图片抓取修复
 */

const fs = require('fs');
const BatchProcessor = require('./batch_process_articles');

async function testReprocessGolfweek() {
    console.log('🧪 测试重新处理Golfweek文章');
    console.log('='.repeat(60));
    
    // 创建一个临时文件，只包含一个Golfweek URL
    const testUrl = 'https://golfweek.usatoday.com/story/sports/golf/pga/2025/08/11/bmw-championship-2025-streaming-tv-channel-where-to-watch/85610872007/';
    const tempFile = 'temp_golfweek_test.txt';
    
    fs.writeFileSync(tempFile, testUrl + '\n');
    console.log(`📝 创建测试文件: ${tempFile}`);
    console.log(`🔗 测试URL: ${testUrl}`);
    
    try {
        // 创建批处理器实例
        const processor = new BatchProcessor();
        
        // 强制重新处理（跳过重复检查）
        processor.forceReprocess = true;
        
        console.log('\n🚀 开始处理...\n');
        
        // 处理文件
        await processor.processFiles([tempFile]);
        
        console.log('\n✅ 处理完成！');
        
        // 检查结果
        const todayDir = `golf_content/${new Date().toISOString().split('T')[0]}`;
        const images = fs.readdirSync(`${todayDir}/images/`).filter(f => f.includes('article_'));
        
        console.log(`\n📸 找到的图片文件: ${images.length} 个`);
        if (images.length > 0) {
            console.log('图片列表:');
            images.forEach(img => console.log(`  - ${img}`));
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
testReprocessGolfweek();