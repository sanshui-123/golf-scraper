#!/usr/bin/env node
// direct_duplicate_fix.js - 直接修复图片重复问题

const fs = require('fs');
const path = require('path');

class DirectDuplicateFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
    }

    async runDirectFix() {
        console.log('🔧 直接修复图片重复问题...\n');
        
        // 直接检查和修复article_17
        await this.fixSpecificArticle('17');
        
        // 然后修复所有其他文章
        await this.fixAllArticles();
        
        console.log('\n✅ 直接修复完成！');
        console.log('🌐 请访问页面查看效果');
    }

    async fixSpecificArticle(articleNum) {
        console.log(`🎯 直接修复文章${articleNum}...`);
        
        const htmlFile = `wechat_article_${articleNum}.html`;
        const htmlPath = path.join(this.baseDir, 'wechat_html', htmlFile);
        
        if (!fs.existsSync(htmlPath)) {
            console.log(`❌ 文件不存在: ${htmlFile}`);
            return;
        }
        
        let content = fs.readFileSync(htmlPath, 'utf8');
        console.log(`📄 原文件大小: ${content.length} 字符`);
        
        // 1. 提取所有图片标签
        const imgMatches = content.match(/<img[^>]*>/g) || [];
        console.log(`📷 发现 ${imgMatches.length} 个图片标签`);
        
        if (imgMatches.length > 0) {
            // 2. 分析图片源
            const imgSources = [];
            imgMatches.forEach((imgTag, index) => {
                const srcMatch = imgTag.match(/src="([^"]+)"/);
                if (srcMatch) {
                    imgSources.push({
                        tag: imgTag,
                        src: srcMatch[1],
                        index: index
                    });
                    console.log(`  ${index + 1}. ${path.basename(srcMatch[1])}`);
                }
            });
            
            // 3. 检查重复
            const srcCounts = {};
            imgSources.forEach(img => {
                const basename = path.basename(img.src);
                srcCounts[basename] = (srcCounts[basename] || 0) + 1;
            });
            
            const duplicates = Object.entries(srcCounts).filter(([src, count]) => count > 1);
            
            if (duplicates.length > 0) {
                console.log(`🔄 发现重复图片:`);
                duplicates.forEach(([src, count]) => {
                    console.log(`  - ${src}: ${count} 次`);
                });
                
                // 4. 直接移除重复的图片标签和容器
                let newContent = content;
                const seenImages = new Set();
                
                // 找到所有图片容器
                const containerMatches = newContent.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
                console.log(`📦 发现 ${containerMatches.length} 个图片容器`);
                
                containerMatches.forEach((container, index) => {
                    const imgMatch = container.match(/src="([^"]+)"/);
                    if (imgMatch) {
                        const basename = path.basename(imgMatch[1]);
                        
                        if (seenImages.has(basename)) {
                            console.log(`  🗑️ 移除重复容器 ${index + 1}: ${basename}`);
                            newContent = newContent.replace(container, '');
                        } else {
                            seenImages.add(basename);
                            console.log(`  ✅ 保留容器 ${index + 1}: ${basename}`);
                        }
                    }
                });
                
                // 5. 清理空白和多余换行
                newContent = newContent
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/\s{3,}/g, ' ')
                    .trim();
                
                // 6. 保存修复后的文件
                const backupPath = htmlPath + '.duplicate-backup-' + Date.now();
                fs.writeFileSync(backupPath, content, 'utf8');
                fs.writeFileSync(htmlPath, newContent, 'utf8');
                
                console.log(`💾 已保存修复版本`);
                console.log(`📦 备份文件: ${path.basename(backupPath)}`);
                console.log(`📊 文件大小: ${content.length} → ${newContent.length} 字符`);
                
                // 7. 验证修复结果
                const newImgContainers = newContent.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
                console.log(`✅ 修复后图片容器数量: ${newImgContainers.length}`);
                
            } else {
                console.log('✅ 没有发现重复图片');
            }
        } else {
            console.log('⚠️ 没有发现图片标签');
        }
    }

    async fixAllArticles() {
        console.log('\n🔧 修复所有其他文章...');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        
        let fixedCount = 0;
        
        for (const htmlFile of htmlFiles) {
            const articleNum = htmlFile.match(/wechat_article_(\d+)\.html/)?.[1];
            if (!articleNum || articleNum === '17') continue; // 跳过已经处理的文章17
            
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            let content = fs.readFileSync(htmlPath, 'utf8');
            
            // 快速检查是否有重复
            const containerMatches = content.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
            
            if (containerMatches.length > 1) {
                const imgSources = [];
                containerMatches.forEach(container => {
                    const imgMatch = container.match(/src="([^"]+)"/);
                    if (imgMatch) {
                        imgSources.push(path.basename(imgMatch[1]));
                    }
                });
                
                const uniqueSources = [...new Set(imgSources)];
                
                if (imgSources.length !== uniqueSources.length) {
                    console.log(`🔄 修复文章${articleNum}: ${imgSources.length} → ${uniqueSources.length} 张图片`);
                    
                    // 应用相同的去重逻辑
                    let newContent = content;
                    const seenImages = new Set();
                    
                    containerMatches.forEach(container => {
                        const imgMatch = container.match(/src="([^"]+)"/);
                        if (imgMatch) {
                            const basename = path.basename(imgMatch[1]);
                            
                            if (seenImages.has(basename)) {
                                newContent = newContent.replace(container, '');
                            } else {
                                seenImages.add(basename);
                            }
                        }
                    });
                    
                    newContent = newContent.replace(/\n{3,}/g, '\n\n').trim();
                    
                    const backupPath = htmlPath + '.duplicate-backup-' + Date.now();
                    fs.writeFileSync(backupPath, content, 'utf8');
                    fs.writeFileSync(htmlPath, newContent, 'utf8');
                    
                    fixedCount++;
                } else {
                    console.log(`✅ 文章${articleNum}: 无重复图片`);
                }
            } else {
                console.log(`✅ 文章${articleNum}: 图片数量正常`);
            }
        }
        
        console.log(`📊 修复完成: ${fixedCount} 个文件有重复问题并已修复`);
    }
}

// 同时创建一个快速验证脚本
class QuickVerifier {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
    }

    verifyArticle17() {
        console.log('\n🔍 快速验证文章17...');
        
        const htmlFile = 'wechat_article_17.html';
        const htmlPath = path.join(this.baseDir, 'wechat_html', htmlFile);
        
        if (!fs.existsSync(htmlPath)) {
            console.log('❌ 文件不存在');
            return;
        }
        
        const content = fs.readFileSync(htmlPath, 'utf8');
        
        // 检查图片容器
        const containers = content.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
        console.log(`📦 图片容器数量: ${containers.length}`);
        
        // 检查图片源
        const imgSources = [];
        containers.forEach((container, index) => {
            const imgMatch = container.match(/src="([^"]+)"/);
            if (imgMatch) {
                const basename = path.basename(imgMatch[1]);
                imgSources.push(basename);
                console.log(`  ${index + 1}. ${basename}`);
            }
        });
        
        // 检查重复
        const uniqueSources = [...new Set(imgSources)];
        if (imgSources.length === uniqueSources.length) {
            console.log('✅ 没有重复图片');
        } else {
            console.log(`❌ 仍有重复: ${imgSources.length} 个总数, ${uniqueSources.length} 个唯一`);
            
            const duplicateCounts = {};
            imgSources.forEach(src => {
                duplicateCounts[src] = (duplicateCounts[src] || 0) + 1;
            });
            
            Object.entries(duplicateCounts).forEach(([src, count]) => {
                if (count > 1) {
                    console.log(`  🔄 ${src}: ${count} 次`);
                }
            });
        }
    }
}

// 执行修复
async function main() {
    // 先验证当前状态
    const verifier = new QuickVerifier();
    verifier.verifyArticle17();
    
    // 执行修复
    const fixer = new DirectDuplicateFixer();
    await fixer.runDirectFix();
    
    // 再次验证
    console.log('\n🔍 修复后验证:');
    verifier.verifyArticle17();
    
    console.log('\n🧪 测试建议:');
    console.log('1. 强制刷新页面 (Ctrl+F5)');
    console.log('2. 访问: http://localhost:8080/golf_content/2025-07-12/wechat_html/wechat_article_17.html');
    console.log('3. 检查是否还有重复图片');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { DirectDuplicateFixer, QuickVerifier };