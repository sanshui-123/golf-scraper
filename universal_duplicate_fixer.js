#!/usr/bin/env node
// universal_duplicate_fixer.js - 通用重复图片修复脚本，一次性解决所有问题

const fs = require('fs');
const path = require('path');

class UniversalDuplicateFixer {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.fixedArticles = [];
        this.errorArticles = [];
    }

    async runUniversalFix() {
        console.log('🌟 通用重复图片修复脚本');
        console.log('📋 这个脚本会检查并修复所有文章的重复图片问题\n');
        
        try {
            // 1. 扫描所有文章
            const problemArticles = await this.scanAllArticles();
            
            // 2. 批量修复
            if (problemArticles.length > 0) {
                await this.batchFixArticles(problemArticles);
            } else {
                console.log('✅ 没有发现重复图片问题');
            }
            
            // 3. 最终验证
            await this.finalVerification();
            
            // 4. 生成报告
            this.generateFinalReport();
            
        } catch (error) {
            console.error('❌ 修复过程中出现错误:', error.message);
        }
    }

    async scanAllArticles() {
        console.log('🔍 第一步：扫描所有文章的重复图片问题...\n');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        
        if (!fs.existsSync(wechatHtmlDir)) {
            console.log('❌ HTML目录不存在');
            return [];
        }
        
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        console.log(`📁 发现 ${htmlFiles.length} 个HTML文件`);
        
        const problemArticles = [];
        let totalImagesChecked = 0;
        let totalDuplicatesFound = 0;
        
        for (const htmlFile of htmlFiles) {
            const articleNum = htmlFile.match(/wechat_article_(\d+)\.html/)?.[1];
            if (!articleNum) continue;
            
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            
            // 提取图片容器
            const containerMatches = content.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
            
            if (containerMatches.length === 0) {
                console.log(`📄 文章${articleNum}: 无图片`);
                continue;
            }
            
            // 分析图片源
            const imgSources = [];
            const imgDetails = [];
            
            containerMatches.forEach((container, index) => {
                const imgMatch = container.match(/src="([^"]+)"/);
                if (imgMatch) {
                    const fullSrc = imgMatch[1];
                    const basename = path.basename(fullSrc);
                    imgSources.push(basename);
                    imgDetails.push({
                        index: index + 1,
                        basename: basename,
                        fullSrc: fullSrc,
                        container: container
                    });
                }
            });
            
            totalImagesChecked += imgSources.length;
            
            // 检查重复
            const uniqueSources = [...new Set(imgSources)];
            const duplicateCount = imgSources.length - uniqueSources.length;
            
            if (duplicateCount > 0) {
                totalDuplicatesFound += duplicateCount;
                
                // 统计每个图片的重复次数
                const sourceCounts = {};
                imgSources.forEach(src => {
                    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
                });
                
                const duplicateFiles = Object.entries(sourceCounts)
                    .filter(([src, count]) => count > 1)
                    .map(([src, count]) => ({ src, count }));
                
                problemArticles.push({
                    articleNum,
                    htmlFile,
                    htmlPath,
                    totalImages: imgSources.length,
                    uniqueImages: uniqueSources.length,
                    duplicateCount,
                    duplicateFiles,
                    imgDetails
                });
                
                console.log(`❌ 文章${articleNum}: ${imgSources.length} 个图片容器, ${uniqueSources.length} 张唯一图片 (${duplicateCount} 个重复)`);
                duplicateFiles.forEach(dup => {
                    console.log(`   🔄 ${dup.src}: 重复 ${dup.count} 次`);
                });
            } else {
                console.log(`✅ 文章${articleNum}: ${imgSources.length} 张图片，无重复`);
            }
        }
        
        console.log(`\n📊 扫描结果:`);
        console.log(`  总文件数: ${htmlFiles.length}`);
        console.log(`  总图片数: ${totalImagesChecked}`);
        console.log(`  有问题的文章: ${problemArticles.length}`);
        console.log(`  总重复图片: ${totalDuplicatesFound}`);
        
        return problemArticles;
    }

    async batchFixArticles(problemArticles) {
        console.log(`\n🔧 第二步：批量修复 ${problemArticles.length} 个有问题的文章...\n`);
        
        for (let i = 0; i < problemArticles.length; i++) {
            const article = problemArticles[i];
            console.log(`🎯 修复 ${i + 1}/${problemArticles.length}: 文章${article.articleNum}`);
            
            try {
                const result = await this.fixSingleArticle(article);
                if (result.success) {
                    this.fixedArticles.push({
                        articleNum: article.articleNum,
                        removedCount: result.removedCount,
                        finalCount: result.finalCount
                    });
                    console.log(`  ✅ 修复成功: 移除 ${result.removedCount} 个重复容器`);
                } else {
                    this.errorArticles.push({
                        articleNum: article.articleNum,
                        error: result.error
                    });
                    console.log(`  ❌ 修复失败: ${result.error}`);
                }
            } catch (error) {
                console.error(`  ❌ 修复异常: ${error.message}`);
                this.errorArticles.push({
                    articleNum: article.articleNum,
                    error: error.message
                });
            }
            
            // 简短暂停，避免IO压力
            if (i < problemArticles.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    async fixSingleArticle(article) {
        try {
            let content = fs.readFileSync(article.htmlPath, 'utf8');
            let newContent = content;
            
            const seenImages = new Set();
            let removedCount = 0;
            
            // 按顺序处理每个图片详情
            article.imgDetails.forEach(detail => {
                if (seenImages.has(detail.basename)) {
                    // 移除重复的容器
                    newContent = newContent.replace(detail.container, '');
                    removedCount++;
                } else {
                    // 记录已见过的图片
                    seenImages.add(detail.basename);
                }
            });
            
            // 清理多余空白
            newContent = newContent
                .replace(/\n{3,}/g, '\n\n')
                .replace(/\s{3,}/g, ' ')
                .trim();
            
            // 验证修复结果
            const newContainerMatches = newContent.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
            const finalCount = newContainerMatches.length;
            
            if (removedCount > 0) {
                // 备份原文件
                const backupPath = article.htmlPath + '.universal-backup-' + Date.now();
                fs.writeFileSync(backupPath, content, 'utf8');
                
                // 保存修复后的文件
                fs.writeFileSync(article.htmlPath, newContent, 'utf8');
                
                console.log(`    💾 备份: ${path.basename(backupPath)}`);
            }
            
            return {
                success: true,
                removedCount,
                finalCount,
                originalCount: article.totalImages
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async finalVerification() {
        console.log('\n🔍 第三步：最终验证所有文章...\n');
        
        const wechatHtmlDir = path.join(this.baseDir, 'wechat_html');
        const htmlFiles = fs.readdirSync(wechatHtmlDir).filter(f => f.endsWith('.html'));
        
        let allClean = true;
        let totalArticles = 0;
        let totalImages = 0;
        
        for (const htmlFile of htmlFiles) {
            const articleNum = htmlFile.match(/wechat_article_(\d+)\.html/)?.[1];
            if (!articleNum) continue;
            
            totalArticles++;
            const htmlPath = path.join(wechatHtmlDir, htmlFile);
            const content = fs.readFileSync(htmlPath, 'utf8');
            
            const containerMatches = content.match(/<div class="image-container"[^>]*>[\s\S]*?<\/div>/g) || [];
            
            if (containerMatches.length > 0) {
                const imgSources = [];
                containerMatches.forEach(container => {
                    const imgMatch = container.match(/src="([^"]+)"/);
                    if (imgMatch) {
                        imgSources.push(path.basename(imgMatch[1]));
                    }
                });
                
                totalImages += imgSources.length;
                const uniqueSources = [...new Set(imgSources)];
                
                if (imgSources.length === uniqueSources.length) {
                    console.log(`✅ 文章${articleNum}: ${imgSources.length} 张图片，全部唯一`);
                } else {
                    console.log(`❌ 文章${articleNum}: 仍有重复图片！`);
                    allClean = false;
                }
            } else {
                console.log(`📄 文章${articleNum}: 无图片`);
            }
        }
        
        console.log(`\n📊 最终验证结果:`);
        console.log(`  检查文章: ${totalArticles} 个`);
        console.log(`  总图片数: ${totalImages} 张`);
        console.log(`  验证结果: ${allClean ? '✅ 全部通过' : '❌ 仍有问题'}`);
        
        return allClean;
    }

    generateFinalReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 通用重复图片修复完成报告');
        console.log('='.repeat(60));
        
        console.log(`\n🎯 修复统计:`);
        console.log(`  成功修复文章: ${this.fixedArticles.length} 个`);
        console.log(`  修复失败文章: ${this.errorArticles.length} 个`);
        
        if (this.fixedArticles.length > 0) {
            console.log(`\n✅ 修复成功的文章:`);
            this.fixedArticles.forEach(article => {
                console.log(`  - 文章${article.articleNum}: 移除 ${article.removedCount} 个重复，剩余 ${article.finalCount} 个图片`);
            });
        }
        
        if (this.errorArticles.length > 0) {
            console.log(`\n❌ 修复失败的文章:`);
            this.errorArticles.forEach(article => {
                console.log(`  - 文章${article.articleNum}: ${article.error}`);
            });
        }
        
        console.log(`\n🧪 测试建议:`);
        console.log('1. 强制刷新浏览器页面 (Ctrl+F5)');
        console.log('2. 测试问题页面:');
        console.log('   http://localhost:8080/golf_content/2025-07-12/wechat_html/wechat_article_11.html');
        console.log('3. 随机检查其他文章页面');
        console.log('4. 验证图片显示正常且无重复');
        
        if (this.fixedArticles.length > 0) {
            console.log('\n🎉 恭喜！重复图片问题已全面解决！');
        } else if (this.errorArticles.length === 0) {
            console.log('\n✨ 系统检查完成，未发现重复图片问题！');
        } else {
            console.log('\n⚠️ 部分文章修复失败，请检查错误信息！');
        }
    }
}

// 执行通用修复
if (require.main === module) {
    const fixer = new UniversalDuplicateFixer();
    fixer.runUniversalFix().catch(console.error);
}

module.exports = UniversalDuplicateFixer;