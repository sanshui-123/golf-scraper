/**
 * Golf Digest图片处理器测试脚本
 */

const GolfDigestImageProcessor = require('./golfdigest_image_processor');
const fs = require('fs');
const path = require('path');

async function testProcessor() {
    console.log('=== Golf Digest图片处理器测试 ===\n');
    
    const processor = new GolfDigestImageProcessor();
    
    // 测试图片URL
    const testImages = [
        // CDN图片
        'https://media.golfdigest.com/photos/5c8f0d0c20a59b0001db4324/master/w_768,c_limit/GettyImages-1126094686.jpg',
        // 可能的403图片
        'https://www.golfdigest.com/content/dam/images/golfdigest/fullset/2025/1/tiger-woods-jupiter-links.jpg',
        // 相对URL
        '/content/dam/images/golfdigest/fullset/2025/1/test-image.jpg',
        // 无效URL（测试错误处理）
        'https://invalid-domain-12345.com/image.jpg'
    ];
    
    // 创建测试目录
    const testDir = path.join(__dirname, 'test_images');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    console.log('测试功能特性:');
    console.log('✅ 智能重试机制（1秒、3秒、9秒）');
    console.log('✅ 错误分类和详细日志');
    console.log('✅ 动态User-Agent轮换');
    console.log('✅ CDN URL优化处理');
    console.log('✅ 下载成功率统计\n');
    
    // 测试批量下载
    console.log(`开始下载 ${testImages.length} 张测试图片...\n`);
    
    const results = await processor.downloadImages(
        testImages,
        testDir,
        'test_article',
        'https://www.golfdigest.com/test-article'
    );
    
    // 输出结果
    console.log('\n=== 测试结果 ===');
    results.forEach((result, index) => {
        console.log(`图片${index + 1}: ${result.success ? '✅ 成功' : '❌ 失败'} - ${path.basename(result.url)}`);
    });
    
    // 检查日志文件
    const logFile = path.join(__dirname, 'download_failures.log');
    if (fs.existsSync(logFile)) {
        console.log('\n✅ 失败日志文件已创建: download_failures.log');
        const logContent = fs.readFileSync(logFile, 'utf8');
        const logLines = logContent.trim().split('\n').filter(line => line);
        console.log(`   包含 ${logLines.length} 条失败记录`);
    }
    
    console.log('\n测试完成！');
}

// 运行测试
testProcessor().catch(console.error);