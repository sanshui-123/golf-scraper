#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function verifyDetection() {
    console.log('🔬 验证AI检测差异\n');
    
    // 选择一篇文章进行测试
    const testFile = path.join(__dirname, 'golf_content/2025-08-16/wechat_ready/wechat_article_10086.md');
    
    if (!fs.existsSync(testFile)) {
        console.log('❌ 测试文件不存在');
        return;
    }
    
    // 读取文件内容
    const content = fs.readFileSync(testFile, 'utf8');
    
    // 移除AI检测注释
    const rawContent = content.replace(/^<!-- AI检测:.*?-->\n/g, '');
    
    // 模拟系统的文本预处理
    let processedContent = rawContent;
    processedContent = processedContent.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
    processedContent = processedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    console.log('📄 测试文件: wechat_article_10086.md');
    console.log('━'.repeat(60));
    console.log(`原始内容长度: ${rawContent.length} 字符`);
    console.log(`处理后内容长度: ${processedContent.length} 字符`);
    console.log(`移除内容: ${rawContent.length - processedContent.length} 字符 (${((rawContent.length - processedContent.length) / rawContent.length * 100).toFixed(2)}%)\n`);
    
    // 保存两个版本供手动测试
    const testDir = path.join(__dirname, 'ai_detection_test');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
    }
    
    fs.writeFileSync(path.join(testDir, 'original_content.txt'), rawContent, 'utf8');
    fs.writeFileSync(path.join(testDir, 'processed_content.txt'), processedContent, 'utf8');
    
    console.log('💾 已保存测试文件：');
    console.log('   - ai_detection_test/original_content.txt (原始内容，包含链接格式)');
    console.log('   - ai_detection_test/processed_content.txt (处理后内容，用于AI检测)\n');
    
    console.log('📋 测试步骤：');
    console.log('1. 分别复制两个文件的内容');
    console.log('2. 粘贴到 https://matrix.tencent.com/ai-detect/');
    console.log('3. 比较两个结果的差异');
    console.log('\n预期结果：processed_content.txt 的检测结果应该与系统自动检测结果一致');
    
    // 尝试使用真实的AI检测器进行验证（如果可用）
    try {
        console.log('\n🤖 尝试进行实际AI检测...');
        const detector = new EnhancedAIContentDetector();
        await detector.initialize();
        detector.setDetectionMode('proxy');
        
        const result = await detector.detectText(processedContent);
        if (result !== null) {
            console.log(`✅ 系统AI检测结果: ${result}%`);
            
            // 查找文件中记录的AI检测结果
            const aiMatch = content.match(/<!-- AI检测:\s*(\d+)%/);
            if (aiMatch) {
                console.log(`📝 文件记录的结果: ${aiMatch[1]}%`);
                if (result == aiMatch[1]) {
                    console.log('✅ 结果一致！');
                } else {
                    console.log('⚠️  结果不一致，可能是因为重新检测或文本处理差异');
                }
            }
        } else {
            console.log('⚠️  AI检测失败（可能是代理问题）');
        }
        
        await detector.close();
    } catch (error) {
        console.log(`⚠️  无法执行实际检测: ${error.message}`);
    }
}

// 执行验证
verifyDetection().catch(console.error);