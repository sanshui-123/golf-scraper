#!/usr/bin/env node
// fix_duplicate_images.js - 修复图片重复显示问题

const fs = require('fs');
const path = require('path');

class DuplicateImageFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.fixes = [];
    }

    async runFix() {
        console.log('🔧 修复图片重复显示问题...\n');
        
        try {
            // 1. 分析重复问题
            await this.analyzeDuplicateIssues();
            
            // 2. 修复Markdown中的重复图片引用
            await this.fixMarkdownDuplicates();
            
            // 3. 重新生成HTML（确保无重复）
            await this.regenerateHTMLWithoutDuplicates();
            
            // 4. 验证修复结果
            await this.verifyNoDuplicates();
            
            this.generateReport();
            
        } catch (error) {
            console.error('❌ 修复过程中出现错误:', error.message);
        }
    }

    async analyzeDuplicateIssues() {
        console.log('🔍 分析图片重复问题...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        
        if (!fs.existsSync(wechatHtmlDir) || !fs.existsSync(wechatReadyDir)) {
            console.log('❌ 必要目录不存在');
            return;
        }
        
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        console.log(`📋 检查 ${htmlFiles.length} 个HTML文件的重复图片问题`);
        
        let totalDuplicates = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            
            // 提取所有图片src
            const imgMatches = content.match(/<img[^>]+src="([^"]+)"/g) || [];
            const imgSources = imgMatches.map(match => {
                const srcMatch = match.match(/src="([^"]+)"/);
                return srcMatch ? srcMatch[1] : null;
            }).filter(src => src);
            
            // 检查重复
            const sourceCounts = {};
            imgSources.forEach(src => {
                sourceCounts[src] = (sourceCounts[src] || 0) + 1;
            });
            
            const duplicates = Object.entries(sourceCounts).filter(([src, count]) => count > 1);
            
            if (duplicates.length > 0) {
                console.log(`📄 ${htmlFile}: 发现重复图片`);
                duplicates.forEach(([src, count]) => {
                    console.log(`  🔄 ${path.basename(src)}: 重复 ${count} 次`);
                    totalDuplicates += count - 1; // 减去正常的1次
                });
            } else {
                console.log(`📄 ${htmlFile}: 无重复图片 ✅`);
            }
            
            // 同时检查对应的Markdown文件
            const articleNum = htmlFile.match(/wechat_article_(\d+)\.html/)?.[1];
            if (articleNum) {
                const mdFile = `wechat_article_${articleNum}.md`;
                const mdPath = path.join(wechatReadyDir, mdFile);
                
                if (fs.existsSync(mdPath)) {
                    const mdContent = fs.readFileSync(mdPath, 'utf8');
                    const mdImgMatches = mdContent.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
                    
                    if (mdImgMatches.length !== imgSources.length && imgSources.length > 0) {
                        console.log(`  ⚠️ Markdown中有 ${mdImgMatches.length} 个图片引用，HTML中有 ${imgSources.length} 个图片`);
                    }
                }
            }
        }
        
        console.log(`\n📊 总计发现 ${totalDuplicates} 个重复图片需要修复`);
        
        if (totalDuplicates === 0) {
            console.log('✅ 没有发现重复图片问题');
        }
    }

    async fixMarkdownDuplicates() {
        console.log('\n🔧 修复Markdown中的重复图片引用...');
        
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        const mdFiles = fs.readdirSync(wechatReadyDir).filter(f => f.endsWith('.md'));
        
        let fixedCount = 0;
        
        for (const mdFile of mdFiles) {
            const mdPath = path.join(wechatReadyDir, mdFile);
            let content = fs.readFileSync(mdPath, 'utf8');
            const originalContent = content;
            
            console.log(`  📝 检查: ${mdFile}`);
            
            // 提取所有图片引用
            const imgMatches = content.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
            console.log(`    发现 ${imgMatches.length} 个图片引用`);
            
            if (imgMatches.length > 0) {
                // 去重图片引用
                const seenImages = new Set();
                const uniqueImages = [];
                
                imgMatches.forEach(match => {
                    const srcMatch = match.match(/!\[[^\]]*\]\(([^)]+)\)/);
                    if (srcMatch) {
                        const src = srcMatch[1];
                        const imageName = path.basename(src);
                        
                        if (!seenImages.has(imageName)) {
                            seenImages.add(imageName);
                            uniqueImages.push(match);
                        } else {
                            console.log(`    🗑️ 移除重复图片: ${imageName}`);
                        }
                    }
                });
                
                if (uniqueImages.length < imgMatches.length) {
                    // 重新构建内容，只保留唯一的图片
                    let newContent = content;
                    
                    // 先移除所有图片引用
                    imgMatches.forEach(match => {
                        newContent = newContent.replace(match, '');
                    });
                    
                    // 清理多余的空行
                    newContent = newContent.replace(/\n{3,}/g, '\n\n');
                    
                    // 在适当位置重新插入唯一的图片
                    // 简单策略：在每个主要段落后插入图片
                    const paragraphs = newContent.split('\n\n');
                    const imgInsertPoints = [];
                    
                    // 找到插入点（避免在标题后直接插入）
                    for (let i = 0; i < paragraphs.length; i++) {
                        const para = paragraphs[i].trim();
                        if (para && !para.startsWith('#') && para.length > 100) {
                            imgInsertPoints.push(i);
                        }
                    }
                    
                    // 均匀分布图片
                    const insertInterval = Math.max(1, Math.floor(imgInsertPoints.length / uniqueImages.length));
                    let imgIndex = 0;
                    
                    for (let i = 0; i < imgInsertPoints.length && imgIndex < uniqueImages.length; i += insertInterval) {
                        const insertPos = imgInsertPoints[i];
                        if (insertPos < paragraphs.length - 1) {
                            paragraphs[insertPos] += '\n\n' + uniqueImages[imgIndex];
                            imgIndex++;
                        }
                    }
                    
                    // 如果还有剩余图片，追加到最后
                    while (imgIndex < uniqueImages.length) {
                        paragraphs.push(uniqueImages[imgIndex]);
                        imgIndex++;
                    }
                    
                    content = paragraphs.join('\n\n');
                    
                    console.log(`    ✅ 去重完成: ${imgMatches.length} → ${uniqueImages.length} 个图片`);
                } else {
                    console.log(`    ✅ 无重复图片`);
                }
            }
            
            if (content !== originalContent) {
                // 备份原文件
                const backupPath = mdPath + '.pre-dedup-' + Date.now();
                fs.writeFileSync(backupPath, originalContent, 'utf8');
                
                // 保存修复后的文件
                fs.writeFileSync(mdPath, content, 'utf8');
                
                console.log(`    💾 已保存，备份: ${path.basename(backupPath)}`);
                this.fixes.push(`去重图片: ${mdFile}`);
                fixedCount++;
            }
        }
        
        console.log(`📊 修复完成: ${fixedCount}/${mdFiles.length} 个Markdown文件需要去重`);
    }

    async regenerateHTMLWithoutDuplicates() {
        console.log('\n🔄 重新生成HTML（确保无重复）...');
        
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        
        const mdFiles = fs.readdirSync(wechatReadyDir).filter(f => f.endsWith('.md'));
        let regeneratedCount = 0;
        
        for (const mdFile of mdFiles) {
            const articleNum = mdFile.match(/wechat_article_(\d+)\.md/)?.[1];
            if (!articleNum) continue;
            
            try {
                const mdPath = path.join(wechatReadyDir, mdFile);
                const mdContent = fs.readFileSync(mdPath, 'utf8');
                
                // 提取标题
                const titleMatch = mdContent.match(/^#\s+(.+)$/m);
                const title = titleMatch ? titleMatch[1] : `文章${articleNum}`;
                
                // 使用严格去重的HTML生成
                const cleanHTML = this.generateHTMLWithStrictDeduplication(title, mdContent, articleNum);
                
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

    generateHTMLWithStrictDeduplication(title, content, articleNum) {
        console.log(`  🔄 处理文章${articleNum}: ${title.substring(0, 30)}...`);
        
        let htmlContent = content;
        
        // 严格的图片去重处理
        const seenImageSources = new Set();
        let imageCounter = 1;
        
        htmlContent = htmlContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const imageName = path.basename(src);
            
            // 如果已经见过这个图片，跳过
            if (seenImageSources.has(imageName)) {
                console.log(`    🗑️ 跳过重复图片: ${imageName}`);
                return ''; // 返回空字符串，不生成HTML
            }
            
            seenImageSources.add(imageName);
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            
            // 确保正确的图片路径
            let absoluteSrc;
            if (src.startsWith('../images/')) {
                absoluteSrc = src.replace('../images/', `/golf_content/${this.dateStr}/images/`);
            } else if (src.startsWith('/golf_content/')) {
                absoluteSrc = src;
            } else {
                absoluteSrc = `/golf_content/${this.dateStr}/images/${imageName}`;
            }
            
            console.log(`    📷 添加图片: ${imageName} (${caption})`);
            
            // 生成图片HTML - 不包含图片说明
            return `\n\n<div class="image-container">
    <img src="${absoluteSrc}" alt="${caption}" class="article-image">
</div>\n\n`;
        });
        
        console.log(`    ✅ 图片处理完成，实际包含 ${seenImageSources.size} 张唯一图片`);
        
        // 处理其他Markdown元素
        htmlContent = htmlContent
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>').replace(/$/, '</p>');
        
        // 清理HTML结构问题
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
        // 图片加载处理
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🖼️ 初始化图片显示...');
            
            const images = document.querySelectorAll('.article-image');
            console.log(\`发现 \${images.length} 张图片\`);
            
            // 检查重复图片
            const imageSources = Array.from(images).map(img => img.src);
            const uniqueSources = [...new Set(imageSources)];
            
            if (imageSources.length !== uniqueSources.length) {
                console.warn('⚠️ 检测到重复图片，这不应该发生');
            } else {
                console.log('✅ 所有图片都是唯一的');
            }
            
            images.forEach((img, index) => {
                console.log(\`图片 \${index + 1}: \${img.src}\`);
                
                img.onload = function() {
                    console.log(\`✅ 图片 \${index + 1} 加载成功\`);
                };
                
                img.onerror = function() {
                    console.log(\`⚠️ 图片 \${index + 1} 加载失败，但保持布局\`);
                    this.style.opacity = '0.3';
                    this.style.border = '2px dashed #ddd';
                };
            });
        });
        
        // 复制功能
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

    async verifyNoDuplicates() {
        console.log('\n🔍 验证是否还有重复图片...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        
        let totalDuplicatesFound = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            
            // 提取所有图片src
            const imgMatches = content.match(/<img[^>]+src="([^"]+)"/g) || [];
            const imgSources = imgMatches.map(match => {
                const srcMatch = match.match(/src="([^"]+)"/);
                return srcMatch ? srcMatch[1] : null;
            }).filter(src => src);
            
            // 检查重复
            const sourceCounts = {};
            imgSources.forEach(src => {
                sourceCounts[src] = (sourceCounts[src] || 0) + 1;
            });
            
            const duplicates = Object.entries(sourceCounts).filter(([src, count]) => count > 1);
            
            if (duplicates.length > 0) {
                console.log(`❌ ${htmlFile}: 仍有重复图片`);
                duplicates.forEach(([src, count]) => {
                    console.log(`  🔄 ${path.basename(src)}: ${count} 次`);
                });
                totalDuplicatesFound += duplicates.length;
            } else {
                console.log(`✅ ${htmlFile}: 无重复图片`);
            }
        }
        
        if (totalDuplicatesFound === 0) {
            console.log('🎉 所有文件都已清除重复图片！');
        } else {
            console.log(`⚠️ 仍有 ${totalDuplicatesFound} 个重复图片问题`);
        }
        
        return totalDuplicatesFound === 0;
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 图片重复修复报告');
        console.log('='.repeat(60));
        
        if (this.fixes.length === 0) {
            console.log('ℹ️ 未发现重复图片问题');
        } else {
            console.log(`✅ 成功修复 ${this.fixes.length} 个问题:`);
            this.fixes.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix}`);
            });
        }
        
        console.log('\n🧪 建议测试:');
        console.log('1. 强制刷新页面 (Ctrl+F5)');
        console.log('2. 访问修复后的文章页面');
        console.log('3. 检查每张图片是否只显示一次');
        console.log('4. 检查浏览器控制台的图片日志');
        
        console.log('\n✨ 重复图片修复完成！每张图片现在应该只显示一次。');
    }
}

// 执行修复
if (require.main === module) {
    const fixer = new DuplicateImageFixer();
    fixer.runFix().catch(console.error);
}

module.exports = DuplicateImageFixer;