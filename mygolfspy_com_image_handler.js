/**
 * MyGolfSpy.com 专用图片处理器
 * 处理标准图片格式和MyGolfSpy特有的图片抓取逻辑
 */

const path = require('path');
const fs = require('fs').promises;

class MyGolfSpyImageHandler {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp'];
        this.cookieFile = path.join(__dirname, 'cookies', 'mygolfspy_cookies.json');
    }

    /**
     * 确保cookie目录存在
     */
    async ensureCookieDir() {
        const cookieDir = path.dirname(this.cookieFile);
        try {
            await fs.mkdir(cookieDir, { recursive: true });
        } catch (e) {}
    }

    /**
     * 加载保存的cookies
     */
    async loadCookies(context) {
        try {
            const cookieData = await fs.readFile(this.cookieFile, 'utf8');
            const cookies = JSON.parse(cookieData);
            await context.addCookies(cookies);
            console.log('[MyGolfSpy] ✅ 已加载保存的 cookies');
            return true;
        } catch (e) {
            console.log('[MyGolfSpy] 📌 没有找到保存的 cookies');
            return false;
        }
    }

    /**
     * 保存cookies
     */
    async saveCookies(context) {
        try {
            const cookies = await context.cookies();
            await fs.writeFile(this.cookieFile, JSON.stringify(cookies, null, 2));
            console.log('[MyGolfSpy] 💾 已保存 cookies');
        } catch (e) {
            console.error('[MyGolfSpy] ❌ 保存cookies失败:', e.message);
        }
    }

    /**
     * 处理MyGolfSpy的弹窗 - 支持多个弹窗
     */
    async handlePopups(page) {
        console.log('[MyGolfSpy] 🔍 检查是否有弹窗...');
        
        let totalClosed = 0;
        let attempts = 0;
        const maxAttempts = 5; // 最多尝试5次，避免无限循环
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`[MyGolfSpy] 第 ${attempts} 次尝试处理弹窗...`);
            
            // 等待弹窗加载
            await page.waitForTimeout(2000);
            
            let foundPopup = false;
            
            // 先尝试使用JavaScript直接处理所有弹窗
            const closedByJs = await page.evaluate(() => {
                let closed = 0;
                
                // 查找所有可能的弹窗元素
                const popupElements = document.querySelectorAll(`
                    [class*="modal"]:not([style*="display: none"]), 
                    [class*="popup"]:not([style*="display: none"]), 
                    [class*="overlay"]:not([style*="display: none"]),
                    [id*="modal"]:not([style*="display: none"]), 
                    [id*="popup"]:not([style*="display: none"]), 
                    [id*="overlay"]:not([style*="display: none"]),
                    [role="dialog"], [role="alertdialog"],
                    .fancybox-overlay, .lightbox-overlay
                `);
                
                popupElements.forEach(elem => {
                    const style = window.getComputedStyle(elem);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        // 尝试直接移除元素
                        elem.remove();
                        closed++;
                        console.log('Removed popup element:', elem.className || elem.id);
                    }
                });
                
                // 查找所有包含特定文本的弹窗
                const textPatterns = ['ENTER TO WIN', 'LEGEND SERIES', 'SUBSCRIBE', 'NEWSLETTER', 'JOIN'];
                textPatterns.forEach(pattern => {
                    const elements = Array.from(document.querySelectorAll('*')).filter(el => 
                        el.textContent && el.textContent.includes(pattern) && 
                        window.getComputedStyle(el).position === 'fixed'
                    );
                    
                    elements.forEach(elem => {
                        // 找到最外层的固定定位容器
                        let container = elem;
                        while (container.parentElement && container.parentElement !== document.body) {
                            const parentStyle = window.getComputedStyle(container.parentElement);
                            if (parentStyle.position === 'fixed' || parentStyle.position === 'absolute') {
                                container = container.parentElement;
                            } else {
                                break;
                            }
                        }
                        if (window.getComputedStyle(container).display !== 'none') {
                            container.style.display = 'none';
                            closed++;
                        }
                    });
                });
                
                // 恢复body滚动
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.documentElement.style.overflow = '';
                
                // 移除模态背景
                const backdrops = document.querySelectorAll('.modal-backdrop, .overlay-backdrop, [class*="backdrop"]');
                backdrops.forEach(backdrop => {
                    backdrop.remove();
                    closed++;
                });
                
                return closed;
            });
            
            if (closedByJs > 0) {
                console.log(`[MyGolfSpy] ✅ 使用JavaScript关闭了 ${closedByJs} 个弹窗元素`);
                totalClosed += closedByJs;
                foundPopup = true;
            }
            
            // 如果没有找到弹窗，尝试标准的关闭按钮
            if (!foundPopup) {
                const popupSelectors = [
                    // X 符号按钮
                    'button:has-text("×")',
                    'button:has-text("X")',
                    'button:has-text("✕")',
                    '[aria-label*="Close" i]',
                    '[aria-label*="Dismiss" i]',
                    '.close:visible',
                    '.close-button:visible',
                    'button.close:visible',
                    '[class*="close"]:visible:not(a)',
                    '[class*="dismiss"]:visible',
                    // 文本按钮
                    'button:has-text("No thanks")',
                    'button:has-text("Maybe later")',
                    'button:has-text("Not now")',
                    // 通用模态关闭
                    '[role="button"][aria-label*="close" i]',
                    'div[class*="modal"] button:visible',
                    'div[class*="popup"] button:visible'
                ];
                
                for (const selector of popupSelectors) {
                    try {
                        const closeBtn = page.locator(selector).first();
                        if (await closeBtn.isVisible({ timeout: 500 })) {
                            console.log(`[MyGolfSpy] 找到关闭按钮: ${selector}`);
                            await closeBtn.click({ force: true });
                            await page.waitForTimeout(1000);
                            foundPopup = true;
                            totalClosed++;
                            break;
                        }
                    } catch (e) {
                        // 继续下一个选择器
                    }
                }
            }
            
            // 如果还没有找到，尝试ESC键
            if (!foundPopup) {
                try {
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(1000);
                    console.log('[MyGolfSpy] 🎹 尝试ESC键关闭弹窗');
                } catch (e) {}
            }
            
            // 检查是否还有弹窗
            const stillHasPopup = await page.evaluate(() => {
                const popups = document.querySelectorAll('[class*="modal"]:not([style*="display: none"]), [class*="popup"]:not([style*="display: none"])');
                return Array.from(popups).some(popup => {
                    const style = window.getComputedStyle(popup);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                });
            });
            
            if (!stillHasPopup) {
                console.log('[MyGolfSpy] ✅ 所有弹窗已清除');
                break;
            }
            
            // 如果这次没有关闭任何弹窗，停止循环
            if (!foundPopup) {
                console.log('[MyGolfSpy] 没有找到更多可关闭的弹窗');
                break;
            }
        }
        
        console.log(`[MyGolfSpy] 总共关闭了 ${totalClosed} 个弹窗`);
        return totalClosed > 0;
    }

    /**
     * 检测图片格式 - 支持常见格式
     */
    detectImageFormat(buffer) {
        const header = buffer.slice(0, 12).toString('hex').toUpperCase();
        
        // JPEG - 所有FFD8开头的都是JPEG
        if (header.startsWith('FFD8')) {
            return 'jpg';
        }
        
        // PNG
        if (header.startsWith('89504E47')) {
            return 'png';
        }
        
        // WebP
        if (header.slice(16, 24) === '57454250') {
            return 'webp';
        }
        
        return null;
    }

    /**
     * 验证图片
     */
    async validateImage(buffer, expectedFormat) {
        if (!buffer || buffer.length < 100) {
            console.log('图片数据太小或为空');
            return false;
        }

        const detectedFormat = this.detectImageFormat(buffer);
        
        // 对于JPEG，只要是FFD8开头就认为有效
        if (expectedFormat === 'jpg' || expectedFormat === 'jpeg') {
            const headerHex = buffer.slice(0, 2).toString('hex').toUpperCase();
            return headerHex === 'FFD8';
        }
        
        return detectedFormat === expectedFormat;
    }

    /**
     * MyGolfSpy.com专用图片下载
     */
    async downloadImage(page, imageUrl, savePath, index) {
        console.log(`\n[MyGolfSpy] 开始下载图片 ${index}: ${imageUrl}`);
        
        try {
            // 方法1: 在页面上下文中使用fetch
            const imageData = await page.evaluate(async (url) => {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Cache-Control': 'no-cache',
                            'Referer': window.location.href,
                            'User-Agent': navigator.userAgent
                        }
                    });
                    
                    if (!response.ok) {
                        return { error: `HTTP ${response.status}` };
                    }
                    
                    const buffer = await response.arrayBuffer();
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                    
                    return {
                        base64,
                        contentType: response.headers.get('content-type'),
                        contentLength: buffer.byteLength
                    };
                } catch (error) {
                    return { error: error.message };
                }
            }, imageUrl);
            
            if (imageData.error) {
                console.log(`[MyGolfSpy] 方法1失败: ${imageData.error}`);
                
                // 方法2: 直接导航下载（备用方案）
                console.log('[MyGolfSpy] 尝试方法2: 直接导航下载');
                const response = await page.goto(imageUrl, { 
                    waitUntil: 'networkidle',
                    timeout: 30000 
                });
                
                if (!response || !response.ok()) {
                    throw new Error(`下载失败: HTTP ${response ? response.status() : 'null'}`);
                }
                
                const buffer = await response.body();
                return await this.saveImage(buffer, savePath, index);
            }
            
            // 处理base64数据
            const buffer = Buffer.from(imageData.base64, 'base64');
            console.log(`[MyGolfSpy] 下载成功: ${imageData.contentLength} bytes, 类型: ${imageData.contentType}`);
            
            return await this.saveImage(buffer, savePath, index);
            
        } catch (error) {
            console.error(`[MyGolfSpy] 图片下载失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 保存图片
     */
    async saveImage(buffer, savePath, index) {
        try {
            const format = this.detectImageFormat(buffer);
            if (!format) {
                console.log('[MyGolfSpy] 无法识别图片格式，尝试保存为JPEG');
            }
            
            // 确定最终的文件路径
            const ext = format || 'jpg';
            const finalPath = savePath.replace(/\.\w+$/, `.${ext}`);
            
            // 生成唯一的文件名
            const dir = path.dirname(finalPath);
            const filename = `mygolfspy_image_${index}.${ext}`;
            const uniquePath = path.join(dir, filename);
            
            // 保存文件
            await fs.writeFile(uniquePath, buffer);
            console.log(`[MyGolfSpy] ✅ 图片已保存: ${filename}`);
            
            return {
                filename,
                path: uniquePath,
                size: buffer.length,
                format: ext,
                downloaded: true
            };
        } catch (error) {
            console.error(`[MyGolfSpy] 保存图片失败: ${error.message}`);
            return null;
        }
    }

    /**
     * MyGolfSpy文章图片下载主方法
     */
    async downloadArticleImages(page, images, articleDir, articleNum) {
        console.log(`\n[MyGolfSpy] 下载 ${images.length} 张图片到 ${articleDir}`);
        
        // 调试：打印接收到的图片数组
        console.log('[MyGolfSpy] 接收到的图片数组:');
        images.slice(0, 3).forEach((img, i) => {
            console.log(`  图片${i + 1}:`, typeof img === 'string' ? img : img.url);
        });
        
        const downloadedImages = [];
        const imagesDir = path.join(articleDir, 'images');
        
        // 确保目录存在
        await fs.mkdir(imagesDir, { recursive: true });
        
        // 处理弹窗
        await this.handlePopups(page);
        
        // 下载每张图片
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const savePath = path.join(imagesDir, `temp_${i + 1}.jpg`);
            
            try {
                // 处理相对URL
                let imageUrl = image.url || image;
                if (typeof imageUrl === 'string' && !imageUrl.startsWith('http')) {
                    const baseUrl = await page.evaluate(() => window.location.origin);
                    imageUrl = new URL(imageUrl, baseUrl).href;
                }
                
                // 跳过小图标、logo和data URL
                if (imageUrl.includes('logo') || imageUrl.includes('icon') || 
                    imageUrl.includes('avatar') || imageUrl.includes('placeholder') ||
                    imageUrl.includes('.svg') || imageUrl.startsWith('data:')) {
                    console.log(`[MyGolfSpy] 跳过无效图片: ${imageUrl.substring(0, 50)}...`);
                    continue;
                }
                
                // 使用文章编号和图片编号生成唯一索引
                const uniqueIndex = `${articleNum}_${i + 1}`;
                const result = await this.downloadImage(page, imageUrl, savePath, uniqueIndex);
                
                if (result) {
                    downloadedImages.push({
                        ...result,
                        originalUrl: imageUrl,
                        alt: image.alt || `MyGolfSpy图片${i + 1}`
                    });
                }
                
                // 添加延迟避免请求过快
                await page.waitForTimeout(1000);
                
            } catch (error) {
                console.error(`[MyGolfSpy] 处理图片 ${i + 1} 失败: ${error.message}`);
            }
        }
        
        console.log(`[MyGolfSpy] 图片下载完成: ${downloadedImages.length}/${images.length} 成功`);
        return downloadedImages;
    }

    /**
     * 从MyGolfSpy文章页面提取图片
     */
    async extractImages(page) {
        return await page.evaluate(() => {
            const images = [];
            
            // 文章内容区域的选择器
            const contentSelectors = [
                '.entry-content',
                '.post-content',
                '.article-content',
                '.content-area',
                'article',
                '[class*="content"]'
            ];
            
            let contentArea = null;
            for (const selector of contentSelectors) {
                contentArea = document.querySelector(selector);
                if (contentArea) break;
            }
            
            if (!contentArea) {
                contentArea = document.body;
            }
            
            // 查找所有图片
            const imgElements = contentArea.querySelectorAll('img');
            
            imgElements.forEach(img => {
                // 获取实际的图片URL
                let url = img.src || img.dataset.src || img.dataset.lazySrc;
                
                if (url && !url.includes('data:image')) {
                    // 获取图片尺寸
                    const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || 0;
                    const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
                    
                    // 过滤太小的图片（可能是图标）
                    if (width > 100 || height > 100 || (width === 0 && height === 0)) {
                        // 检查是否是MyGolfSpy的CDN图片
                        if (url.includes('mygolfspy.com') || url.includes('i0.wp.com')) {
                            images.push({
                                url: url,
                                alt: img.alt || '',
                                title: img.title || '',
                                width: width,
                                height: height
                            });
                        }
                    }
                }
            });
            
            return images;
        });
    }

    /**
     * 获取MyGolfSpy文章内容
     */
    async extractArticleContent(page) {
        return await page.evaluate(() => {
            const result = {
                title: '',
                content: '',
                images: []
            };
            
            // 提取标题
            const titleSelectors = [
                'h1.entry-title',
                'h1.post-title',
                'h1.article-title',
                '.entry-header h1',
                '.post-header h1',
                'h1'
            ];
            
            for (const selector of titleSelectors) {
                const titleEl = document.querySelector(selector);
                if (titleEl && titleEl.textContent.trim()) {
                    result.title = titleEl.textContent.trim();
                    break;
                }
            }
            
            // 提取内容
            const contentSelectors = [
                '.entry-content',
                '.post-content',
                '.article-content',
                '.content-area',
                '.post-body',
                '.article-body'
            ];
            
            for (const selector of contentSelectors) {
                const contentEl = document.querySelector(selector);
                if (contentEl) {
                    // 移除不需要的元素
                    const elementsToRemove = contentEl.querySelectorAll('script, style, .advertisement, .ads, .social-share, .related-posts');
                    elementsToRemove.forEach(el => el.remove());
                    
                    result.content = contentEl.textContent.trim();
                    break;
                }
            }
            
            return result;
        });
    }
}

module.exports = MyGolfSpyImageHandler;