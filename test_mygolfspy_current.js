#!/usr/bin/env node

const { chromium } = require('playwright');
const BatchArticleProcessor = require('./batch_process_articles');

async function testMyGolfSpy() {
    console.log('🧪 测试MyGolfSpy文章处理功能...\n');
    
    // 使用一个新的MyGolfSpy文章URL进行测试
    const testUrl = 'https://mygolfspy.com/news-opinion/taylormade-pens-5-year-deal-with-nick-dunlap/';
    
    const processor = new BatchArticleProcessor();
    
    try {
        console.log('📝 测试文章:', testUrl);
        
        // 处理单篇文章
        const results = await processor.processArticles([testUrl]);
        
        if (results.length > 0 && results[0].success) {
            console.log('\n✅ MyGolfSpy文章处理成功！');
            console.log('📄 生成文件:', results[0].htmlFile);
            console.log('🖼️ 下载图片数量:', results[0].images?.length || 0);
            console.log('⏱️ 处理时间:', results[0].processingTime);
        } else {
            console.log('\n❌ MyGolfSpy文章处理失败');
            if (results[0]?.error) {
                console.log('错误信息:', results[0].error);
            }
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        await processor.cleanup();
    }
}

// 运行测试
testMyGolfSpy().catch(console.error);