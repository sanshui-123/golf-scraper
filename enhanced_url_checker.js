#!/usr/bin/env node

/**
 * 增强的URL重复检查器
 * 在处理新文章前，预先检查所有URL是否已存在
 */

const fs = require('fs');
const path = require('path');

class EnhancedUrlChecker {
    constructor() {
        this.allUrls = new Map(); // 存储所有已处理的URL
        this.loadAllUrls();
    }
    
    // 加载所有已处理的URL
    loadAllUrls() {
        console.log('📚 加载所有已处理的URL...');
        const baseDir = 'golf_content';
        
        if (!fs.existsSync(baseDir)) {
            return;
        }
        
        // 获取所有日期目录
        const dateDirs = fs.readdirSync(baseDir)
            .filter(dir => {
                const fullPath = path.join(baseDir, dir);
                return fs.statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dir);
            })
            .sort();
        
        let totalUrls = 0;
        
        dateDirs.forEach(dateDir => {
            const urlsJsonPath = path.join(baseDir, dateDir, 'article_urls.json');
            
            if (fs.existsSync(urlsJsonPath)) {
                try {
                    const urlMapping = JSON.parse(fs.readFileSync(urlsJsonPath, 'utf8'));
                    
                    Object.entries(urlMapping).forEach(([articleNum, url]) => {
                        const normalizedUrl = this.normalizeUrl(url);
                        
                        if (!this.allUrls.has(normalizedUrl)) {
                            this.allUrls.set(normalizedUrl, []);
                        }
                        
                        this.allUrls.get(normalizedUrl).push({
                            date: dateDir,
                            articleNum: articleNum,
                            originalUrl: url
                        });
                        
                        totalUrls++;
                    });
                } catch (e) {
                    console.error(`❌ 读取 ${urlsJsonPath} 失败:`, e.message);
                }
            }
        });
        
        console.log(`✅ 已加载 ${totalUrls} 个URL，发现 ${this.allUrls.size} 个唯一URL\n`);
    }
    
    // 标准化URL
    normalizeUrl(url) {
        return url
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '')
            .replace(/\?.*$/, '')
            .replace(/#.*$/, '');
    }
    
    // 检查URL是否存在
    checkUrl(url) {
        const normalizedUrl = this.normalizeUrl(url);
        const existing = this.allUrls.get(normalizedUrl);
        
        if (existing && existing.length > 0) {
            return {
                exists: true,
                locations: existing
            };
        }
        
        return {
            exists: false,
            locations: []
        };
    }
    
    // 批量检查URL
    checkUrls(urls) {
        console.log(`🔍 检查 ${urls.length} 个URL的重复情况...\n`);
        
        const results = {
            total: urls.length,
            unique: [],
            duplicates: []
        };
        
        urls.forEach(url => {
            const checkResult = this.checkUrl(url);
            
            if (checkResult.exists) {
                results.duplicates.push({
                    url: url,
                    normalizedUrl: this.normalizeUrl(url),
                    existingLocations: checkResult.locations
                });
                
                console.log(`❌ 重复: ${url}`);
                checkResult.locations.forEach(loc => {
                    console.log(`   已存在于: ${loc.date}/文章${loc.articleNum}`);
                });
            } else {
                results.unique.push(url);
                console.log(`✅ 新URL: ${url}`);
            }
        });
        
        console.log(`\n📊 检查结果：`);
        console.log(`   总计: ${results.total}`);
        console.log(`   ✅ 新URL: ${results.unique.length}`);
        console.log(`   ❌ 重复: ${results.duplicates.length}`);
        
        return results;
    }
    
    // 查找所有重复的URL
    findAllDuplicates() {
        console.log('🔍 查找所有重复的URL...\n');
        
        const duplicates = [];
        
        this.allUrls.forEach((locations, normalizedUrl) => {
            if (locations.length > 1) {
                duplicates.push({
                    normalizedUrl: normalizedUrl,
                    locations: locations
                });
            }
        });
        
        if (duplicates.length > 0) {
            console.log(`❌ 发现 ${duplicates.length} 个重复的URL:\n`);
            
            duplicates.forEach(dup => {
                console.log(`URL: ${dup.locations[0].originalUrl}`);
                console.log('出现在:');
                dup.locations.forEach(loc => {
                    console.log(`  - ${loc.date}/文章${loc.articleNum}`);
                });
                console.log('');
            });
        } else {
            console.log('✅ 没有发现重复的URL！');
        }
        
        return duplicates;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const checker = new EnhancedUrlChecker();
    
    // 查找所有重复
    checker.findAllDuplicates();
    
    // 可以测试检查特定URL
    // const testUrls = [
    //     'https://mygolfspy.com/news-opinion/only-one-club-changed-in-scotties-bag-this-week/'
    // ];
    // checker.checkUrls(testUrls);
}

module.exports = EnhancedUrlChecker;