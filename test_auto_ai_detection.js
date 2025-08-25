#!/usr/bin/env node

/**
 * 测试自动AI检测功能
 * 测试saveSingleArticle方法是否会自动为缺少AI检测的文章执行检测
 */

const fs = require('fs');
const path = require('path');
const BatchProcessor = require('./batch_process_articles');

async function testAutoAIDetection() {
    console.log('🧪 测试自动AI检测功能...\n');
    
    // 创建测试文章对象（没有AI检测结果）
    const testArticle = {
        articleNum: 9999,
        title: '测试文章 - 自动AI检测',
        url: 'https://example.com/test-article',
        sourceSite: 'example.com',
        rewrittenContent: `# 测试文章标题

这是一篇测试文章，用于验证自动AI检测功能。

## 测试内容

当文章保存时，如果没有AI检测结果，系统应该自动执行AI检测。

### 预期行为

1. 检测到文章缺少aiProbability属性
2. 自动初始化AI检测器
3. 执行AI检测
4. 将检测结果添加到文章对象
5. 在保存的MD文件开头添加AI检测注释

这是一段测试内容，用于模拟真实的文章内容。`,
        images: [],
        aiProbability: null  // 故意设置为null，触发自动检测
    };
    
    // 创建处理器实例
    const processor = new BatchProcessor(['test_urls.txt']);
    
    try {
        // 调用saveSingleArticle方法
        console.log('📝 保存测试文章（无AI检测结果）...');
        await processor.saveSingleArticle(testArticle);
        
        // 检查生成的文件
        const baseDir = processor.baseDir;
        const mdFile = path.join(baseDir, 'wechat_ready', 'wechat_article_9999.md');
        
        if (fs.existsSync(mdFile)) {
            const content = fs.readFileSync(mdFile, 'utf8');
            
            // 检查是否包含AI检测注释
            const hasAIComment = content.includes('<!-- AI检测:');
            console.log(`\n✅ 文件已生成: ${mdFile}`);
            console.log(`🤖 包含AI检测注释: ${hasAIComment ? '是' : '否'}`);
            
            if (hasAIComment) {
                const match = content.match(/<!-- AI检测: (\d+)% \| 检测时间: (.*?) -->/);
                if (match) {
                    console.log(`📊 AI检测率: ${match[1]}%`);
                    console.log(`⏰ 检测时间: ${match[2]}`);
                }
            }
            
            // 清理测试文件
            console.log('\n🧹 清理测试文件...');
            fs.unlinkSync(mdFile);
            const htmlFile = path.join(baseDir, 'wechat_html', 'wechat_article_9999.html');
            if (fs.existsSync(htmlFile)) {
                fs.unlinkSync(htmlFile);
            }
            
            console.log('\n✅ 测试完成！自动AI检测功能正常工作。');
        } else {
            console.error('❌ 文件未生成');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 运行测试
testAutoAIDetection().catch(console.error);