#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');
const ImageProcessorFinal = require('./image_processor_final');
// const WebsiteDuplicateChecker = require('./website_duplicate_checker'); // 🔧 不再使用本地检查
const APIFailureHandler = require('./api_failure_handler');
const generateEnhancedHTML = require('./enhanced_html_template');

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

    // 🔧 修改1: 增强的获取下一个文章编号方法 - 防止覆盖
    getNextArticleNumber() {
        const wechatDir = path.join(this.baseDir, 'wechat_ready');
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
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
        
        // 检查HTML文件编号
        if (fs.existsSync(wechatHtmlDir)) {
            const files = fs.readdirSync(wechatHtmlDir)
                .filter(f => f.match(/wechat_article_(\d+)\.html/))
                .map(f => parseInt(f.match(/wechat_article_(\d+)\.html/)[1]));
            if (files.length > 0) {
                maxNum = Math.max(maxNum, ...files);
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
        let processedContent = stdout.trim();
        const hasTitle = /^#\s+.+/m.test(processedContent);
        
        if (!hasTitle) {
            // 尝试修复：如果第一行不是标题格式，但有内容，则添加#
            const lines = processedContent.split('\n');
            if (lines.length > 0 && lines[0].trim()) {
                // 如果第一行不是空的，假设它是标题
                const firstLine = lines[0].trim();
                // 检查是否已经有其他级别的标题标记
                if (!firstLine.startsWith('#')) {
                    lines[0] = `# ${firstLine}`;
                    processedContent = lines.join('\n');
                    
                    // 再次验证
                    if (/^#\s+.+/m.test(processedContent)) {
                        return processedContent; // 返回修复后的内容
                    }
                }
            }
            throw new Error('改写结果缺少标题（应以#开头）');
        }
        
        return processedContent; // 返回验证后的内容（可能被修复过）
    }

    // 🆕 新增：调用Web服务器的URL检查API
    // 🔧 重要规则：只有Web服务器明确返回"存在"的URL才跳过，其他所有情况都处理
    async checkUrlsForDuplicates(urls) {
        try {
            console.log(`🔍 通过Web服务器检查 ${urls.length} 个URL是否重复...`);
            console.log('📌 规则：只有网站上确认存在的链接才跳过');
            
            const fetch = (await import('node-fetch')).default;
            const response = await fetch('http://localhost:8080/api/check-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls })
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            console.log(`📊 URL检查结果:`);
            console.log(`  ✅ 新URL: ${result.new}`);
            console.log(`  ⏭️  重复URL: ${result.existing}`);
            
            if (result.existing > 0) {
                console.log('\n⏭️  跳过的重复URL:');
                result.results
                    .filter(r => r.exists)
                    .forEach(item => {
                        console.log(`  ⏭️  ${item.url}`);
                        console.log(`      已存在于: ${item.foundIn.date}/${item.foundIn.filename}`);
                        console.log(`      标题: ${item.foundIn.title}`);
                    });
            }
            
            // 返回新的URL列表
            const newUrls = result.results
                .filter(r => !r.exists)
                .map(r => r.url);
                
            console.log(`\n🚀 将处理 ${newUrls.length} 个新URL\n`);
            return {
                newUrls,
                duplicateUrls: result.results.filter(r => r.exists).map(r => r.url),
                skippedCount: result.existing
            };
            
        } catch (error) {
            console.error('❌ Web服务器URL检查失败:', error.message);
            console.log('⚠️  无法连接到Web服务器，将处理所有URL...\n');
            
            // 🔧 新规则：如果Web服务器检查失败，就处理所有URL（因为无法确认是否存在）
            return {
                newUrls: urls,  // 处理所有URL
                duplicateUrls: [],
                skippedCount: 0
            };
        }
    }

    async processArticles(urls) {
        console.log('🚀 批量处理文章（增强URL检查版）');
        
        // 1. 🆕 使用增强的URL检查（优先使用Web服务器API）
        console.log('1️⃣ 智能URL重复检测...\n');
        const { newUrls, duplicateUrls, skippedCount } = await this.checkUrlsForDuplicates(urls);
        
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
        
        // 3. 串行处理每个文章（从抓取到改写完成）
        console.log('3️⃣ 开始逐个处理文章...\n');
        const extractStart = Date.now();
        
        // 🔧 修复：先为每个URL分配最终编号，避免临时编号冲突
        let currentNum = parseInt(this.getNextArticleNumber());
        const urlsWithNumbers = urls.map((url, index) => ({
            url,
            articleNum: String(currentNum + index).padStart(2, '0')
        }));
        
        const articles = [];
        
        // 串行处理每个文章
        for (let i = 0; i < urlsWithNumbers.length; i++) {
            const {url, articleNum} = urlsWithNumbers[i];
            console.log(`\n═══════════════════════════════════════════════════`);
            console.log(`📄 处理第 ${i + 1}/${urlsWithNumbers.length} 篇文章`);
            console.log(`🔗 URL: ${url}`);
            console.log(`📝 编号: article_${articleNum}`);
            console.log(`═══════════════════════════════════════════════════\n`);
            
            // 抓取文章内容
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
                                
                                // 检查是否与上一张图片重复（URL相同且紧邻）
                                const lastImage = images[images.length - 1];
                                const isDuplicateAdjacent = lastImage && 
                                                           lastImage.url === img.src &&
                                                           content.trim().endsWith(`[IMAGE_${imageCounter}:${lastImage.alt}]`);
                                
                                if (!isDuplicateAdjacent) {
                                    imageCounter++;
                                    const alt = img.alt || element.querySelector('figcaption')?.innerText || `图片${imageCounter}`;
                                    images.push({ url: img.src, alt: alt });
                                    // 在原位置插入图片占位符
                                    content += `[IMAGE_${imageCounter}:${alt}]\n\n`;
                                }
                            }
                        }
                    });
                    
                    return { title, content, images };
                }, selectors);
                
                // 使用封装的图片处理器下载图片
                // 🔧 修复：直接使用最终编号，避免覆盖
                data.images = await this.imageProcessor.downloadImages(this.browser, data.images, articleNum);
                
                console.log(`  ✅ 文章${articleNum} 抓取完成 (${data.images.length}张图片)`);
                
                const article = {
                    ...data,
                    url,
                    articleNum,  // 最终编号
                    images: data.images
                };
                
                await page.close();
                
                console.log(`\n  📝 开始改写文章...`);
                console.log(`     标题: ${article.title.substring(0, 50)}...`);
                
                // 直接在这里进行Claude改写
                try {
                    const articleStart = Date.now();
                    
                    // 🔧 预处理实时赛事报道内容
                    let processedContent = article.content;
                    let processedTitle = article.title;
                    
                    // 检测是否为实时赛事报道
                    const isLiveReport = processedTitle.toLowerCase().includes('live') || 
                                       processedTitle.toLowerCase().includes('leaderboard') ||
                                       processedContent.includes('pic.twitter.com') ||
                                       (processedContent.match(/\d{1,2}-under/g) || []).length > 5;
                    
                    if (isLiveReport) {
                        console.log(`  ⚠️ 检测到实时赛事报道...`);
                        
                        // 检查内容长度
                        const contentLength = processedContent.length;
                        const lineCount = processedContent.split('\n').length;
                        console.log(`  📏 内容长度: ${contentLength} 字符, ${lineCount} 行`);
                        
                        // 如果内容过长（超过8000字符或100行），跳过处理
                        if (contentLength > 8000 || lineCount > 100) {
                            console.log(`  ⏭️  内容过长，跳过此赛事报道`);
                            console.log(`  💡 提示：此类长篇实时报道建议手动处理`);
                            console.log(`\n✅ 第 ${i + 1}/${urlsWithNumbers.length} 篇文章处理完成（跳过）\n`);
                            
                            // 记录为失败，但标记原因
                            this.apiFailureHandler.logFailedArticle(article.url, '实时赛事报道内容过长，已跳过');
                            article.rewrittenContent = null;
                            articles.push(article);
                            continue; // 跳到下一篇文章
                        }
                    }
                    
                    // 正常改写流程
                    article.rewrittenContent = await this.claudeRewriter.rewriteArticle(
                        processedContent,
                        article.images,
                        this.createPrompt
                    );
                    
                    console.log(`  ✅ 改写完成 (${Date.now() - articleStart}ms)`);
                    console.log(`\n✅ 第 ${i + 1}/${urlsWithNumbers.length} 篇文章处理完成\n`);
                    
                } catch (error) {
                    console.error(`  ❌ 改写失败:`, error.message);
                    article.rewrittenContent = null;
                    
                    // 记录失败的文章
                    this.apiFailureHandler.logFailedArticle(article.url, `Claude改写失败: ${error.message}`);
                    
                    console.log(`\n⚠️ 第 ${i + 1}/${urlsWithNumbers.length} 篇文章处理失败\n`);
                }
                
                articles.push(article);
                
            } catch (error) {
                console.error(`\n❌ 文章抓取失败:`, error.message);
                await page.close();
                console.log(`\n⚠️ 第 ${i + 1}/${urlsWithNumbers.length} 篇文章处理失败\n`);
                continue;
            }
        }
        
        console.log(`\n═══════════════════════════════════════════════════`);
        console.log(`✅ 所有文章处理完成！`);
        console.log(`📊 总耗时: ${Date.now() - extractStart}ms`);
        console.log(`📊 成功处理: ${articles.filter(a => a.rewrittenContent).length}/${urlsWithNumbers.length} 篇`);
        console.log(`═══════════════════════════════════════════════════\n`);
                            foundFirstImage = true;
                            continue;
                        }
                        
                        currentSection.push(line);
                        currentSectionLength++;
                        
                        // 当达到限制或遇到自然分段点时，创建新分段
                        if (currentSectionLength >= maxSectionLines || 
                            (currentSectionLength > 30 && (line === '' || line.includes('##')))) {
                            if (currentSection.length > 0) {
                                sections.push(currentSection.join('\n'));
                                currentSection = [];
                                currentSectionLength = 0;
                            }
                        }
                    }
                    
                    // 添加最后一段
                    if (currentSection.length > 0) {
                        sections.push(currentSection.join('\n'));
                    }
                    
                    console.log(`  📦 内容分成 ${sections.length} 批进行处理`);
                    
                    // 4. 分批改写
                    let rewrittenParts = [];
                    
                    for (let i = 0; i < sections.length; i++) {
                        console.log(`  📝 处理第 ${i + 1}/${sections.length} 批...`);
                        
                        let sectionContent = sections[i];
                        if (i === 0) {
                            // 第一批包含标题和提示
                            sectionContent = `【这是一篇实时赛事报道的第1部分，请改写成中文】\n\n${titleAndFirstImage}${sectionContent}`;
                        } else {
                            // 后续批次
                            sectionContent = `【这是赛事报道的第${i + 1}部分，请继续改写】\n\n${sectionContent}`;
                        }
                        
                        try {
                            const partResult = await this.rewriter.rewriteArticle(`赛事报道第${i + 1}部分`, sectionContent);
                            
                            // 如果不是第一部分，移除可能重复的标题
                            if (i > 0) {
                                const cleanedResult = partResult.replace(/^#\s+.+\n\n/, '');
                                rewrittenParts.push(cleanedResult);
                            } else {
                                rewrittenParts.push(partResult);
                            }
                            
                            console.log(`  ✅ 第 ${i + 1} 批处理完成`);
                            
                            // 批次之间等待1秒
                            if (i < sections.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        } catch (err) {
                            console.error(`  ❌ 第 ${i + 1} 批处理失败:`, err.message);
                            throw err;
                        }
                    }
                    
                    // 5. 组合所有部分
                    const rewrittenContent = rewrittenParts.join('\n\n');
                    console.log(`  🔗 所有批次处理完成，组合成完整文章`);
                    
                    // 直接使用组合后的内容，跳过后面的常规处理
                    article.rewrittenContent = this.validateClaudeOutput(rewrittenContent);
                    
                    const timeTaken = Math.round((Date.now() - articleStart) / 1000);
                    console.log(`  ✅ 文章${article.articleNum} 改写完成 (耗时: ${timeTaken}秒)`);
                    console.log(`  📝 输出长度: ${article.rewrittenContent.length} 字符`);
                    
                    continue; // 跳到下一篇文章
                }
                
                // 非实时报道的常规处理
                const rewrittenContent = await this.rewriter.rewriteArticle(processedTitle, processedContent);
                
                // 🔧 修改4: 使用增强的验证（可能会修复内容）
                const validatedContent = this.validateClaudeOutput(rewrittenContent);
                
                article.rewrittenContent = validatedContent;
                
                const timeTaken = Math.round((Date.now() - articleStart) / 1000);
                console.log(`  ✅ 文章${article.articleNum} 改写完成 (耗时: ${timeTaken}秒)`);
                console.log(`  📝 输出长度: ${validatedContent.length} 字符`);
                console.log(`  🔤 前50字符: ${validatedContent.substring(0, 50)}...`);
                
                // 检查是否包含中文
                const hasChineseChars = /[\u4e00-\u9fa5]/.test(validatedContent);
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
        console.log(`   - 输入文章数: ${urls.length + skippedCount}`);
        console.log(`   - 跳过重复: ${skippedCount}`);
        console.log(`   - 实际处理: ${urls.length}`);
        console.log(`   - 成功完成: ${successArticles.length}`);
        console.log(`⏱️ 总耗时: ${Math.round(totalTime / 1000)}秒`);
        console.log(`📈 平均每篇: ${Math.round(totalTime / articles.length / 1000)}秒`);
        console.log('\n📱 访问 http://localhost:8080 查看内容');
    }

    generateHTML(title, content) {
        // 处理图片，必须先处理图片再处理链接
        let imageCounter = 1;
        let htmlContent = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const caption = alt || `图片${imageCounter}`;
            imageCounter++;
            // 将相对路径转换为绝对路径
            const absoluteSrc = src.replace('../images/', `/golf_content/${this.dateStr}/images/`);
            return `<div class="image-container">
                        <img src="${absoluteSrc}" alt="${caption}" class="article-image" onclick="copyImage(this)">
                    </div>`;
        });
        
        // 处理其他Markdown语法
        htmlContent = htmlContent
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');  // 处理链接
        
        // 🔧 重新设计段落处理逻辑，避免把标题和图片容器包在<p>标签里
        // 先按双换行分段
        const segments = htmlContent.split(/\n\n+/);
        const processedSegments = segments.map(segment => {
            segment = segment.trim();
            if (!segment) return '';
            
            // 如果是标题或图片容器，直接返回
            if (segment.match(/^<h[1-6]>/) || 
                segment.match(/^<div class="image-container">/) ||
                segment.match(/^<\/div>$/)) {
                return segment;
            }
            
            // 如果段落中包含HTML标签（比如图片容器），按行分割处理
            if (segment.includes('<div class="image-container">')) {
                const lines = segment.split('\n');
                let result = [];
                let currentParagraph = [];
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.match(/^<div class="image-container">/) || 
                        trimmedLine.match(/^<\/div>$/) ||
                        trimmedLine.match(/^\s*<img/)) {
                        // 如果当前有段落内容，先输出
                        if (currentParagraph.length > 0) {
                            result.push('<p>' + currentParagraph.join(' ').trim() + '</p>');
                            currentParagraph = [];
                        }
                        // 直接添加图片相关标签
                        result.push(trimmedLine);
                    } else if (trimmedLine) {
                        currentParagraph.push(trimmedLine);
                    }
                }
                
                // 处理剩余的段落内容
                if (currentParagraph.length > 0) {
                    result.push('<p>' + currentParagraph.join(' ').trim() + '</p>');
                }
                
                return result.join('\n');
            }
            
            // 普通文本段落，包装在<p>标签中
            return '<p>' + segment + '</p>';
        });
        
        htmlContent = processedSegments.filter(s => s).join('\n\n');
        
        // 使用增强版HTML模板
        return generateEnhancedHTML(title, htmlContent);
    }
    
}

// 命令行执行
if (require.main === module) {
    const urls = ['url1', 'url2', 'url3'];
    
    const processor = new BatchArticleProcessor();
    processor.processArticles(urls).catch(console.error);
}

module.exports = BatchArticleProcessor;