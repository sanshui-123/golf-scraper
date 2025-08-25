#!/usr/bin/env node

/**
 * 修复图片重复问题 - 增强版
 * 1. 识别并去除重复的图片标签
 * 2. 修复图片路径问题
 * 3. 为将来的处理启用去重功能
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DuplicateImageFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.imagesDir = path.join(this.baseDir, 'images');
        this.wechatReadyDir = path.join(this.baseDir, 'wechat_ready');
        this.wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        this.imageHashes = {};
    }

    // 计算图片文件的MD5哈希
    calculateFileHash(filepath) {
        try {
            const buffer = fs.readFileSync(filepath);
            return crypto.createHash('md5').update(buffer).digest('hex');
        } catch (e) {
            return null;
        }
    }

    // 构建图片哈希映射
    buildImageHashMap() {
        console.log('🔍 分析图片文件...');
        
        const imageFiles = fs.readdirSync(this.imagesDir)
            .filter(f => f.match(/\.(jpg|jpeg|png|gif|webp)$/i));
        
        const hashToFiles = {};
        
        imageFiles.forEach(file => {
            const filepath = path.join(this.imagesDir, file);
            const hash = this.calculateFileHash(filepath);
            
            if (hash) {
                if (!hashToFiles[hash]) {
                    hashToFiles[hash] = [];
                }
                hashToFiles[hash].push(file);
                this.imageHashes[file] = hash;
            }
        });
        
        // 找出重复的图片
        const duplicates = {};
        Object.entries(hashToFiles).forEach(([hash, files]) => {
            if (files.length > 1) {
                // 使用第一个文件作为主文件
                const primaryFile = files.sort()[0];
                files.forEach(file => {
                    if (file !== primaryFile) {
                        duplicates[file] = primaryFile;
                    }
                });
            }
        });
        
        console.log(`📊 发现 ${Object.keys(duplicates).length} 个重复图片`);
        
        return duplicates;
    }

    // 修复Markdown文件中的重复图片
    fixMarkdownFile(filepath, duplicates) {
        let content = fs.readFileSync(filepath, 'utf8');
        let changeCount = 0;
        
        // 查找所有图片引用
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const imageRefs = [];
        let match;
        
        while ((match = imageRegex.exec(content)) !== null) {
            const filename = path.basename(match[2]);
            imageRefs.push({
                fullMatch: match[0],
                alt: match[1],
                path: match[2],
                filename: filename,
                index: match.index
            });
        }
        
        // 检查连续重复的图片
        const toRemove = [];
        for (let i = 0; i < imageRefs.length - 1; i++) {
            const current = imageRefs[i];
            const next = imageRefs[i + 1];
            
            // 如果是重复的图片文件，或者是同一个哈希值的不同文件
            if (current.filename === next.filename || 
                (duplicates[next.filename] === current.filename) ||
                (this.imageHashes[current.filename] === this.imageHashes[next.filename])) {
                
                // 检查它们之间是否只有空白行
                const textBetween = content.substring(
                    current.index + current.fullMatch.length,
                    next.index
                ).trim();
                
                if (textBetween === '') {
                    toRemove.push(next);
                    changeCount++;
                }
            }
        }
        
        // 从后往前删除重复的图片（避免索引变化）
        toRemove.reverse().forEach(ref => {
            content = content.substring(0, ref.index) + 
                      content.substring(ref.index + ref.fullMatch.length);
        });
        
        // 替换重复文件名为主文件名
        Object.entries(duplicates).forEach(([duplicate, primary]) => {
            const regex = new RegExp(`(../images/)${duplicate}`, 'g');
            content = content.replace(regex, `$1${primary}`);
        });
        
        if (changeCount > 0) {
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`  ✅ 修复 ${path.basename(filepath)}: 移除 ${changeCount} 个重复图片`);
        }
        
        return changeCount;
    }

    // 修复HTML文件
    fixHtmlFile(filepath, duplicates) {
        let content = fs.readFileSync(filepath, 'utf8');
        let changeCount = 0;
        
        // 替换重复文件名
        Object.entries(duplicates).forEach(([duplicate, primary]) => {
            const regex = new RegExp(`(/images/)${duplicate}`, 'g');
            const newContent = content.replace(regex, `$1${primary}`);
            if (newContent !== content) {
                content = newContent;
                changeCount++;
            }
        });
        
        if (changeCount > 0) {
            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`  ✅ 修复 ${path.basename(filepath)}: 更新 ${changeCount} 个图片引用`);
        }
        
        return changeCount;
    }

    // 保存图片哈希记录
    saveImageHashes() {
        const hashesFile = path.join(this.baseDir, 'image_hashes.json');
        fs.writeFileSync(hashesFile, JSON.stringify(this.imageHashes, null, 2));
        console.log('💾 保存图片哈希记录');
    }

    // 主执行函数
    async run() {
        console.log('🚀 开始修复图片重复问题\n');
        
        // 检查目录
        if (!fs.existsSync(this.baseDir)) {
            console.error(`❌ 目录不存在: ${this.baseDir}`);
            return;
        }
        
        // 构建图片哈希映射
        const duplicates = this.buildImageHashMap();
        
        // 修复Markdown文件
        console.log('\n📝 修复Markdown文件...');
        const mdFiles = fs.readdirSync(this.wechatReadyDir)
            .filter(f => f.endsWith('.md'));
        
        let totalMdFixed = 0;
        mdFiles.forEach(file => {
            const filepath = path.join(this.wechatReadyDir, file);
            totalMdFixed += this.fixMarkdownFile(filepath, duplicates);
        });
        
        // 修复HTML文件
        console.log('\n🌐 修复HTML文件...');
        const htmlFiles = fs.readdirSync(this.wechatHtmlDir)
            .filter(f => f.endsWith('.html') && !f.includes('backup'));
        
        let totalHtmlFixed = 0;
        htmlFiles.forEach(file => {
            const filepath = path.join(this.wechatHtmlDir, file);
            totalHtmlFixed += this.fixHtmlFile(filepath, duplicates);
        });
        
        // 保存图片哈希记录
        this.saveImageHashes();
        
        // 可选：删除重复的图片文件
        if (Object.keys(duplicates).length > 0) {
            console.log('\n🗑️ 可以删除的重复图片文件:');
            Object.entries(duplicates).forEach(([duplicate, primary]) => {
                console.log(`  - ${duplicate} (使用 ${primary} 替代)`);
            });
            
            // 如果需要自动删除，取消下面的注释
            // Object.keys(duplicates).forEach(duplicate => {
            //     const filepath = path.join(this.imagesDir, duplicate);
            //     fs.unlinkSync(filepath);
            //     console.log(`  🗑️ 已删除: ${duplicate}`);
            // });
        }
        
        console.log('\n✅ 修复完成！');
        console.log(`📊 总计: 修复 ${totalMdFixed} 个Markdown重复，${totalHtmlFixed} 个HTML引用`);
    }
}

// 执行修复
const fixer = new DuplicateImageFixer();
fixer.run().catch(console.error);