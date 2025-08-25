#!/usr/bin/env node
// cleanup_residual_errors.js - 彻底清理残留的图片错误文本

const fs = require('fs');
const path = require('path');

class ResidualErrorCleaner {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.fixes = [];
    }

    async runCleanup() {
        console.log('🧹 开始清理残留的图片错误文本...\n');
        
        try {
            // 1. 分析残留问题
            await this.analyzeResidualIssues();
            
            // 2. 清理HTML文件中的残留文本
            await this.cleanupHTMLFiles();
            
            // 3. 重新生成干净的HTML
            await this.regenerateCleanHTML();
            
            // 4. 验证清理结果
            await this.verifyCleanup();
            
            this.generateReport();
            
        } catch (error) {
            console.error('❌ 清理过程中出现错误:', error.message);
        }
    }

    async analyzeResidualIssues() {
        console.log('🔍 分析残留问题...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        if (!fs.existsSync(wechatHtmlDir)) {
            console.log('❌ HTML目录不存在');
            return;
        }
        
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        console.log(`📋 检查 ${htmlFiles.length} 个HTML文件`);
        
        let totalIssues = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            
            // 检查各种残留问题
            const issues = {
                loadFailureText: (content.match(/图片加载失败/g) || []).length,
                strangeQuotes: (content.match(/['"][>]/g) || []).length,
                brokenHTML: (content.match(/<p[^>]*>.*?图片.*?<\/p>/g) || []).length,
                emptyContainers: (content.match(/<div[^>]*class="image-container"[^>]*>\s*<\/div>/g) || []).length
            };
            
            const fileIssueCount = Object.values(issues).reduce((a, b) => a + b, 0);
            
            if (fileIssueCount > 0) {
                console.log(`📄 ${htmlFile}: 发现 ${fileIssueCount} 个问题`);
                Object.entries(issues).forEach(([type, count]) => {
                    if (count > 0) {
                        console.log(`  - ${type}: ${count} 个`);
                    }
                });
                totalIssues += fileIssueCount;
            }
        }
        
        console.log(`\n📊 总计发现 ${totalIssues} 个残留问题需要清理`);
    }

    async cleanupHTMLFiles() {
        console.log('\n🧹 清理HTML文件...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        
        let cleanedCount = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            let content = fs.readFileSync(htmlPath, 'utf8');
            const originalContent = content;
            
            console.log(`  🔧 清理文件: ${htmlFile}`);
            
            // 1. 移除"图片加载失败"相关的文本和HTML
            content = content.replace(/<p[^>]*>.*?图片加载失败.*?<\/p>/g, '');
            content = content.replace(/图片加载失败[^<]*/g, '');
            
            // 2. 移除奇怪的引号和符号
            content = content.replace(/['"][>]/g, '');
            content = content.replace(/["'][^"'<>]*["'][>]/g, '');
            
            // 3. 清理空的图片容器
            content = content.replace(/<div[^>]*class="image-container"[^>]*>\s*<\/div>/g, '');
            
            // 4. 清理被破坏的HTML结构
            content = content.replace(/<p[^>]*>\s*<\/p>/g, ''); // 空段落
            content = content.replace(/\s{2,}/g, ' '); // 多余空格
            content = content.replace(/\n{3,}/g, '\n\n'); // 多余换行
            
            // 5. 修复可能被破坏的图片标签
            content = content.replace(/<img([^>]*?)(?:onerror="[^"]*")/g, '<img$1');
            
            // 6. 确保图片标签格式正确
            content = content.replace(/<img([^>]*?)src="([^"]*)"([^>]*?)>/g, (match, before, src, after) => {
                // 确保图片标签有正确的属性
                let imgTag = '<img' + before + 'src="' + src + '"' + after;
                
                // 如果没有alt属性，添加一个
                if (!imgTag.includes('alt=')) {
                    const altText = src.includes('img_') ? 
                        src.match(/img_(\d+)/)?.[0] || '图片' : '图片';
                    imgTag = imgTag.replace('>', ` alt="${altText}">`);
                }
                
                // 如果没有class，添加article-image类
                if (!imgTag.includes('class=')) {
                    imgTag = imgTag.replace('>', ' class="article-image">');
                }
                
                return imgTag + '>';
            });
            
            if (content !== originalContent) {
                // 创建清理前的备份
                const backupPath = htmlPath + '.pre-cleanup-' + Date.now();
                fs.writeFileSync(backupPath, originalContent, 'utf8');
                
                // 保存清理后的文件
                fs.writeFileSync(htmlPath, content, 'utf8');
                
                console.log(`    ✅ 清理完成，备份: ${path.basename(backupPath)}`);
                this.fixes.push(`清理残留问题: ${htmlFile}`);
                cleanedCount++;
            } else {
                console.log(`    ✅ 无需清理`);
            }
        }
        
        console.log(`📊 清理完成: ${cleanedCount}/${htmlFiles.length} 个文件需要清理`);
    }

    async regenerateCleanHTML() {
        console.log('\n🔄 重新生成干净的HTML...');
        
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        
        if (!fs.existsSync(wechatReadyDir)) {
            console.log('⚠️ Markdown目录不存在，跳过重新生成');
            return;
        }
        
        const mdFiles = fs.readdirSync(wechatReadyDir).filter(f => f.endsWith('.md'));
        let regeneratedCount = 0;
        
        console.log(`📋 重新生成 ${mdFiles.length} 个HTML文件`);
        
        for (const mdFile of mdFiles) {
            const articleNum = mdFile.match(/wechat_article_(\d+)\.md/)?.[1];
            if (!articleNum) continue;
            
            try {
                const mdPath = path.join(wechatReadyDir, mdFile);
                const mdContent = fs.readFileSync(mdPath, 'utf8');
                
                // 提取标题
                const titleMatch = mdContent.match(/^#\s+(.+)$/m);
                const title = titleMatch ? titleMatch[1] : `文章${articleNum}`;
                
                // 生成完全干净的HTML
                const cleanHTML = this.generateCompletelyCleanHTML(title, mdContent, articleNum);
                
                // 保存HTML文件
                const htmlFile = `wechat_article_${articleNum}.html`;
                const htmlPath = path.join(wechatHtmlDir, htmlFile);
                
                fs.writeFileSync(htmlPath, cleanHTML, 'utf8');
                console.log(`  ✅ 重新生成: ${htmlFile}`);
                regeneratedCount++;
                
            } catch (error) {
                console.log(`  ❌ 生成失败: ${mdFile} - ${error.message}`);
            }
        }
        
        console.log(`📊 重新生成完成: ${regeneratedCount}/${mdFiles.length}`);
        this.fixes.push(`重新生成 ${regeneratedCount} 个HTML文件`);
    }

    generateCompletelyCleanHTML(title, content, articleNum) {
        // 完全干净的HTML生成，确保没有任何错误处理的残留
        let htmlContent = content;
        
        console.log(`  🔄 处理文章${articleNum}: ${title.substring(0, 30)}...`);
        
        // 处理图片 - 使用最简洁的方式
        let imageCounter = 1;
        htmlContent = htmlContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            
            // 确保正确的图片路径
            let absoluteSrc;
            if (src.startsWith('../images/')) {
                absoluteSrc = src.replace('../images/', `/golf_content/${this.dateStr}/images/`);
            } else if (src.startsWith('/golf_content/')) {
                absoluteSrc = src;
            } else {
                const imageName = path.basename(src);
                absoluteSrc = `/golf_content/${this.dateStr}/images/${imageName}`;
            }
            
            // 生成最简洁的图片HTML - 不包含任何可能出错的处理
            return `\n\n<div class="image-container">
    <img src="${absoluteSrc}" alt="${caption}" class="article-image">
</div>\n\n`;
        });
        
        // 处理其他Markdown元素
        htmlContent = htmlContent
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>').replace(/$/, '</p>');
        
        // 清理可能的HTML问题
        htmlContent = htmlContent
            .replace(/<p><div class="image-container">/g, '<div class="image-container">')
            .replace(/<\/div><\/p>/g, '</div>')
            .replace(/<p>\s*<\/p>/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        
        // 生成完整的HTML文档
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.8;
            background: white;
            color: #333;
            font-size: 15px;
        }
        
        h1 {
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            color: #333;
            text-align: center;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
        }
        
        h2 {
            font-size: 18px;
            color: #444;
            margin: 20px 0 15px 0;
            font-weight: bold;
        }
        
        h3 {
            font-size: 16px;
            color: #555;
            margin: 18px 0 10px 0;
            font-weight: bold;
        }
        
        p {
            margin: 15px 0;
            line-height: 1.8;
        }
        
        strong {
            color: #d32f2f;
            font-weight: 600;
        }
        
        .image-container {
            margin: 30px 0;
            text-align: center;
            display: block;
            visibility: visible;
        }
        
        .article-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0 auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .article-image:hover {
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        
        .toolbar {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 200px;
        }
        
        .btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            margin-bottom: 10px;
            transition: all 0.3s ease;
            display: block;
            width: 100%;
            text-align: center;
            font-weight: 500;
        }
        
        .btn:hover {
            background: #1565c0;
            transform: translateY(-1px);
        }
        
        .btn.wechat {
            background: #07c160;
            font-weight: bold;
        }
        
        .btn.wechat:hover {
            background: #06ad56;
        }
        
        .copy-success {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4caf50;
            color: white;
            padding: 12px 24px;
            border-radius: 5px;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 1001;
            font-weight: bold;
        }
        
        .copy-success.show {
            opacity: 1;
        }
        
        @media (max-width: 600px) {
            body {
                padding: 15px;
            }
            
            .toolbar {
                position: relative;
                top: auto;
                right: auto;
                margin-bottom: 20px;
                min-width: auto;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="btn wechat" onclick="copyForWechat()">🚀 复制到微信公众号</button>
        <button class="btn" onclick="copyAllContent()">📋 复制全文(含格式)</button>
        <button class="btn" onclick="copyOnlyText()">📝 仅复制文字</button>
    </div>
    
    ${htmlContent}
    
    <div class="copy-success" id="copySuccess">✅ 已复制到剪贴板！</div>
    
    <script>
        // 图片加载处理 - 简洁版本，不会产生错误文本
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🖼️ 初始化图片显示...');
            
            const images = document.querySelectorAll('.article-image');
            console.log(\`发现 \${images.length} 张图片\`);
            
            images.forEach((img, index) => {
                console.log(\`图片 \${index + 1}: \${img.src}\`);
                
                img.onload = function() {
                    console.log(\`✅ 图片 \${index + 1} 加载成功\`);
                };
                
                img.onerror = function() {
                    console.log(\`⚠️ 图片 \${index + 1} 加载失败，但保持布局\`);
                    // 不显示任何错误文本，只是在控制台记录
                    this.style.opacity = '0.3';
                    this.style.border = '2px dashed #ddd';
                };
            });
        });
        
        // 复制功能保持不变
        function copyForWechat() {
            const tempDiv = document.createElement('div');
            tempDiv.style.fontSize = '15px';
            tempDiv.style.lineHeight = '1.8';
            tempDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
            
            const contentElements = document.body.cloneNode(true);
            const toolbar = contentElements.querySelector('.toolbar');
            if (toolbar) toolbar.remove();
            const copySuccess = contentElements.querySelector('.copy-success');
            if (copySuccess) copySuccess.remove();
            
            contentElements.querySelectorAll('p').forEach(p => {
                p.style.fontSize = '15px';
                p.style.lineHeight = '1.8';
                p.style.margin = '15px 0';
            });
            
            contentElements.querySelectorAll('h1').forEach(h => {
                h.style.fontSize = '20px';
                h.style.fontWeight = 'bold';
                h.style.textAlign = 'center';
                h.style.margin = '20px 0';
            });
            
            contentElements.querySelectorAll('h2').forEach(h => {
                h.style.fontSize = '18px';
                h.style.fontWeight = 'bold';
                h.style.margin = '20px 0 15px 0';
            });
            
            contentElements.querySelectorAll('img').forEach(img => {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '20px auto';
            });
            
            tempDiv.innerHTML = contentElements.innerHTML;
            
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
                    'text/plain': new Blob([tempDiv.innerText], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('✅ 已复制！可直接粘贴到微信公众号');
                });
            } catch (err) {
                copyOnlyText();
            }
        }
        
        function copyAllContent() {
            const tempDiv = document.createElement('div');
            const contentElements = document.body.cloneNode(true);
            
            const toolbar = contentElements.querySelector('.toolbar');
            if (toolbar) toolbar.remove();
            const copySuccess = contentElements.querySelector('.copy-success');
            if (copySuccess) copySuccess.remove();
            
            tempDiv.innerHTML = contentElements.innerHTML;
            
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
                    'text/plain': new Blob([tempDiv.innerText], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('全文已复制！(包含格式)');
                });
            } catch (err) {
                copyOnlyText();
            }
        }
        
        function copyOnlyText() {
            let textContent = document.body.innerText;
            textContent = textContent
                .replace(/🚀 复制到微信公众号\\s*📋 复制全文\\(含格式\\)\\s*📝 仅复制文字/g, '')
                .replace(/✅ 已复制到剪贴板！/g, '')
                .replace(/\\n{3,}/g, '\\n\\n')
                .trim();
            
            navigator.clipboard.writeText(textContent).then(() => {
                showCopySuccess('文字内容已复制！');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = textContent;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showCopySuccess('文字内容已复制！');
            });
        }
        
        function showCopySuccess(message) {
            const successDiv = document.getElementById('copySuccess');
            successDiv.textContent = message;
            successDiv.classList.add('show');
            
            setTimeout(() => {
                successDiv.classList.remove('show');
            }, 3000);
        }
    </script>
</body>
</html>`;
    }

    async verifyCleanup() {
        console.log('\n🔍 验证清理结果...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        
        let allClean = true;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            
            // 检查是否还有残留问题
            const residualIssues = [
                content.includes('图片加载失败'),
                content.includes('\'">'),
                content.includes('图片加载失败'),
                /<p[^>]*>\s*<\/p>/.test(content)
            ];
            
            const hasIssues = residualIssues.some(issue => issue);
            
            if (hasIssues) {
                console.log(`⚠️ ${htmlFile}: 仍有残留问题`);
                allClean = false;
            } else {
                console.log(`✅ ${htmlFile}: 干净`);
            }
        }
        
        if (allClean) {
            console.log('🎉 所有文件都已清理干净！');
        } else {
            console.log('⚠️ 部分文件仍有问题，可能需要手动检查');
        }
        
        return allClean;
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 残留错误清理报告');
        console.log('='.repeat(60));
        
        if (this.fixes.length === 0) {
            console.log('ℹ️ 未发现需要清理的残留问题');
        } else {
            console.log(`✅ 成功清理 ${this.fixes.length} 个问题:`);
            this.fixes.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix}`);
            });
        }
        
        console.log('\n🧪 建议测试:');
        console.log('1. 强制刷新页面 (Ctrl+F5)');
        console.log('2. 访问修复后的文章页面');
        console.log('3. 检查是否还有"图片加载失败"文本');
        console.log('4. 检查浏览器控制台的图片加载日志');
        
        console.log('\n✨ 清理完成！页面应该完全干净了。');
    }
}

// 执行清理
if (require.main === module) {
    const cleaner = new ResidualErrorCleaner();
    cleaner.runCleanup().catch(console.error);
}

module.exports = ResidualErrorCleaner;