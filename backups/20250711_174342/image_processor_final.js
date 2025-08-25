#!/usr/bin/env node

/**
 * 图片处理模块 - 最终封装版本
 * 功能：下载图片并替换文章中的图片占位符
 * 警告：此文件为封装版本，禁止修改，只能调用！
 */

const fs = require('fs');
const path = require('path');

class ImageProcessorFinal {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.imagesDir = path.join(baseDir, 'images');
        
        // 确保图片目录存在
        if (!fs.existsSync(this.imagesDir)) {
            fs.mkdirSync(this.imagesDir, { recursive: true });
        }
    }

    /**
     * 下载图片（带重试机制）
     * @param {object} browser - Playwright浏览器实例
     * @param {array} images - 图片信息数组 [{url, alt}, ...]
     * @param {string} articleNum - 文章编号（如 "02"）
     * @returns {Promise<array>} - 返回处理后的图片数组
     */
    async downloadImages(browser, images, articleNum) {
        return await Promise.all(images.map(async (img, i) => {
            const filename = `article_${articleNum}_img_${i + 1}.jpg`;
            const filepath = path.join(this.imagesDir, filename);
            let downloaded = false;
            
            // 重试3次
            for (let retry = 0; retry < 3; retry++) {
                const page = await browser.newPage();
                try {
                    const response = await page.goto(img.url, { 
                        timeout: 15000, // 15秒超时
                        waitUntil: 'networkidle0' // 等待网络完全加载
                    });
                    const buffer = await response.body();
                    fs.writeFileSync(filepath, buffer);
                    img.filename = filename;
                    img.index = i + 1;
                    downloaded = true;
                    break;
                } catch (e) {
                    if (retry < 2) {
                        console.log(`  ⚠️ 图片下载失败，重试${retry + 2}/3: ${filename}`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } finally {
                    await page.close();
                }
            }
            
            if (!downloaded) {
                console.error(`  ❌ 图片下载失败(已重试3次): ${filename}`);
                img.index = i + 1; // 仍然设置index以便后续处理
            }
            
            return img;
        }));
    }

    /**
     * 替换文章中的图片占位符
     * @param {string} content - 文章内容
     * @param {array} images - 图片信息数组（需包含filename和index）
     * @returns {string} - 替换后的内容
     */
    replaceImagePlaceholders(content, images) {
        let result = content;
        
        images.forEach(img => {
            if (img.filename) {
                // 英文格式占位符
                const englishRegex = new RegExp(`\\[IMAGE_${img.index}:[^\\]]+\\]`, 'gi');
                // 中文格式占位符
                const chineseRegex = new RegExp(`\\[图片${img.index}：[^\\]]+\\]`, 'gi');
                
                const replacement = `![${img.alt || `图片${img.index}`}](../images/${img.filename})`;
                
                // 先尝试替换英文格式
                const beforeReplace = result;
                result = result.replace(englishRegex, replacement);
                
                // 如果没有替换成功，尝试中文格式
                if (beforeReplace === result) {
                    result = result.replace(chineseRegex, replacement);
                }
            }
        });
        
        return result;
    }

    /**
     * 提取文章中的图片占位符信息
     * @param {string} content - 文章内容
     * @returns {array} - 占位符信息数组
     */
    extractPlaceholders(content) {
        const placeholders = [];
        
        // 匹配英文格式
        const englishRegex = /\[IMAGE_(\d+):([^\]]+)\]/gi;
        let match;
        while ((match = englishRegex.exec(content)) !== null) {
            placeholders.push({
                full: match[0],
                index: parseInt(match[1]),
                description: match[2],
                type: 'english'
            });
        }
        
        // 匹配中文格式
        const chineseRegex = /\[图片(\d+)：([^\]]+)\]/gi;
        while ((match = chineseRegex.exec(content)) !== null) {
            placeholders.push({
                full: match[0],
                index: parseInt(match[1]),
                description: match[2],
                type: 'chinese'
            });
        }
        
        return placeholders;
    }
}

module.exports = ImageProcessorFinal;