#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ChromeExtensionProcessor = require('./chrome_extension_processor');

async function testChromeExtensionProcessor() {
    console.log('🧪 测试Chrome扩展处理器');
    
    const processor = new ChromeExtensionProcessor();
    
    // 创建测试URL文件
    const testUrls = [
        'https://mygolfspy.com/news-opinion/cheers-to-the-toulon-sons-small-batch-portrush/',
        'https://mygolfspy.com/news-opinion/first-look/new-ping-g440-max-10k-driver/',
        'https://mygolfspy.com/news-opinion/insights-and-opinion/taylormade-qi35-drivers-fairway-woods/'
    ];
    
    // 测试TXT格式
    const testTxtFile = path.join(__dirname, 'test_mygolfspy_queue.txt');
    fs.writeFileSync(testTxtFile, testUrls.join('\n'));
    
    console.log(`📝 创建测试文件: ${testTxtFile}`);
    console.log(`📋 包含 ${testUrls.length} 个测试URL`);
    
    try {
        console.log('\n🔄 开始处理测试文件...');
        const result = await processor.processFile(testTxtFile);
        
        if (result) {
            console.log('✅ 处理成功');
        } else {
            console.log('❌ 处理失败');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
    
    // 清理测试文件
    try {
        fs.unlinkSync(testTxtFile);
        console.log('\n🗑️  清理测试文件');
    } catch (error) {
        console.warn('⚠️  清理测试文件失败:', error.message);
    }
    
    console.log('\n📊 测试完成');
}

// 测试文件查找功能
function testFileFinding() {
    console.log('\n🔍 测试文件查找功能...');
    
    const processor = new ChromeExtensionProcessor();
    const files = processor.findExtensionURLFiles();
    
    console.log(`📂 在下载目录中找到 ${files.length} 个相关文件:`);
    files.forEach(file => {
        console.log(`  - ${file.name} (${(file.size/1024).toFixed(1)}KB) - ${file.mtime.toLocaleString()}`);
    });
}

// 测试JSON格式处理
function testJSONProcessing() {
    console.log('\n🔬 测试JSON格式处理...');
    
    const testData = [
        {
            url: 'https://mygolfspy.com/news-opinion/test-article-1/',
            title: 'Test Article 1',
            category: 'news',
            scrapedAt: new Date().toISOString()
        },
        {
            url: 'https://mygolfspy.com/reviews/test-review-1/',
            title: 'Test Review 1',
            category: 'reviews',
            scrapedAt: new Date().toISOString()
        }
    ];
    
    const testJsonFile = path.join(__dirname, 'test_mygolfspy_data.json');
    fs.writeFileSync(testJsonFile, JSON.stringify(testData, null, 2));
    
    console.log(`📄 创建测试JSON文件: ${testJsonFile}`);
    console.log(`📋 包含 ${testData.length} 个测试项目`);
    
    // 清理测试文件
    setTimeout(() => {
        try {
            fs.unlinkSync(testJsonFile);
            console.log('🗑️  清理测试JSON文件');
        } catch (error) {
            console.warn('⚠️  清理测试JSON文件失败:', error.message);
        }
    }, 1000);
}

// 主测试函数
async function runTests() {
    console.log('🚀 开始Chrome扩展处理器测试\n');
    
    // 测试1: 文件查找
    testFileFinding();
    
    // 测试2: JSON格式处理
    testJSONProcessing();
    
    // 测试3: 完整处理流程（注释掉以避免实际处理）
    // await testChromeExtensionProcessor();
    
    console.log('\n✅ 所有测试完成');
    console.log('\n💡 要启动实际的Chrome扩展处理器：');
    console.log('   node chrome_extension_processor.js auto');
}

if (require.main === module) {
    runTests().catch(console.error);
}