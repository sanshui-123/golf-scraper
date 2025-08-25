#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');
const ImageProcessorFinal = require('./image_processor_final');
const WebsiteDuplicateChecker = require('./website_duplicate_checker');
const APIFailureHandler = require('./api_failure_handler');

class BatchArticleProcessor {
    constructor() {
        this.browser = null;
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.rewriter = new ArticleRewriterEnhanced();
        this.imageProcessor = new ImageProcessorFinal(this.baseDir);
        this.apiFailureHandler = new APIFailureHandler();
        this.ensureDirectories();
        
        // 加载网站配置
        try {
            this.websiteConfigs = JSON.parse(fs.readFileSync(path.join(__dirname, 'website_configs.json'), 'utf8'));
        } catch (e) {
            // 如果配置文件不存在，使用默认配置
            this.websiteConfigs = {
                'golfmonthly.com': {
                    selectors: {
                        title: 'h1',
                        article: 'article',
                        content: 'p, h2, h3',
                        heroImage: '.image-hero__padding img, article img:first-of-type',
                        contentImages: 'figure img'
                    }
                }
            };
        }
    }

    ensureDirectories() {
        ['images', 'wechat_ready', 'wechat_html'].forEach(dir => {
            const fullPath = path.join(this.baseDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }
    
    getWebsiteConfig(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            return this.websiteConfigs[domain] || this.websiteConfigs['golfmonthly.com'];
        } catch (e) {
            return this.websiteConfigs['golfmonthly.com'];
        }
    }

    // 🔧 修改1: 增强的获取下一个文章编号方法 - 防止图片覆盖
    getNextArticleNumber() {
        const wechatDir = path.join(this.baseDir, 'wechat_ready');
        const urlMapFile = path.join(this.baseDir, 'article_urls.json');
        let maxNum = 0;
        
        // 检查markdown文件编号
        if (fs.existsSync(wechatDir)) {
            const files = fs.readdirSync(wechatDir)
                .filter(f => f.match(/wechat_article_(\d+)\.md/))
                .map(f => parseInt(f.match(/wechat_article_(\d+)\.md/)[1]));
            if (files.length > 0) {
                maxNum = Math.max(...files);
            }
        }
        
        // 检查URL映射中的编号
        if (fs.existsSync(urlMapFile)) {
            try {
                const urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
                const nums = Object.keys(urlMapping).map(n => parseInt(n));
                if (nums.length > 0) {
                    maxNum = Math.max(maxNum, ...nums);
                }
            } catch (err) {}
        }
        
        // 额外检查图片文件夹中的编号
        const imagesDir = path.join(this.baseDir, 'images');
        if (fs.existsSync(imagesDir)) {
            const imageFiles = fs.readdirSync(imagesDir)
                .filter(f => f.match(/article_(\d+)_img_/))
                .map(f => parseInt(f.match(/article_(\d+)_img_/)[1]));
            if (imageFiles.length > 0) {
                maxNum = Math.max(maxNum, ...imageFiles);
            }
        }
        
        return String(maxNum + 1).padStart(2, '0');
    }

    // 🔧 修改2: 增强Claude输出验证
    validateClaudeOutput(stdout) {
        // 验证输出是否包含中文
        const hasChineseChars = /[\u4e00-\u9fa5]/.test(stdout);
        if (!hasChineseChars) {
            throw new Error('改写结果不包含中文内容');
        }
        
        // 验证是否有标题（以#开头）
        const hasTitle = /^#\s+.+/m.test(stdout.trim());
        if (!hasTitle) {
            throw new Error('改写结果缺少标题（应以#开头）');
        }
        
        return true;
    }

    async processArticles(urls) {
        console.log('🚀 批量处理文章（终极优化版）');
        
        // 1. 首先进行全局去重检测
        console.log('1️⃣ 全局去重检测...\n');
        const duplicateChecker = new WebsiteDuplicateChecker();
        const { newUrls, duplicateUrls } = duplicateChecker.displayResults(urls);
        
        if (newUrls.length === 0) {
            console.log('✅ 所有文章都已处理过，无需重复处理');
            console.log('👋 程序退出');
            return;
        }
        
        // 只处理新文章
        urls = newUrls;
        console.log(`📊 开始处理 ${urls.length} 篇新文章\n`);
        
        const totalStart = Date.now();
        
        // 2. 启动浏览器
        console.log('2️⃣ 启动浏览器...');
        this.browser = await chromium.launch({
            headless: true,
            executablePath: '/Users/sanshui/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });
        
        // 3. 并行抓取所有文章
        console.log('3️⃣ 并行抓取文章和图片...');
        const extractStart = Date.now();
        
        const articles = await Promise.all(urls.map(async (url, index) => {
            const page = await this.browser.newPage();
            
            // 处理特定网站的 cookies
            if (url.includes('mygolfspy.com')) {
                try {
                    const cookieFile = path.join(__dirname, 'cookies', 'mygolfspy_cookies.json');
                    const cookieData = fs.readFileSync(cookieFile, 'utf8');
                    const cookies = JSON.parse(cookieData);
                    await page.context().addCookies(cookies);
                } catch (e) {
                    // 忽略 cookie 加载错误
                }
            }
            
            try {
                // 获取网站配置
                const siteConfig = this.getWebsiteConfig(url);
                const selectors = siteConfig.selectors;
                
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                // 处理 MyGolfSpy 弹窗
                if (url.includes('mygolfspy.com')) {
                    await page.waitForTimeout(2000);
                    const popupSelectors = [
                        'button[aria-label*="close"]', 'button.close', '.close-button',
                        '[class*="close"]', 'text=×', 'text=X'
                    ];
                    for (const selector of popupSelectors) {
                        try {
                            const closeBtn = await page.locator(selector).first();
                            if (await closeBtn.isVisible({ timeout: 500 })) {
                                await closeBtn.click();
                                await page.waitForTimeout(1000);
                                break;
                            }
                        } catch (e) {}
                    }
                }
                
                // 等待文章容器
                try {
                    await page.waitForSelector(selectors.article || 'article', { timeout: 5000 });
                } catch (e) {
                    // 如果找不到article标签，尝试等待标题
                    await page.waitForSelector(selectors.title || 'h1', { timeout: 5000 });
                }
                
                // 快速提取
                const data = await page.evaluate((selectors) => {
                    const title = document.querySelector(selectors.title)?.innerText || '';
                    const article = document.querySelector(selectors.article);
                    
                    // 如果没有article容器，使用body或main
                    const contentContainer = article || document.querySelector('main') || document.body;
                    if (!contentContainer) return null;
                    
                    const images = [];
                    let content = `# ${title}\n\n`;
                    
                    // 获取所有内容元素（段落、标题、图片等）
                    const allElements = contentContainer.querySelectorAll('p, h2, h3, img, figure');
                    let imageCounter = 0;
                    
                    allElements.forEach(element => {
                        if (element.tagName === 'P') {
                            const text = element.innerText.trim();
                            if (text.length > 20) {
                                content += `${text}\n\n`;
                            }
                        }
                        else if (element.tagName === 'H2') {
                            const text = element.innerText.trim();
                            if (text) content += `\n## ${text}\n\n`;
                        }
                        else if (element.tagName === 'H3') {
                            const text = element.innerText.trim();
                            if (text) content += `\n### ${text}\n\n`;
                        }
                        else if (element.tagName === 'IMG' || element.tagName === 'FIGURE') {
                            // 处理图片
                            const img = element.tagName === 'FIGURE' ? element.querySelector('img') : element;
                            if (img && img.src && 
                                !img.closest('a') && 
                                !img.classList.contains('thumbnail') &&
                                !img.classList.contains('thumb') &&
                                img.width > 200) {
                                imageCounter++;
                                const alt = img.alt || element.querySelector('figcaption')?.innerText || `图片${imageCounter}`;
                                images.push({ url: img.src, alt: alt });
                                // 在原位置插入图片占位符
                                content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                            }
                        }
                    });
                    
                    return { title, content, images };
                }, selectors);
                
                // 使用封装的图片处理器下载图片
                // 先临时使用索引，稍后会分配实际编号
                const tempNum = String(index + 1).padStart(2, '0');
                data.images = await this.imageProcessor.downloadImages(this.browser, data.images, tempNum);
                
                console.log(`  ✅ 文章${tempNum} 抓取完成 (${data.images.length}张图片)`);
                
                return {
                    ...data,
                    url,
                    tempNum,  // 临时编号
                    images: data.images
                };
                
            } finally {
                await page.close();
            }
        }));
        
        console.log(`✅ 抓取完成 (${Date.now() - extractStart}ms)\n`);
        
        // 为每篇文章分配实际编号
        let currentNum = parseInt(this.getNextArticleNumber());
        articles.forEach(article => {
            article.articleNum = String(currentNum++).padStart(2, '0');
            // 更新图片文件名
            article.images.forEach((img, idx) => {
                if (img.filename) {
                    const oldFilename = img.filename;
                    const newFilename = `article_${article.articleNum}_img_${idx + 1}.jpg`;
                    const oldPath = path.join(this.baseDir, 'images', oldFilename);
                    const newPath = path.join(this.baseDir, 'images', newFilename);
                    
                    if (fs.existsSync(oldPath) && oldPath !== newPath) {
                        fs.renameSync(oldPath, newPath);
                        img.filename = newFilename;
                    }
                }
            });
        });
        
        // 4. 使用封装的Claude改写器（一篇一篇处理）
        console.log('4️⃣ Claude改写（逐篇处理）...');
        const rewriteStart = Date.now();
        
        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            console.log(`\n  📝 正在改写第 ${i + 1}/${articles.length} 篇文章...`);
            console.log(`     标题: ${article.title.substring(0, 50)}...`);
            
            try {
                const articleStart = Date.now();
                const rewrittenContent = await this.rewriter.rewriteArticle(article.title, article.content);
                
                // 🔧 修改4: 使用增强的验证
                this.validateClaudeOutput(rewrittenContent);
                
                article.rewrittenContent = rewrittenContent;
                
                const timeTaken = Math.round((Date.now() - articleStart) / 1000);
                console.log(`  ✅ 文章${article.articleNum} 改写完成 (耗时: ${timeTaken}秒)`);
                console.log(`  📝 输出长度: ${rewrittenContent.length} 字符`);
                console.log(`  🔤 前50字符: ${rewrittenContent.substring(0, 50)}...`);
                
                // 检查是否包含中文
                const hasChineseChars = /[\u4e00-\u9fa5]/.test(rewrittenContent);
                if (!hasChineseChars) {
                    console.log(`  ⚠️ 警告：输出不包含中文字符！`);
                }
                
                // 每篇文章改写后等待2秒，避免API压力
                if (i < articles.length - 1) {
                    console.log(`  ⏳ 等待2秒后处理下一篇...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (err) {
                console.error(`  ❌ 文章${article.articleNum} 改写失败:`, err.message);
                console.error('  跳过此文章，继续处理下一篇');
                article.rewrittenContent = null; // 标记为失败
                
                // 记录失败的文章
                this.apiFailureHandler.logFailedArticle(article.url, err.message);
            }
        }
        
        console.log(`✅ 改写完成 (${Date.now() - rewriteStart}ms)\n`);
        
        // 5. 保存文件
        console.log('5️⃣ 保存文件...');
        const saveStart = Date.now();
        
        // 过滤掉改写失败的文章
        const successArticles = articles.filter(a => a.rewrittenContent !== null);
        if (successArticles.length < articles.length) {
            console.log(`⚠️ ${articles.length - successArticles.length} 篇文章改写失败，已跳过`);
        }
        
        await Promise.all(successArticles.map(async article => {
            const num = article.articleNum;
            let content = article.rewrittenContent;
            
            // 使用封装的图片处理器替换占位符
            console.log(`  📸 文章${num}有 ${article.images.length} 张图片`);
            content = this.imageProcessor.replaceImagePlaceholders(content, article.images);
            
            // 添加底部
            if (!content.includes('查看原文')) {
                content += `\n\n---\n\n[查看原文](${article.url})`;
            }
            
            // 保存
            const mdFile = path.join(this.baseDir, 'wechat_ready', `wechat_article_${num}.md`);
            const htmlFile = path.join(this.baseDir, 'wechat_html', `wechat_article_${num}.html`);
            
            fs.writeFileSync(mdFile, content, 'utf8');
            fs.writeFileSync(htmlFile, this.generateHTML(article.title, content), 'utf8');
        }));
        
        // 更新URL映射（合并现有的）
        const urlMapFile = path.join(this.baseDir, 'article_urls.json');
        let urlMapping = {};
        
        // 先读取现有的映射
        if (fs.existsSync(urlMapFile)) {
            try {
                urlMapping = JSON.parse(fs.readFileSync(urlMapFile, 'utf8'));
            } catch (err) {
                console.log('⚠️ 读取现有URL映射失败，创建新的');
            }
        }
        
        // 添加新的映射
        successArticles.forEach(a => {
            urlMapping[a.articleNum] = a.url;
            // 标记成功的文章
            this.apiFailureHandler.markAsSuccess(a.url);
        });
        
        fs.writeFileSync(urlMapFile, JSON.stringify(urlMapping, null, 2), 'utf8');
        
        console.log(`✅ 保存完成 (${Date.now() - saveStart}ms)\n`);
        
        // 完成
        await this.browser.close();
        
        const totalTime = Date.now() - totalStart;
        console.log('='.repeat(50));
        console.log('✨ 批量处理完成！');
        console.log(`📊 处理统计:`);
        console.log(`   - 输入文章数: ${urls.length + duplicateUrls.length}`);
        console.log(`   - 跳过重复: ${duplicateUrls.length}`);
        console.log(`   - 实际处理: ${urls.length}`);
        console.log(`   - 成功完成: ${successArticles.length}`);
        console.log(`⏱️ 总耗时: ${Math.round(totalTime / 1000)}秒`);
        console.log(`📈 平均每篇: ${Math.round(totalTime / articles.length / 1000)}秒`);
        console.log('\n📱 访问 http://localhost:8080 查看内容');
    }

    generateHTML(title, content) {
        // 处理Markdown内容转换为HTML
        let htmlContent = content
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')  // 处理链接
            .replace(/\n\n/g, '</p><p>')
            .replace(/^/, '<p>').replace(/$/, '</p>');
        
        // 处理图片，添加点击复制功能
        let imageCounter = 1;
        htmlContent = htmlContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            // 将相对路径转换为绝对路径
            const absoluteSrc = src.replace('../images/', `/golf_content/${this.dateStr}/images/`);
            return `<div class="image-container">
                        <img src="${absoluteSrc}" alt="${caption}" class="article-image" onclick="copyImage(this)">
                        <p class="image-caption">${caption}</p>
                    </div>`;
        });
        
        // 完整的HTML模板
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
            margin: 30px 0;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .image-container:hover {
            transform: translateY(-2px);
        }
        
        .article-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        
        .article-image:hover {
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
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
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            z-index: 1000;
        }
        
        .btn {
            background: #1976d2;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin: 0 5px;
            transition: background 0.3s ease;
        }
        
        .btn:hover {
            background: #1565c0;
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
                font-size: 15px;
            }
            
            h1 {
                font-size: 1.5rem;
            }
            
            .toolbar {
                position: relative;
                top: auto;
                right: auto;
                margin-bottom: 20px;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button class="btn" onclick="copyAllContent()">📋 复制全文</button>
        <button class="btn" onclick="copyOnlyText()">📝 仅复制文字</button>
    </div>
    
    ${htmlContent}
    
    <div class="copy-success" id="copySuccess">✅ 已复制到剪贴板！</div>
    
    <script>
        // 复制图片功能
        async function copyImage(img) {
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
        
        // 备用复制方法
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
        
        // 复制全部内容（包含图片）
        function copyAllContent() {
            // 创建一个临时容器，只包含文章内容
            const tempDiv = document.createElement('div');
            tempDiv.style.fontSize = '15px';
            tempDiv.style.lineHeight = '1.8';
            tempDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
            
            // 获取所有内容元素，但排除工具栏和原文链接
            const contentElements = document.body.cloneNode(true);
            
            // 移除工具栏
            const toolbar = contentElements.querySelector('.toolbar');
            if (toolbar) toolbar.remove();
            
            // 移除复制成功提示
            const copySuccess = contentElements.querySelector('.copy-success');
            if (copySuccess) copySuccess.remove();
            
            // 移除原文链接段落
            const paragraphs = contentElements.querySelectorAll('p');
            paragraphs.forEach(p => {
                if (p.innerHTML.includes('查看原文') || p.innerHTML.includes('---')) {
                    p.remove();
                }
            });
            
            // 移除最后的空段落
            const lastP = contentElements.querySelector('p:last-child');
            if (lastP && lastP.innerHTML.trim() === '') {
                lastP.remove();
            }
            
            // 确保所有p标签有正确的样式
            contentElements.querySelectorAll('p').forEach(p => {
                p.style.fontSize = '15px';
                p.style.lineHeight = '1.8';
                p.style.margin = '15px 0';
            });
            
            // 确保标题有正确的样式
            contentElements.querySelectorAll('h1').forEach(h => {
                h.style.fontSize = '20px';
                h.style.fontWeight = 'bold';
                h.style.margin = '20px 0';
            });
            
            contentElements.querySelectorAll('h2').forEach(h => {
                h.style.fontSize = '18px';
                h.style.fontWeight = 'bold';
                h.style.margin = '20px 0 15px 0';
            });
            
            // 设置图片样式
            contentElements.querySelectorAll('img').forEach(img => {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.margin = '20px auto';
            });
            
            tempDiv.innerHTML = contentElements.innerHTML;
            
            // 获取纯文本内容（作为后备）
            const textContent = tempDiv.innerText;
            
            // 尝试复制富文本
            try {
                const clipboardItem = new ClipboardItem({
                    'text/html': new Blob([tempDiv.innerHTML], { type: 'text/html' }),
                    'text/plain': new Blob([textContent], { type: 'text/plain' })
                });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    showCopySuccess('全文已复制！（包含格式）');
                });
            } catch (err) {
                // 备用方法：复制纯文本
                copyOnlyText();
            }
        }
        
        // 复制纯文字内容
        function copyOnlyText() {
            let textContent = document.body.innerText;
            
            // 清理文本内容
            textContent = textContent
                .replace(/📋 复制全文\\s*📝 仅复制文字/g, '')
                .replace(/✅ 已复制到剪贴板！/g, '')
                .replace(/\\n{3,}/g, '\\n\\n')
                .trim();
            
            navigator.clipboard.writeText(textContent).then(() => {
                showCopySuccess('文字内容已复制！');
            }).catch(() => {
                // 备用方法
                const textarea = document.createElement('textarea');
                textarea.value = textContent;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showCopySuccess('文字内容已复制！');
            });
        }
        
        // 显示复制成功提示
        function showCopySuccess(message) {
            const successDiv = document.getElementById('copySuccess');
            successDiv.textContent = message;
            successDiv.classList.add('show');
            
            setTimeout(() => {
                successDiv.classList.remove('show');
            }, 2000);
        }
        
        // 图片加载错误处理
        document.querySelectorAll('.article-image').forEach(img => {
            img.onerror = function() {
                this.style.display = 'none';
                this.parentElement.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">图片加载失败</p>';
            };
        });
    </script>
</body>
</html>`;
    }
}

// 命令行执行
if (require.main === module) {
    const urls = [
        'https://example.com/article1',
        'https://example.com/article2',
        'https://example.com/article3'
    ];
    
    const processor = new BatchArticleProcessor();
    processor.processArticles(urls).catch(console.error);
}

module.exports = BatchArticleProcessor;