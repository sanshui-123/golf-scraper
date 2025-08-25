#!/usr/bin/env node

/**
 * Today's Golfer 图片处理器
 * 专门处理 todays-golfer.com 的图片问题：
 * 1. 去除重复图片（同一张图片的不同尺寸版本）
 * 2. 优先选择大尺寸图片
 * 3. 保持正确的图片位置
 */

const fs = require('fs');
const path = require('path');

class TodaysGolferImageHandler {
    constructor() {
        this.processedUrls = new Set();
    }

    /**
     * 预处理图片列表，去除重复和小尺寸版本
     */
    preprocessImages(images) {
        console.log(`🏌️ Today's Golfer 图片预处理: ${images.length} 张原始图片`);
        
        const uniqueImages = [];
        const urlGroups = new Map(); // 用于分组相似的URL
        
        // 第一步：按URL分组
        images.forEach((img, index) => {
            const cleanUrl = this.extractBaseUrl(img.url);
            
            if (!urlGroups.has(cleanUrl)) {
                urlGroups.set(cleanUrl, []);
            }
            
            urlGroups.get(cleanUrl).push({
                ...img,
                originalIndex: index + 1
            });
        });
        
        // 第二步：从每组中选择最佳图片
        urlGroups.forEach((group, baseUrl) => {
            if (group.length === 1) {
                // 只有一张图片，直接使用
                uniqueImages.push(group[0]);
            } else {
                // 多张图片，选择最大的
                console.log(`  🔍 发现重复图片组 (${group.length} 张): ${baseUrl.substring(0, 50)}...`);
                
                const bestImage = this.selectBestImage(group);
                uniqueImages.push(bestImage);
                
                // 记录哪些图片被去除
                group.forEach(img => {
                    if (img !== bestImage) {
                        console.log(`    ⏭️ 去除重复: ${img.alt || `图片${img.originalIndex}`}`);
                    }
                });
            }
        });
        
        // 第三步：重新编号
        const finalImages = uniqueImages.map((img, index) => ({
            ...img,
            index: index + 1
        }));
        
        console.log(`  ✅ 去重完成: ${images.length} -> ${finalImages.length} 张图片`);
        
        return finalImages;
    }
    
    /**
     * 提取URL的基础部分（去除尺寸参数等）
     */
    extractBaseUrl(url) {
        // 移除常见的尺寸参数
        let baseUrl = url;
        
        // 移除查询参数中的尺寸信息
        baseUrl = baseUrl.replace(/[?&](w|width|h|height|size|resize|fit)=[^&]*/gi, '');
        
        // 移除URL路径中的尺寸信息（如 -150x150, -300x200 等）
        baseUrl = baseUrl.replace(/-\d+x\d+/g, '');
        
        // 移除WordPress的尺寸后缀（如 -scaled, -thumbnail 等）
        baseUrl = baseUrl.replace(/-(scaled|thumbnail|medium|large|full)(\.\w+)?$/i, '$2');
        
        // 规范化URL
        baseUrl = baseUrl.replace(/\?$/, ''); // 移除末尾的?
        baseUrl = baseUrl.replace(/&$/, ''); // 移除末尾的&
        
        return baseUrl;
    }
    
    /**
     * 从一组相似图片中选择最佳的一张
     */
    selectBestImage(group) {
        // 优先级规则：
        // 1. 优先选择大尺寸版本（876x584）
        // 2. URL中包含 'full' 或 'original' 的
        // 3. URL中没有尺寸限制的
        // 4. URL最长的（通常包含更多信息）
        // 5. 第一个出现的（保持原始顺序）
        
        // 检查是否有大尺寸版本（876x584是todays-golfer的常见大尺寸）
        const largeSizeVersion = group.find(img => 
            img.url.includes('876x584') || 
            img.url.includes('1200x800') ||
            img.url.includes('1920x1080')
        );
        if (largeSizeVersion) {
            console.log(`    ✅ 选择大尺寸版本: ${largeSizeVersion.url.substring(0, 50)}...`);
            return largeSizeVersion;
        }
        
        // 检查是否有full或original版本
        const fullVersion = group.find(img => 
            img.url.toLowerCase().includes('full') || 
            img.url.toLowerCase().includes('original')
        );
        if (fullVersion) return fullVersion;
        
        // 检查是否有无尺寸限制的版本
        const noSizeVersion = group.find(img => 
            !img.url.match(/[?&](w|width|h|height|size)=/i) &&
            !img.url.match(/-\d+x\d+/)
        );
        if (noSizeVersion) return noSizeVersion;
        
        // 排除明显的小尺寸版本
        const nonSmallVersions = group.filter(img => 
            !img.url.includes('162x108') &&
            !img.url.includes('150x150') &&
            !img.url.includes('300x200') &&
            !img.url.includes('120x120') &&
            !img.url.includes('85x85')
        );
        
        if (nonSmallVersions.length > 0) {
            // 从非小尺寸版本中选择URL最长的
            return nonSmallVersions.reduce((prev, curr) => 
                curr.url.length > prev.url.length ? curr : prev
            );
        }
        
        // 如果都是小尺寸，选择第一个
        return group[0];
    }
    
    /**
     * 检查图片是否应该被过滤
     */
    shouldFilterImage(url) {
        // 过滤掉明确的小尺寸图片
        const smallSizePatterns = [
            /-150x150/,
            /-300x200/,
            /-thumbnail/,
            /[?&]w=150/,
            /[?&]width=150/,
            /-small\./
        ];
        
        return smallSizePatterns.some(pattern => pattern.test(url));
    }
    
    /**
     * 下载单张图片（集成到主处理流程）
     */
    async downloadImage(page, img, articleNum, imagesDir) {
        const filename = `article_${articleNum}_img_${img.index}.webp`;
        const filepath = path.join(imagesDir, filename);
        
        try {
            // 如果文件已存在，跳过
            if (fs.existsSync(filepath)) {
                console.log(`    ⏭️ 文件已存在: ${filename}`);
                return {
                    ...img,
                    filename,
                    downloaded: true
                };
            }
            
            // 尝试下载
            const response = await page.goto(img.url, {
                timeout: 15000,
                waitUntil: 'networkidle0'
            });
            
            if (response && response.ok()) {
                const buffer = await response.body();
                
                // 验证是否为有效图片
                if (this.isValidImage(buffer)) {
                    fs.writeFileSync(filepath, buffer);
                    console.log(`    ✅ 下载成功: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);
                    
                    return {
                        ...img,
                        filename,
                        downloaded: true
                    };
                }
            }
            
            throw new Error('Invalid image data');
            
        } catch (error) {
            console.error(`    ❌ 下载失败: ${error.message}`);
            return {
                ...img,
                filename: null,
                downloaded: false
            };
        }
    }
    
    /**
     * 验证图片数据是否有效
     */
    isValidImage(buffer) {
        if (!buffer || buffer.length < 1024) return false;
        
        const header = buffer.toString('hex', 0, 10).toUpperCase();
        
        // 检查常见图片格式
        if (header.startsWith('FFD8')) return true; // JPEG
        if (header.startsWith('89504E47')) return true; // PNG
        if (header.startsWith('47494638')) return true; // GIF
        if (header.startsWith('52494646')) return true; // WebP
        
        return false;
    }
    
    /**
     * 修复内容中的图片占位符
     */
    fixImagePlaceholders(content, images) {
        let fixedContent = content;
        const imageMap = new Map();
        
        // 建立新旧索引映射
        images.forEach((img, newIndex) => {
            if (img.originalIndex) {
                imageMap.set(img.originalIndex, newIndex + 1);
            }
        });
        
        // 替换所有图片占位符
        imageMap.forEach((newIndex, oldIndex) => {
            const oldPattern = new RegExp(`\\[IMAGE_${oldIndex}:([^\\]]+)\\]`, 'g');
            fixedContent = fixedContent.replace(oldPattern, `[IMAGE_${newIndex}:$1]`);
        });
        
        return fixedContent;
    }
}

module.exports = TodaysGolferImageHandler;