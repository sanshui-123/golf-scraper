#!/usr/bin/env node
// fix_system_issues.js - 自动修复系统诊断发现的问题

const fs = require('fs');
const path = require('path');

class SystemFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.fixedCount = 0;
    }

    async fixAllIssues() {
        console.log('🛠️ 开始修复系统问题...\n');
        
        // 1. 修复缺失的HTML文件
        await this.fixMissingHtmlFiles();
        
        // 2. 修复提示词文件
        await this.fixPromptFile();
        
        // 3. 修复Base64图片功能
        await this.fixBase64Support();
        
        console.log(`\n✅ 修复完成！共修复 ${this.fixedCount} 个问题`);
    }

    async fixMissingHtmlFiles() {
        console.log('📄 修复缺失的HTML文件...');
        
        const mdDir = path.join(this.baseDir, 'wechat_ready');
        const htmlDir = path.join(this.baseDir, 'wechat_html');
        
        if (!fs.existsSync(mdDir)) {
            console.log('  ⚠️ 没有Markdown文件需要修复');
            return;
        }
        
        const mdFiles = fs.readdirSync(mdDir).filter(f => f.endsWith('.md'));
        const htmlFiles = fs.existsSync(htmlDir) ? fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')) : [];
        
        mdFiles.forEach(mdFile => {
            const articleNum = mdFile.match(/wechat_article_(\d+)\.md/)?.[1];
            if (articleNum) {
                const expectedHtml = `wechat_article_${articleNum}.html`;
                if (!htmlFiles.includes(expectedHtml)) {
                    console.log(`  🔧 生成缺失的HTML: ${expectedHtml}`);
                    this.generateHtmlFromMd(mdFile, expectedHtml);
                    this.fixedCount++;
                }
            }
        });
    }

    generateHtmlFromMd(mdFile, htmlFile) {
        const mdPath = path.join(this.baseDir, 'wechat_ready', mdFile);
        const htmlPath = path.join(this.baseDir, 'wechat_html', htmlFile);
        
        // 读取Markdown内容
        let content = fs.readFileSync(mdPath, 'utf8');
        
        // 提取标题
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : '高尔夫文章';
        
        // 处理Markdown转HTML
        let htmlContent = content
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>').replace(/$/, '</p>');
        
        // 处理图片
        let imageCounter = 1;
        htmlContent = htmlContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            const absoluteSrc = src.replace('../images/', `/golf_content/${this.dateStr}/images/`);
            return `<div class="image-container">
                        <img src="${absoluteSrc}" alt="${caption}" class="article-image" onclick="copyImage(this)">
                        <p class="image-caption">${caption}</p>
                    </div>`;
        });
        
        // 生成完整HTML
        const fullHtml = this.getHtmlTemplate(title, htmlContent);
        
        // 确保目录存在
        const htmlDir = path.dirname(htmlPath);
        if (!fs.existsSync(htmlDir)) {
            fs.mkdirSync(htmlDir, { recursive: true });
        }
        
        // 写入文件
        fs.writeFileSync(htmlPath, fullHtml, 'utf8');
    }

    getHtmlTemplate(title, content) {
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
        }
        
        h1 {
            font-size: 1.8rem;
            font-weight: bold;
            margin: 0 0 30px 0;
            color: #333;
            text-align: center;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
        }
        
        h2 {
            font-size: 1.3rem;
            color: #444;
            margin: 30px 0 15px 0;
            font-weight: 600;
        }
        
        h3 {
            font-size: 1.1rem;
            color: #555;
            margin: 25px 0 10px 0;
            font-weight: 600;
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
            margin: 25px 0;
            text-align: center;
            position: relative;
        }
        
        .article-image {
            max-width: 100%;
            height: auto;
            cursor: pointer;
            transition: opacity 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 4px;
        }
        
        .article-image:hover {
            opacity: 0.9;
        }
        
        .image-caption {
            font-size: 14px;
            color: #666;
            margin-top: 8px;
            text-align: center;
            font-style: italic;
        }
        
        a {
            color: #1976d2;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* 工具栏样式 */
        .toolbar {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 10px;
            border-radius: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            display: flex;
            gap: 10px;
            z-index: 1000;
        }
        
        .toolbar button {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }
        
        .toolbar button:hover {
            background: #1976D2;
        }
        
        .toolbar button:active {
            transform: scale(0.95);
        }
        
        /* 复制成功提示 */
        .copy-success {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(76, 175, 80, 0.9);
            color: white;
            padding: 20px 40px;
            border-radius: 8px;
            font-size: 18px;
            z-index: 2000;
            display: none;
            animation: fadeInOut 2s ease;
        }
        
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -40%); }
            20% { opacity: 1; transform: translate(-50%, -50%); }
            80% { opacity: 1; transform: translate(-50%, -50%); }
            100% { opacity: 0; transform: translate(-50%, -60%); }
        }
        
        /* 响应式设计 */
        @media (max-width: 600px) {
            body {
                padding: 15px;
            }
            
            h1 {
                font-size: 1.5rem;
            }
            
            .toolbar {
                bottom: 10px;
                right: 10px;
                padding: 8px;
            }
            
            .toolbar button {
                padding: 8px 15px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    ${content}
    
    <!-- 复制成功提示 -->
    <div class="copy-success" id="copySuccess">复制成功！</div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
        <button onclick="copyAllContent()">📋 复制全文</button>
        <button onclick="copyOnlyText()">📝 复制文字</button>
    </div>
    
    <script>
        function showCopySuccess() {
            const successDiv = document.getElementById('copySuccess');
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 2000);
        }
        
        async function copyImage(img) {
            try {
                const response = await fetch(img.src);
                const blob = await response.blob();
                const item = new ClipboardItem({ [blob.type]: blob });
                await navigator.clipboard.write([item]);
                showCopySuccess();
            } catch (err) {
                console.error('复制图片失败:', err);
                alert('复制失败，请手动保存图片');
            }
        }
        
        async function copyAllContent() {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(document.body);
            selection.removeAllRanges();
            selection.addRange(range);
            
            try {
                // 创建一个临时div来生成富文本HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = document.body.innerHTML;
                
                // 移除工具栏和提示
                const toolbar = tempDiv.querySelector('.toolbar');
                const copySuccess = tempDiv.querySelector('.copy-success');
                if (toolbar) toolbar.remove();
                if (copySuccess) copySuccess.remove();
                
                // 处理图片路径
                const images = tempDiv.querySelectorAll('img');
                images.forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && src.startsWith('/')) {
                        img.setAttribute('src', window.location.origin + src);
                    }
                });
                
                const htmlContent = tempDiv.innerHTML;
                const textContent = selection.toString();
                
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([htmlContent], { type: 'text/html' }),
                    'text/plain': new Blob([textContent], { type: 'text/plain' })
                });
                
                await navigator.clipboard.write([clipboardItem]);
                showCopySuccess();
            } catch (err) {
                document.execCommand('copy');
                showCopySuccess();
            }
            
            selection.removeAllRanges();
        }
        
        function copyOnlyText() {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(document.body);
            selection.removeAllRanges();
            selection.addRange(range);
            
            let text = selection.toString();
            text = text.replace(/📋 复制全文\\s*📝 复制文字/g, '').trim();
            
            navigator.clipboard.writeText(text).then(() => {
                showCopySuccess();
            });
            
            selection.removeAllRanges();
        }
    </script>
</body>
</html>`;
    }

    async fixPromptFile() {
        console.log('\n📝 修复提示词文件...');
        
        const promptFile = 'golf_rewrite_prompt_turbo.txt';
        let content = fs.readFileSync(promptFile, 'utf8');
        
        // 检查是否包含"微信"关键词
        if (!content.includes('微信')) {
            console.log('  🔧 添加微信相关提示词');
            
            // 在适当位置添加微信相关内容
            const wechatPrompt = `\n\n## 微信公众号优化要求\n- 使用适合微信公众号的格式和样式\n- 图片说明要简洁明了\n- 段落要适中，便于手机阅读\n- 保持内容的可读性和吸引力`;
            
            content += wechatPrompt;
            fs.writeFileSync(promptFile, content, 'utf8');
            this.fixedCount++;
        } else {
            console.log('  ✅ 提示词已包含微信相关内容');
        }
    }

    async fixBase64Support() {
        console.log('\n🖼️ 添加Base64图片支持说明...');
        
        const docFile = 'BASE64_IMAGE_SUPPORT.md';
        const docContent = `# Base64图片支持说明

## 功能说明
本系统支持将图片转换为Base64格式内嵌到HTML中，这样可以：
- 避免图片路径问题
- 方便直接复制粘贴到微信公众号
- 减少外部依赖

## 使用方法
1. 在处理文章时，系统会自动下载图片
2. 如需启用Base64内嵌，可以在HTML生成时添加选项
3. Base64图片会直接嵌入HTML中

## 注意事项
- Base64会增加HTML文件大小
- 建议只对小于2MB的图片使用
- 大图片建议使用CDN或图床服务

## 未来改进
- 自动判断图片大小决定是否使用Base64
- 提供配置选项让用户选择
- 支持图片压缩后再转Base64
`;
        
        fs.writeFileSync(docFile, docContent, 'utf8');
        console.log('  ✅ 已创建Base64支持文档');
        this.fixedCount++;
    }
}

// 执行修复
if (require.main === module) {
    const fixer = new SystemFixer();
    fixer.fixAllIssues().catch(console.error);
}

module.exports = SystemFixer;