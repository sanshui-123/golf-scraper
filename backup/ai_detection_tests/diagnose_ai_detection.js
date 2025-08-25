#!/usr/bin/env node

/**
 * 诊断AI检测数据提取问题
 */

const fs = require('fs');
const path = require('path');

// 从web_server.js复制的extractAIDetection函数
function extractAIDetection(mdFilePath) {
    try {
        if (!fs.existsSync(mdFilePath)) {
            console.log('❌ 文件不存在:', mdFilePath);
            return null;
        }
        
        const content = fs.readFileSync(mdFilePath, 'utf8');
        console.log('\n📄 文件:', mdFilePath);
        console.log('📏 内容长度:', content.length);
        console.log('🔍 前100字符:', content.substring(0, 100));
        
        // 优先检查注释中的AI检测结果
        const commentMatch = content.match(/^<!-- AI检测:\s*(\d+(?:\.\d+)?%?)\s*\|\s*检测时间:\s*([^-]+?)\s*-->/);
        console.log('🔍 注释匹配结果:', commentMatch);
        
        if (commentMatch) {
            return {
                probability: commentMatch[1],
                time: commentMatch[2].trim()
            };
        }
        
        // 备用：检查YAML元数据中的AI检测结果
        const metadataMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (metadataMatch) {
            const metadata = metadataMatch[1];
            const aiMatch = metadata.match(/ai_detection:\s*"?(\d+(?:\.\d+)?%?)"?/);
            const timeMatch = metadata.match(/detection_time:\s*"?([^"\n]+)"?/);
            
            console.log('🔍 YAML匹配结果:', aiMatch);
            
            if (aiMatch) {
                return {
                    probability: aiMatch[1],
                    time: timeMatch ? timeMatch[1] : null
                };
            }
        }
        
        console.log('⚠️ 未找到AI检测数据');
        return null;
    } catch (e) {
        console.error('❌ 提取AI检测结果失败:', e.message);
        return null;
    }
}

// 测试函数
function testAIDetectionExtraction() {
    console.log('🔍 AI检测数据提取诊断\n');
    console.log('='.repeat(60));
    
    const today = '2025-08-16';
    const mdDir = path.join('golf_content', today, 'wechat_ready');
    const htmlDir = path.join('golf_content', today, 'wechat_html');
    
    // 获取所有HTML文件
    const htmlFiles = fs.readdirSync(htmlDir)
        .filter(f => f.endsWith('.html') && f.startsWith('wechat_article_'))
        .slice(0, 5); // 只测试前5个
    
    console.log(`\n📁 HTML目录: ${htmlDir}`);
    console.log(`📁 MD目录: ${mdDir}`);
    console.log(`📄 测试文件数: ${htmlFiles.length}\n`);
    
    const results = [];
    
    for (const htmlFile of htmlFiles) {
        console.log('='.repeat(60));
        console.log(`\n🔍 测试: ${htmlFile}`);
        
        // 构建对应的MD文件路径
        const mdFileName = htmlFile.replace('.html', '.md');
        const mdFilePath = path.join(mdDir, mdFileName);
        
        console.log('📄 对应MD文件:', mdFileName);
        console.log('📍 完整路径:', mdFilePath);
        
        // 测试提取
        const aiDetection = extractAIDetection(mdFilePath);
        
        if (aiDetection) {
            console.log('✅ 成功提取AI检测数据:');
            console.log('   - AI概率:', aiDetection.probability);
            console.log('   - 检测时间:', aiDetection.time);
            results.push({ file: htmlFile, success: true, data: aiDetection });
        } else {
            console.log('❌ 未能提取AI检测数据');
            results.push({ file: htmlFile, success: false });
        }
    }
    
    // 总结
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 诊断总结:');
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ 成功提取: ${successCount}/${results.length}`);
    console.log(`❌ 提取失败: ${results.length - successCount}/${results.length}`);
    
    // 检查具体的AI检测注释格式
    console.log('\n🔍 检查实际的AI检测注释格式:');
    const sampleFiles = fs.readdirSync(mdDir)
        .filter(f => f.endsWith('.md'))
        .slice(0, 3);
    
    for (const file of sampleFiles) {
        const filePath = path.join(mdDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const firstLine = content.split('\n')[0];
        console.log(`\n📄 ${file}:`);
        console.log(`   第一行: ${firstLine}`);
        
        if (firstLine.includes('AI检测:')) {
            // 尝试不同的正则表达式
            const patterns = [
                /^<!-- AI检测:\s*(\d+(?:\.\d+)?%?)\s*\|\s*检测时间:\s*([^-]+?)\s*-->/,
                /<!-- AI检测:\s*(\d+)%\s*\|\s*检测时间:\s*([\d\s:-]+)\s*-->/,
                /AI检测:\s*(\d+)%/
            ];
            
            console.log('   测试不同的正则表达式:');
            patterns.forEach((pattern, index) => {
                const match = firstLine.match(pattern);
                console.log(`   模式${index + 1}: ${match ? '✅ 匹配' : '❌ 不匹配'}`);
                if (match) {
                    console.log(`     - 匹配结果:`, match);
                }
            });
        }
    }
}

// 运行诊断
testAIDetectionExtraction();