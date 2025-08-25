/**
 * Golf.com 专用图片处理器
 * 处理AVIF格式和特殊的图片抓取逻辑
 */

const path = require('path');
const fs = require('fs').promises;

class GolfComImageHandler {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
    }

    /**
     * 检测图片格式 - 改进版，支持更多JPEG变体和AVIF
     */
    detectImageFormat(buffer) {
        const header = buffer.slice(0, 12).toString('hex').toUpperCase();
        
        // JPEG - 放宽检测，所有FFD8开头的都是JPEG
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
        
        // AVIF - 检测AVIF格式
        if (buffer.slice(4, 12).toString('ascii') === 'ftypavif' ||
            buffer.slice(4, 12).toString('ascii') === 'ftypavis') {
            return 'avif';
        }
        
        return null;
    }

    /**
     * 验证图片 - 改进版验证逻辑
     */
    async validateImage(buffer, expectedFormat) {
        if (!buffer || buffer.length < 100) {
            console.log('图片数据太小或为空');
            return false;
        }

        const detectedFormat = this.detectImageFormat(buffer);
        
        // 如果检测到AVIF，这是有效的
        if (detectedFormat === 'avif') {
            console.log('检测到AVIF格式图片');
            return true;
        }
        
        // 对于JPEG，只要是FFD8开头就认为有效
        if (expectedFormat === 'jpg' || expectedFormat === 'jpeg') {
            const headerHex = buffer.slice(0, 2).toString('hex').toUpperCase();
            return headerHex === 'FFD8';
        }
        
        return detectedFormat === expectedFormat;
    }

    /**
     * Golf.com专用图片下载
     */
    async downloadImage(page, imageUrl, savePath, index) {
        console.log(`\n[Golf.com] 开始下载图片 ${index}: ${imageUrl}`);
        
        try {
            // 方法1: 在页面上下文中使用fetch（推荐，能正确处理AVIF）
            const imageData = await page.evaluate(async (url) => {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Cache-Control': 'no-cache',
                            'Referer': window.location.href
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
                console.log(`[Golf.com] 方法1失败: ${imageData.error}`);
                
                // 方法2: 直接导航下载（备用方案）
                console.log('[Golf.com] 尝试方法2: 直接导航下载');
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
            console.log(`[Golf.com] 下载成功: ${imageData.contentLength} bytes, 类型: ${imageData.contentType}`);
            
            return await this.saveImage(buffer, savePath, index);
            
        } catch (error) {
            console.error(`[Golf.com] 图片下载失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 保存图片，支持AVIF格式
     */
    async saveImage(buffer, savePath, index) {
        try {
            // 检测实际格式
            const format = this.detectImageFormat(buffer);
            
            if (!format) {
                console.log('[Golf.com] 无法识别图片格式');
                return null;
            }
            
            // 根据实际格式确定文件扩展名
            let extension = format;
            if (format === 'jpg') extension = 'jpg';
            else if (format === 'avif') extension = 'avif'; // 保留AVIF格式
            
            // 生成新的文件名，使用唯一索引
            const dir = path.dirname(savePath);
            const filename = `golf_image_${index}.${extension}`;
            const finalPath = path.join(dir, filename);
            
            // 保存图片
            await fs.writeFile(finalPath, buffer);
            console.log(`[Golf.com] 图片保存成功: ${finalPath} (${format}格式)`);
            
            return {
                originalUrl: '',
                localPath: finalPath,
                filename: filename,
                format: format,
                size: buffer.length
            };
            
        } catch (error) {
            console.error(`[Golf.com] 保存图片失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 批量下载Golf.com文章图片
     */
    async downloadArticleImages(page, images, articleDir, articleNum = 1) {
        console.log(`\n[Golf.com] 开始处理 ${images.length} 张图片 (文章${articleNum})`);
        
        const downloadedImages = [];
        const imagesDir = path.join(articleDir, 'images');
        
        // 确保图片目录存在
        try {
            await fs.mkdir(imagesDir, { recursive: true });
        } catch (error) {
            console.error(`创建图片目录失败: ${error.message}`);
            return downloadedImages;
        }
        
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
                
                // 跳过小图标和logo
                if (imageUrl.includes('logo') || imageUrl.includes('icon') || 
                    imageUrl.includes('avatar') || imageUrl.includes('placeholder')) {
                    console.log(`[Golf.com] 跳过图标/logo: ${imageUrl}`);
                    continue;
                }
                
                // 使用文章编号和图片编号生成唯一索引
                const uniqueIndex = `${articleNum}_${i + 1}`;
                const result = await this.downloadImage(page, imageUrl, savePath, uniqueIndex);
                
                if (result) {
                    downloadedImages.push({
                        ...result,
                        originalUrl: imageUrl,
                        alt: image.alt || `Golf.com图片${i + 1}`
                    });
                }
                
                // 添加延迟避免请求过快
                await page.waitForTimeout(1000);
                
            } catch (error) {
                console.error(`[Golf.com] 处理图片 ${i + 1} 失败: ${error.message}`);
            }
        }
        
        console.log(`\n[Golf.com] 图片下载完成: ${downloadedImages.length}/${images.length} 成功`);
        return downloadedImages;
    }

    /**
     * 获取Golf.com文章中的图片
     */
    async extractArticleImages(page) {
        return await page.evaluate(() => {
            const images = [];
            
            // Golf.com特定的图片选择器
            const selectors = [
                '.c-entry-content img',
                '.article-content img', 
                'figure.wp-block-image img',
                '.article-body img',
                '.content-body img',
                'picture img'
            ];
            
            selectors.forEach(selector => {
                const imgs = document.querySelectorAll(selector);
                imgs.forEach(img => {
                    // 获取最高质量的图片URL
                    let url = img.src || img.dataset.src || img.dataset.lazySrc;
                    
                    // 检查srcset获取更高质量的图片
                    if (img.srcset) {
                        const srcsetParts = img.srcset.split(',');
                        const lastPart = srcsetParts[srcsetParts.length - 1].trim();
                        const urlMatch = lastPart.match(/^(\S+)/);
                        if (urlMatch) {
                            url = urlMatch[1];
                        }
                    }
                    
                    // 检查picture元素中的source
                    const picture = img.closest('picture');
                    if (picture) {
                        const sources = picture.querySelectorAll('source');
                        sources.forEach(source => {
                            if (source.type === 'image/avif' && source.srcset) {
                                // 优先使用AVIF格式
                                const srcsetParts = source.srcset.split(',');
                                const lastPart = srcsetParts[srcsetParts.length - 1].trim();
                                const urlMatch = lastPart.match(/^(\S+)/);
                                if (urlMatch) {
                                    url = urlMatch[1];
                                }
                            }
                        });
                    }
                    
                    if (url && !images.some(i => i.url === url)) {
                        // 检查图片尺寸（如果可能）
                        const width = parseInt(img.width) || parseInt(img.getAttribute('width')) || 0;
                        if (width > 200 || width === 0) { // 0表示尺寸未知，也包含进来
                            images.push({
                                url: url,
                                alt: img.alt || img.title || '',
                                width: width,
                                height: parseInt(img.height) || parseInt(img.getAttribute('height')) || 0
                            });
                        }
                    }
                });
            });
            
            return images;
        });
    }
}

module.exports = GolfComImageHandler;