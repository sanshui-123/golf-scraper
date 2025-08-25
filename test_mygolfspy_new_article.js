#!/usr/bin/env node

/**
 * 测试新的MyGolfSpy文章
 */

const BatchArticleProcessor = require('./batch_process_articles');

async function testNewArticle() {
    console.log('🔍 测试新的MyGolfSpy文章');
    console.log('═'.repeat(60));
    
    // 使用新的MyGolfSpy文章URL
    const testUrls = [
        'https://mygolfspy.com/news-opinion/first-look/new-course-openings-were-excited-about-in-2025/'
    ];
    
    console.log('📋 测试URL:', testUrls[0]);
    
    const processor = new BatchArticleProcessor();
    
    try {
        console.log('\n⚙️  开始处理文章...');
        const results = await processor.processArticles(testUrls);
        
        if (results && results.length > 0) {
            const article = results[0];
            console.log('\n✅ 处理成功！');
            console.log('\n📊 文章信息:');
            console.log(`  标题: ${article.title}`);
            console.log(`  内容长度: ${article.content.length} 字符`);
            console.log(`  图片数量: ${article.images.length}`);
            
            if (article.images.length > 0) {
                console.log('\n📷 图片详情:');
                article.images.forEach((img, i) => {
                    console.log(`  ${i + 1}. ${img.filename || '未下载'} - ${img.downloaded ? '✅ 成功' : '❌ 失败'}`);
                });
            }
            
            // 显示内容预览
            console.log('\n📝 内容预览（前300字符）:');
            console.log(article.content.substring(0, 300) + '...');
        } else {
            console.log('\n❌ 处理失败');
        }
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

// 运行测试
testNewArticle().catch(console.error);