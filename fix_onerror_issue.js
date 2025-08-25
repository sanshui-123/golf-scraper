#!/usr/bin/env node
// fix_onerror_issue.js - 修复图片onerror误触发问题

const fs = require('fs');
const path = require('path');

class OnErrorFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.fixes = [];
    }

    async runFix() {
        console.log('🔧 修复图片onerror误触发问题...\n');
        
        try {
            // 1. 分析现有问题
            await this.analyzeOnErrorIssues();
            
            // 2. 修复有问题的onerror处理
            await this.fixOnErrorHandling();
            
            // 3. 生成测试页面验证修复效果
            await this.generateTestPage();
            
            this.generateReport();
            
        } catch (error) {
            console.error('❌ 修复过程中出现错误:', error.message);
        }
    }

    async analyzeOnErrorIssues() {
        console.log('🔍 分析onerror问题...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        if (!fs.existsSync(wechatHtmlDir)) {
            console.log('❌ HTML目录不存在');
            return;
        }
        
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        console.log(`📋 检查 ${htmlFiles.length} 个HTML文件`);
        
        let totalFiles = 0;
        let filesWithOnError = 0;
        let problemsFound = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            totalFiles++;
            
            // 检查是否有onerror处理
            const onErrorMatches = content.match(/onerror="[^"]*"/g) || [];
            
            if (onErrorMatches.length > 0) {
                filesWithOnError++;
                console.log(`📄 ${htmlFile}: 发现 ${onErrorMatches.length} 个onerror处理`);
                
                // 检查是否有问题的onerror处理
                const problematicOnes = onErrorMatches.filter(match => 
                    match.includes('innerHTML') || 
                    match.includes('图片加载失败')
                );
                
                if (problematicOnes.length > 0) {
                    problemsFound++;
                    console.log(`  ⚠️ 发现 ${problematicOnes.length} 个有问题的onerror处理`);
                    problematicOnes.forEach(problem => {
                        console.log(`    - ${problem.substring(0, 80)}...`);
                    });
                }
            }
        }
        
        console.log(`\n📊 分析结果:`);
        console.log(`  总文件数: ${totalFiles}`);
        console.log(`  有onerror的文件: ${filesWithOnError}`);
        console.log(`  有问题的文件: ${problemsFound}`);
    }

    async fixOnErrorHandling() {
        console.log('\n🔧 修复onerror处理...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        
        let fixedCount = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            let content = fs.readFileSync(htmlPath, 'utf8');
            const originalContent = content;
            
            // 方案1：完全移除有问题的onerror处理
            content = content.replace(/onerror="[^"]*innerHTML[^"]*"/g, '');
            
            // 方案2：替换为更好的错误处理
            content = content.replace(
                /onerror="[^"]*图片加载失败[^"]*"/g,
                'onerror="this.style.border=\'2px dashed #ccc\'; console.error(\'图片加载失败:\', this.src);"'
            );
            
            // 方案3：添加智能的图片加载处理（如果还没有）
            if (!content.includes('图片加载调试') && content.includes('<script>')) {
                const enhancedImageHandling = `
        // 智能图片加载处理
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🖼️ 初始化智能图片加载...');
            
            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
                let retryCount = 0;
                const maxRetries = 2;
                
                function handleImageLoad() {
                    console.log(\`✅ 图片 \${index + 1} 加载成功: \${img.alt || '未命名'}\`);
                    img.style.opacity = '1';
                    img.style.transition = 'opacity 0.3s ease';
                }
                
                function handleImageError() {
                    console.warn(\`⚠️ 图片 \${index + 1} 加载失败，重试次数: \${retryCount}/\${maxRetries}\`);
                    console.warn(\`   URL: \${img.src}\`);
                    
                    if (retryCount < maxRetries) {
                        retryCount++;
                        // 延迟重试
                        setTimeout(() => {
                            console.log(\`🔄 重试图片 \${index + 1}...\`);
                            const originalSrc = img.src;
                            img.src = '';
                            setTimeout(() => {
                                img.src = originalSrc + '?' + Date.now(); // 添加时间戳避免缓存
                            }, 100);
                        }, 1000 * retryCount);
                    } else {
                        console.error(\`❌ 图片 \${index + 1} 最终加载失败\`);
                        // 不破坏性地显示错误
                        img.style.border = '2px dashed #ddd';
                        img.style.opacity = '0.5';
                        img.alt = (img.alt || '图片') + ' (加载失败)';
                        
                        // 可选：添加一个小的错误提示，但不替换整个容器
                        if (!img.nextElementSibling || !img.nextElementSibling.classList.contains('error-notice')) {
                            const errorNotice = document.createElement('div');
                            errorNotice.className = 'error-notice';
                            errorNotice.style.cssText = 'font-size: 12px; color: #999; text-align: center; margin-top: 5px;';
                            errorNotice.textContent = '图片暂时无法显示';
                            img.parentNode.insertBefore(errorNotice, img.nextSibling);
                        }
                    }
                }
                
                // 移除原有的事件监听器
                img.onload = null;
                img.onerror = null;
                
                // 添加新的事件监听器
                img.addEventListener('load', handleImageLoad);
                img.addEventListener('error', handleImageError);
                
                // 如果图片已经加载完成
                if (img.complete) {
                    if (img.naturalWidth > 0) {
                        handleImageLoad();
                    } else {
                        handleImageError();
                    }
                }
            });
        });`;
                
                // 在现有script标签中添加增强处理
                content = content.replace(
                    /<script>/,
                    `<script>${enhancedImageHandling}`
                );
            }
            
            if (content !== originalContent) {
                // 备份原文件
                const backupPath = htmlPath + '.backup-' + Date.now();
                fs.writeFileSync(backupPath, originalContent, 'utf8');
                
                // 保存修复后的文件
                fs.writeFileSync(htmlPath, content, 'utf8');
                
                console.log(`  ✅ 修复完成: ${htmlFile}`);
                console.log(`  💾 备份文件: ${path.basename(backupPath)}`);
                this.fixes.push(`修复onerror处理: ${htmlFile}`);
                fixedCount++;
            }
        }
        
        console.log(`📊 修复完成: ${fixedCount}/${htmlFiles.length} 个文件`);
    }

    async generateTestPage() {
        console.log('\n🧪 生成测试页面...');
        
        const testPageContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>图片加载测试</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        .test-section {
            margin: 30px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        .image-container {
            margin: 20px 0;
            text-align: center;
        }
        .article-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            border-radius: 4px;
            font-size: 14px;
        }
        .success { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .error { background: #f8d7da; color: #721c24; }
        #console-output {
            background: #f8f9fa;
            border: 1px solid #ddd;
            padding: 15px;
            height: 200px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <h1>🧪 图片加载测试页面</h1>
    
    <div class="test-section">
        <h2>📊 测试结果统计</h2>
        <div id="test-stats">正在检测...</div>
    </div>
    
    <div class="test-section">
        <h2>🖼️ 图片加载测试</h2>
        
        <h3>测试1：正常图片</h3>
        <div class="image-container">
            <img src="/golf_content/${this.dateStr}/images/article_17_img_1.jpg" 
                 alt="测试图片1" class="article-image">
        </div>
        
        <h3>测试2：错误路径图片</h3>
        <div class="image-container">
            <img src="/golf_content/${this.dateStr}/images/nonexistent.jpg" 
                 alt="不存在的图片" class="article-image">
        </div>
        
        <h3>测试3：完全错误的URL</h3>
        <div class="image-container">
            <img src="/invalid/path/image.jpg" 
                 alt="无效路径图片" class="article-image">
        </div>
    </div>
    
    <div class="test-section">
        <h2>📝 控制台输出</h2>
        <div id="console-output"></div>
        <button onclick="clearConsole()">清空日志</button>
    </div>
    
    <script>
        let consoleOutput = document.getElementById('console-output');
        let originalLog = console.log;
        let originalError = console.error;
        let originalWarn = console.warn;
        
        function addToConsole(type, message) {
            const timestamp = new Date().toLocaleTimeString();
            const line = \`[\${timestamp}] \${type.toUpperCase()}: \${message}\\n\`;
            consoleOutput.textContent += line;
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
        
        console.log = function(...args) {
            originalLog.apply(console, args);
            addToConsole('log', args.join(' '));
        };
        
        console.error = function(...args) {
            originalError.apply(console, args);
            addToConsole('error', args.join(' '));
        };
        
        console.warn = function(...args) {
            originalWarn.apply(console, args);
            addToConsole('warn', args.join(' '));
        };
        
        function clearConsole() {
            consoleOutput.textContent = '';
        }
        
        // 图片加载统计
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🧪 开始图片加载测试...');
            
            const images = document.querySelectorAll('.article-image');
            let loadedCount = 0;
            let errorCount = 0;
            let totalCount = images.length;
            
            function updateStats() {
                const stats = document.getElementById('test-stats');
                stats.innerHTML = \`
                    <div class="status success">✅ 成功加载: \${loadedCount}/\${totalCount}</div>
                    <div class="status error">❌ 加载失败: \${errorCount}/\${totalCount}</div>
                    <div class="status warning">⏳ 等待中: \${totalCount - loadedCount - errorCount}/\${totalCount}</div>
                \`;
            }
            
            images.forEach((img, index) => {
                console.log(\`测试图片 \${index + 1}: \${img.src}\`);
                
                img.onload = function() {
                    loadedCount++;
                    console.log(\`✅ 图片 \${index + 1} 加载成功\`);
                    updateStats();
                };
                
                img.onerror = function() {
                    errorCount++;
                    console.error(\`❌ 图片 \${index + 1} 加载失败: \${this.src}\`);
                    updateStats();
                };
                
                // 检查已缓存的图片
                if (img.complete) {
                    if (img.naturalWidth > 0) {
                        img.onload();
                    } else {
                        img.onerror();
                    }
                }
            });
            
            updateStats();
            
            // 5秒后显示最终结果
            setTimeout(() => {
                console.log(\`🎯 测试完成! 成功: \${loadedCount}, 失败: \${errorCount}\`);
                if (errorCount === 0) {
                    console.log('🎉 所有图片加载正常!');
                } else {
                    console.log('⚠️ 部分图片加载失败，请检查路径和服务器配置');
                }
            }, 5000);
        });
    </script>
</body>
</html>`;
        
        const testPagePath = path.join(process.cwd(), 'image_test.html');
        fs.writeFileSync(testPagePath, testPageContent, 'utf8');
        
        console.log(`✅ 测试页面已生成: image_test.html`);
        console.log(`🌐 访问地址: http://localhost:8080/image_test.html`);
        this.fixes.push('生成图片加载测试页面');
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 onerror修复报告');
        console.log('='.repeat(60));
        
        if (this.fixes.length === 0) {
            console.log('ℹ️ 未发现需要修复的onerror问题');
        } else {
            console.log(`✅ 成功修复 ${this.fixes.length} 个问题:`);
            this.fixes.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix}`);
            });
        }
        
        console.log('\n🧪 测试步骤:');
        console.log('1. 确保Web服务器运行: node web_server.js');
        console.log('2. 访问测试页面: http://localhost:8080/image_test.html');
        console.log('3. 查看控制台输出和图片加载统计');
        console.log('4. 访问修复后的文章页面验证效果');
        
        console.log('\n💡 如果问题仍然存在:');
        console.log('- 检查浏览器控制台的详细错误信息');
        console.log('- 尝试硬刷新页面 (Ctrl+F5)');
        console.log('- 检查图片文件是否确实存在');
        console.log('- 验证Web服务器静态文件配置');
    }
}

// 执行修复
if (require.main === module) {
    const fixer = new OnErrorFixer();
    fixer.runFix().catch(console.error);
}

module.exports = OnErrorFixer;