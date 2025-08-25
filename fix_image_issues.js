#!/usr/bin/env node
// fix_image_issues.js - 修复图片显示和占位符问题

const fs = require('fs');
const path = require('path');
const generateEnhancedHTML = require('./enhanced_html_template');

class ImageIssueFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.fixes = [];
        this.errors = [];
    }

    async runFixes() {
        console.log('🖼️ 开始修复图片相关问题...\n');
        
        try {
            // 1. 分析现有文章的占位符问题
            await this.analyzePlaceholderIssues();
            
            // 2. 修复占位符格式
            await this.fixPlaceholderFormats();
            
            // 3. 重新生成HTML文件
            await this.regenerateHTMLFiles();
            
            // 4. 验证图片路径
            await this.verifyImagePaths();
            
            // 5. 生成修复报告
            this.generateFixReport();
            
        } catch (error) {
            console.error('❌ 修复过程中出现错误:', error.message);
            this.errors.push(`修复失败: ${error.message}`);
        }
    }

    async analyzePlaceholderIssues() {
        console.log('🔍 分析现有文章的占位符问题...');
        
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        if (!fs.existsSync(wechatReadyDir)) {
            console.log('  ⚠️ wechat_ready目录不存在');
            return;
        }
        
        const mdFiles = fs.readdirSync(wechatReadyDir).filter(f => f.endsWith('.md'));
        console.log(`  📁 检查 ${mdFiles.length} 个文章文件`);
        
        const placeholderStats = {
            correct: [],
            needsFix: [],
            missing: []
        };
        
        for (const mdFile of mdFiles) {
            const filePath = path.join(wechatReadyDir, mdFile);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 检测各种占位符格式
            const formats = {
                standard: content.match(/\[IMAGE_(\d+):[^\]]+\]/g) || [],
                chinese: content.match(/\[图片(\d+)：[^\]]+\]/g) || [],
                chinesePunc: content.match(/\[图片(\d+):[^\]]+\]/g) || [], // 英文冒号
                chineseBracket: content.match(/【图片(\d+)[：:][^】]+】/g) || [], // 中文方括号
                markdown: content.match(/!\[[^\]]*\]\([^)]*\)/g) || [], // 已经是markdown
                broken: content.match(/\[IMAGE_\d+[^\]]*\]/g) || [] // 可能格式错误的
            };
            
            const articleNum = mdFile.match(/wechat_article_(\d+)\.md/)?.[1];
            const imageDir = path.join(this.baseDir, 'images');
            const expectedImages = fs.existsSync(imageDir) ? 
                fs.readdirSync(imageDir).filter(f => f.startsWith(`article_${articleNum}_img_`)).length : 0;
            
            const totalPlaceholders = Object.values(formats).reduce((sum, arr) => sum + arr.length, 0);
            
            console.log(`  📄 ${mdFile}:`);
            console.log(`    预期图片: ${expectedImages}, 发现占位符: ${totalPlaceholders}`);
            
            if (formats.standard.length > 0) {
                console.log(`    ✅ 标准格式: ${formats.standard.length} 个`);
                placeholderStats.correct.push(mdFile);
            }
            
            if (formats.chinesePunc.length > 0 || formats.chineseBracket.length > 0) {
                console.log(`    ⚠️ 需要修复: ${formats.chinesePunc.length + formats.chineseBracket.length} 个`);
                placeholderStats.needsFix.push({
                    file: mdFile,
                    issues: {
                        chinesePunc: formats.chinesePunc,
                        chineseBracket: formats.chineseBracket
                    }
                });
            }
            
            if (formats.markdown.length > 0) {
                console.log(`    📝 已是markdown: ${formats.markdown.length} 个`);
            }
            
            if (expectedImages > totalPlaceholders) {
                console.log(`    ❌ 缺少占位符: 应有${expectedImages}个，实际${totalPlaceholders}个`);
                placeholderStats.missing.push({
                    file: mdFile,
                    expected: expectedImages,
                    found: totalPlaceholders
                });
            }
        }
        
        console.log(`\n📊 占位符统计:`);
        console.log(`  ✅ 格式正确: ${placeholderStats.correct.length} 个文件`);
        console.log(`  ⚠️ 需要修复: ${placeholderStats.needsFix.length} 个文件`);
        console.log(`  ❌ 缺少占位符: ${placeholderStats.missing.length} 个文件`);
        
        this.placeholderStats = placeholderStats;
    }

    async fixPlaceholderFormats() {
        console.log('\n🔧 修复占位符格式...');
        
        if (!this.placeholderStats || this.placeholderStats.needsFix.length === 0) {
            console.log('  ✅ 没有需要修复的占位符格式');
            return;
        }
        
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        
        for (const item of this.placeholderStats.needsFix) {
            const filePath = path.join(wechatReadyDir, item.file);
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;
            
            console.log(`  🔧 修复文件: ${item.file}`);
            
            // 修复中文冒号为英文冒号的占位符
            if (item.issues.chinesePunc.length > 0) {
                const oldContent = content;
                content = content.replace(/\[图片(\d+):([^\]]+)\]/g, '[IMAGE_$1:$2]');
                if (content !== oldContent) {
                    console.log(`    ✅ 修复中文冒号格式: ${item.issues.chinesePunc.length} 个`);
                    modified = true;
                }
            }
            
            // 修复中文方括号的占位符
            if (item.issues.chineseBracket.length > 0) {
                const oldContent = content;
                content = content.replace(/【图片(\d+)[：:]([^】]+)】/g, '[IMAGE_$1:$2]');
                if (content !== oldContent) {
                    console.log(`    ✅ 修复中文方括号格式: ${item.issues.chineseBracket.length} 个`);
                    modified = true;
                }
            }
            
            // 修复其他可能的格式问题
            content = content.replace(/\[图片(\d+)：([^\]]+)\]/g, '[IMAGE_$1:$2]'); // 标准中文格式转英文
            
            if (modified) {
                // 备份原文件
                const backupPath = filePath + '.backup';
                fs.writeFileSync(backupPath, fs.readFileSync(filePath));
                
                // 保存修复后的文件
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`    💾 已保存修复，原文件备份为: ${path.basename(backupPath)}`);
                this.fixes.push(`修复占位符格式: ${item.file}`);
            }
        }
    }

    async regenerateHTMLFiles() {
        console.log('\n🌐 重新生成HTML文件...');
        
        const wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        
        if (!fs.existsSync(wechatReadyDir)) {
            console.log('  ⚠️ wechat_ready目录不存在');
            return;
        }
        
        // 确保HTML目录存在
        if (!fs.existsSync(wechatHtmlDir)) {
            fs.mkdirSync(wechatHtmlDir, { recursive: true });
        }
        
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
                
                // 生成增强的HTML
                const htmlContent = this.generateEnhancedHTML(title, mdContent, articleNum);
                
                // 保存HTML文件
                const htmlFile = `wechat_article_${articleNum}.html`;
                const htmlPath = path.join(wechatHtmlDir, htmlFile);
                fs.writeFileSync(htmlPath, htmlContent, 'utf8');
                
                console.log(`  ✅ 重新生成: ${htmlFile}`);
                this.fixes.push(`重新生成HTML: ${htmlFile}`);
                regeneratedCount++;
                
            } catch (error) {
                console.log(`  ❌ 生成失败: ${mdFile} - ${error.message}`);
                this.errors.push(`生成HTML失败: ${mdFile}`);
            }
        }
        
        console.log(`  📊 重新生成了 ${regeneratedCount} 个HTML文件`);
    }

    async verifyImagePaths() {
        console.log('\n🔍 验证图片路径...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const imagesDir = path.join(this.baseDir, 'images');
        
        if (!fs.existsSync(wechatHtmlDir) || !fs.existsSync(imagesDir)) {
            console.log('  ⚠️ HTML或图片目录不存在');
            return;
        }
        
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        const imageFiles = fs.readdirSync(imagesDir);
        
        console.log(`  📊 检查 ${htmlFiles.length} 个HTML文件中的图片引用`);
        
        let totalImages = 0;
        let validImages = 0;
        let missingImages = 0;
        
        for (const htmlFile of htmlFiles) {
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            // 提取所有图片src
            const imgRegex = /<img[^>]+src="([^"]+)"/g;
            let match;
            
            while ((match = imgRegex.exec(htmlContent)) !== null) {
                totalImages++;
                const src = match[1];
                
                // 转换为实际文件路径
                if (src.startsWith(`/golf_content/${this.dateStr}/images/`)) {
                    const imageName = path.basename(src);
                    if (imageFiles.includes(imageName)) {
                        validImages++;
                    } else {
                        missingImages++;
                        console.log(`    ❌ 缺失图片: ${imageName} (在 ${htmlFile})`);
                    }
                } else {
                    console.log(`    ⚠️ 路径格式异常: ${src} (在 ${htmlFile})`);
                }
            }
        }
        
        console.log(`  📊 图片路径验证结果:`);
        console.log(`    总图片引用: ${totalImages}`);
        console.log(`    有效引用: ${validImages}`);
        console.log(`    缺失文件: ${missingImages}`);
        
        if (missingImages === 0) {
            console.log(`  ✅ 所有图片路径都正确`);
        } else {
            console.log(`  ⚠️ 发现 ${missingImages} 个缺失的图片文件`);
        }
    }

    generateEnhancedHTML(title, content, articleNum) {
        // 🔧 修复：先处理图片，避免被包裹在<p>标签里
        let htmlContent = content;
        
        // 1. 先处理图片（在转换段落之前）
        let imageCounter = 1;
        htmlContent = htmlContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            
            // 确保图片路径正确
            let absoluteSrc;
            if (src.startsWith('../images/')) {
                // 相对路径转绝对路径
                absoluteSrc = src.replace('../images/', `/golf_content/${this.dateStr}/images/`);
            } else if (src.startsWith('/golf_content/')) {
                // 已经是绝对路径
                absoluteSrc = src;
            } else {
                // 其他情况，尝试构建正确路径
                const imageName = path.basename(src);
                absoluteSrc = `/golf_content/${this.dateStr}/images/${imageName}`;
            }
            
            // 返回图片HTML，用特殊标记包裹以防止被段落化
            return `\n<!-- IMG_START --><div class="image-container">
                        <img src="${absoluteSrc}" alt="${caption}" class="article-image" onclick="copyImage(this)" onerror="this.parentElement.style.display='none';">
                    </div><!-- IMG_END -->\n`;
        });
        
        // 2. 处理标题和强调
        htmlContent = htmlContent
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // 3. 处理段落（但保护图片区域）
        const parts = htmlContent.split(/<!-- IMG_START -->|<!-- IMG_END -->/);
        for (let i = 0; i < parts.length; i++) {
            // 只处理非图片部分（偶数索引）
            if (i % 2 === 0) {
                parts[i] = parts[i]
                    .split('\n\n')
                    .map(para => {
                        para = para.trim();
                        if (para && !para.startsWith('<h') && !para.startsWith('<div')) {
                            return `<p>${para}</p>`;
                        }
                        return para;
                    })
                    .join('\n');
            }
        }
        htmlContent = parts.join('');
        
        // 生成完整的HTML模板（包含所有微信复制功能）
        return generateEnhancedHTML(title, htmlContent);
    }

    getCompleteHTMLTemplate_old(title, htmlContent) {
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
            font-size: 15px;
            line-height: 1.8;
        }
        
        strong {
            color: #d32f2f;
            font-weight: 600;
        }
        
        .image-container {
            margin: 30px 0;
            text-align: center;
        }
        
        .article-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .article-image:hover {
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            transform: translateY(-2px);
        }
        
        .image-caption {
            margin: 15px 0 0 0;
            font-size: 14px;
            color: #666;
            font-style: italic;
            text-align: center;
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
            min-width: 180px;
        }
        
        .btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 13px;
            margin-bottom: 8px;
            transition: all 0.3s ease;
            display: block;
            width: 100%;
            text-align: center;
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
        // Base64转换函数
        async function convertImageToBase64(img) {
            return new Promise((resolve) => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const image = new Image();
                    
                    image.crossOrigin = 'anonymous';
                    
                    image.onload = function() {
                        try {
                            // 计算优化后的尺寸
                            let width = this.naturalWidth;
                            let height = this.naturalHeight;
                            const maxWidth = 800;
                            
                            if (width > maxWidth) {
                                const ratio = height / width;
                                width = maxWidth;
                                height = Math.round(width * ratio);
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(this, 0, 0, width, height);
                            
                            // 转换为JPEG格式，质量0.8
                            const base64 = canvas.toDataURL('image/jpeg', 0.8);
                            console.log('图片转换成功，Base64大小: ' + Math.round(base64.length / 1024) + 'KB');
                            resolve(base64);
                        } catch (e) {
                            console.log('Canvas转换失败:', e);
                            resolve(null);
                        }
                    };
                    
                    image.onerror = function(e) {
                        console.log('图片加载失败:', e);
                        resolve(null);
                    };
                    
                    // 处理图片路径
                    let imageSrc = img.src;
                    if (imageSrc.startsWith('/')) {
                        imageSrc = window.location.origin + imageSrc;
                    }
                    
                    image.src = imageSrc;
                    
                    // 设置超时
                    setTimeout(() => {
                        if (image.complete === false) {
                            console.log('图片加载超时');
                            resolve(null);
                        }
                    }, 5000); // 5秒超时
                    
                } catch (error) {
                    console.log('Base64转换初始化错误:', error);
                    resolve(null);
                }
            });
        }
        
        // 专为微信公众号优化的复制功能（包含Base64图片内嵌）
        async function copyForWechat() {
            const tempDiv = document.createElement('div');
            tempDiv.style.fontSize = '15px';
            tempDiv.style.lineHeight = '1.8';
            tempDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
            
            // 克隆内容并移除工具栏
            const contentElements = document.body.cloneNode(true);
            const toolbar = contentElements.querySelector('.toolbar');
            if (toolbar) toolbar.remove();
            const copySuccess = contentElements.querySelector('.copy-success');
            if (copySuccess) copySuccess.remove();
            
            // 设置微信公众号专用样式
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
            
            // 转换所有图片为Base64
            const images = contentElements.querySelectorAll('img');
            console.log('检测到 ' + images.length + ' 张图片，开始转换为Base64...');
            
            let convertedCount = 0;
            for (const img of images) {
                if (!img.closest('.toolbar')) {
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.margin = '20px auto';
                    
                    try {
                        const base64Data = await convertImageToBase64(img);
                        if (base64Data) {
                            img.src = base64Data;
                            convertedCount++;
                            console.log('✅ 第 ' + convertedCount + ' 张图片Base64转换成功');
                        } else {
                            console.log('⚠️ 图片Base64转换失败，移除该图片');
                            // 如果转换失败，完全移除图片元素
                            const container = img.closest('.image-container');
                            if (container) {
                                container.remove();
                            } else {
                                img.remove();
                            }
                        }
                    } catch (error) {
                        console.log('❌ 图片处理出错:', error);
                        // 出错时也移除图片
                        const container = img.closest('.image-container');
                        if (container) {
                            container.remove();
                        } else {
                            img.remove();
                        }
                    }
                }
            }
            
            tempDiv.innerHTML = contentElements.innerHTML;
            
            // 最终清理：移除所有无效的图片元素
            tempDiv.querySelectorAll('img').forEach(img => {
                // 检查图片是否有效
                if (!img.src || img.src === '' || img.src === window.location.href || 
                    (!img.src.startsWith('data:') && !img.src.includes('http'))) {
                    const container = img.closest('.image-container');
                    if (container) {
                        container.remove();
                    } else {
                        img.remove();
                    }
                }
            });
            
            // 移除空的图片容器
            tempDiv.querySelectorAll('.image-container').forEach(container => {
                if (!container.querySelector('img')) {
                    container.remove();
                }
            });
            
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
                    'text/plain': new Blob([tempDiv.innerText], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('✅ 已复制！' + (convertedCount > 0 ? '已内嵌' + convertedCount + '张Base64图片，' : '') + '可直接粘贴到微信公众号');
                });
            } catch (err) {
                copyOnlyText();
            }
        }
        
        async function copyAllContent() {
            const tempDiv = document.createElement('div');
            const contentElements = document.body.cloneNode(true);
            
            const toolbar = contentElements.querySelector('.toolbar');
            if (toolbar) toolbar.remove();
            const copySuccess = contentElements.querySelector('.copy-success');
            if (copySuccess) copySuccess.remove();
            
            // 转换所有图片为Base64
            const images = contentElements.querySelectorAll('img');
            console.log('检测到 ' + images.length + ' 张图片，开始转换为Base64...');
            
            let convertedCount = 0;
            for (const img of images) {
                if (!img.closest('.toolbar')) {
                    try {
                        const base64Data = await convertImageToBase64(img);
                        if (base64Data) {
                            img.src = base64Data;
                            convertedCount++;
                            console.log('✅ 第 ' + convertedCount + ' 张图片Base64转换成功');
                        } else {
                            console.log('⚠️ 图片Base64转换失败，移除该图片');
                            // 如果转换失败，完全移除图片元素
                            const container = img.closest('.image-container');
                            if (container) {
                                container.remove();
                            } else {
                                img.remove();
                            }
                        }
                    } catch (error) {
                        console.log('❌ 图片处理出错:', error);
                        // 出错时也移除图片
                        const container = img.closest('.image-container');
                        if (container) {
                            container.remove();
                        } else {
                            img.remove();
                        }
                    }
                }
            }
            
            tempDiv.innerHTML = contentElements.innerHTML;
            
            // 最终清理：移除所有无效的图片元素
            tempDiv.querySelectorAll('img').forEach(img => {
                // 检查图片是否有效
                if (!img.src || img.src === '' || img.src === window.location.href || 
                    (!img.src.startsWith('data:') && !img.src.includes('http'))) {
                    const container = img.closest('.image-container');
                    if (container) {
                        container.remove();
                    } else {
                        img.remove();
                    }
                }
            });
            
            // 移除空的图片容器
            tempDiv.querySelectorAll('.image-container').forEach(container => {
                if (!container.querySelector('img')) {
                    container.remove();
                }
            });
            
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
                    'text/plain': new Blob([tempDiv.innerText], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('全文已复制！' + (convertedCount > 0 ? '(已内嵌' + convertedCount + '张Base64图片)' : '(包含格式)'));
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
        
        function copyImage(img) {
            // 图片复制功能保持原有逻辑
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(async (blob) => {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showCopySuccess('图片已复制！');
                    } catch (err) {
                        fallbackCopyImage(img);
                    }
                }, 'image/png');
            } catch (err) {
                fallbackCopyImage(img);
            }
        }
        
        function fallbackCopyImage(img) {
            const range = document.createRange();
            range.selectNode(img);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            
            try {
                document.execCommand('copy');
                showCopySuccess('图片已复制！');
            } catch (err) {
                alert('复制失败，请右键选择"复制图像"');
            }
            
            window.getSelection().removeAllRanges();
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

    generateFixReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 图片问题修复报告');
        console.log('='.repeat(60));
        
        if (this.fixes.length === 0 && this.errors.length === 0) {
            console.log('✅ 未发现需要修复的图片问题');
        } else {
            if (this.fixes.length > 0) {
                console.log(`✅ 成功修复 ${this.fixes.length} 个问题:`);
                this.fixes.forEach((fix, index) => {
                    console.log(`${index + 1}. ${fix}`);
                });
            }
            
            if (this.errors.length > 0) {
                console.log(`\n❌ ${this.errors.length} 个问题修复失败:`);
                this.errors.forEach((error, index) => {
                    console.log(`${index + 1}. ${error}`);
                });
            }
        }
        
        console.log('\n📋 后续建议:');
        console.log('1. 启动Web服务器查看修复效果: node start.js');
        console.log('2. 打开浏览器访问: http://localhost:8080');
        console.log('3. 检查图片是否正常显示');
        console.log('4. 测试微信公众号复制功能');
        console.log('\n💡 如果问题仍然存在:');
        console.log('- 检查网络连接和Web服务器状态');
        console.log('- 确认图片文件确实存在于images目录');
        console.log('- 查看浏览器控制台的错误信息');
    }
}

// 执行修复
if (require.main === module) {
    const fixer = new ImageIssueFixer();
    fixer.runFixes().catch(console.error);
}

module.exports = ImageIssueFixer;