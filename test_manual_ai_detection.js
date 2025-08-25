#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const EnhancedAIContentDetector = require('./ai_content_detector_enhanced');

async function testManualAIDetection() {
    const articlePath = path.join(__dirname, 'golf_content/2025-08-18/wechat_ready/wechat_article_10259.md');
    
    try {
        // 读取文章内容
        console.log('📖 读取文章内容...');
        let content = await fs.readFile(articlePath, 'utf-8');
        
        // 检查是否已有AI检测结果
        const aiDetectionRegex = /^<!-- AI检测: (\d+(?:\.\d+)?)% \| 检测时间: .+ -->/;
        const hasAIDetection = aiDetectionRegex.test(content);
        
        if (hasAIDetection) {
            console.log('✅ 文章已有AI检测结果');
            return;
        }
        
        console.log('⚠️ 文章缺少AI检测结果，执行手动检测...');
        
        // 初始化AI检测器
        const detector = new EnhancedAIContentDetector();
        await detector.initialize();
        detector.setDetectionMode('proxy');
        
        // 提取纯文本内容（去除标题和图片）
        let textContent = content.replace(/^#.*$/gm, ''); // 移除标题
        textContent = textContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, ''); // 移除图片
        textContent = textContent.replace(/\*\*(.*?)\*\*/g, '$1'); // 移除加粗
        textContent = textContent.trim();
        
        console.log('📝 文本长度:', textContent.length);
        console.log('🔍 开始AI检测...');
        
        // 执行AI检测
        const aiProbability = await detector.detectText(textContent);
        
        if (aiProbability !== null) {
            console.log(`✅ AI检测完成: ${aiProbability}%`);
            
            // 添加AI检测结果到文件开头
            const detectionComment = `<!-- AI检测: ${aiProbability}% | 检测时间: ${new Date().toISOString().split('T')[0]} -->\n\n`;
            content = detectionComment + content;
            
            // 保存更新后的文件
            await fs.writeFile(articlePath, content, 'utf-8');
            console.log('💾 文件已更新');
        } else {
            console.log('❌ AI检测失败');
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

// 运行测试
testManualAIDetection();