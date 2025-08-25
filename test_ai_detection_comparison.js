#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class AIDetectionComparison {
    constructor() {
        this.golferDir = path.join(__dirname, 'golf_content', this.getToday(), 'wechat_ready');
    }

    getToday() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    extractText(content) {
        // 模拟系统的文本预处理逻辑
        let textContent = content;
        
        // 移除AI检测注释
        textContent = textContent.replace(/^<!-- AI检测:.*?-->\n/g, '');
        
        // 移除图片占位符
        textContent = textContent.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
        
        // 移除Markdown链接但保留文本
        textContent = textContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        
        return textContent.trim();
    }

    compareArticle(filename) {
        const filepath = path.join(this.golferDir, filename);
        
        if (!fs.existsSync(filepath)) {
            console.log(`文件不存在: ${filename}`);
            return;
        }

        const content = fs.readFileSync(filepath, 'utf8');
        
        // 提取原始内容（不包含AI检测注释）
        const rawContent = content.replace(/^<!-- AI检测:.*?-->\n/g, '');
        
        // 提取处理后的内容（模拟系统处理）
        const processedContent = this.extractText(content);
        
        console.log(`\n📄 文件: ${filename}`);
        console.log('━'.repeat(80));
        
        // 计算字符数差异
        const rawLength = rawContent.length;
        const processedLength = processedContent.length;
        const difference = rawLength - processedLength;
        const percentDiff = ((difference / rawLength) * 100).toFixed(2);
        
        console.log(`📊 文本长度对比:`);
        console.log(`   原始内容: ${rawLength} 字符`);
        console.log(`   处理后内容: ${processedLength} 字符`);
        console.log(`   差异: ${difference} 字符 (${percentDiff}%)`);
        
        // 显示被移除的内容
        const imageMatches = rawContent.match(/\[IMAGE_\d+:[^\]]+\]/g) || [];
        const linkMatches = rawContent.match(/\[([^\]]+)\]\([^)]+\)/g) || [];
        
        console.log(`\n🗑️  被移除的内容:`);
        console.log(`   图片占位符: ${imageMatches.length} 个`);
        if (imageMatches.length > 0) {
            imageMatches.slice(0, 3).forEach(img => {
                console.log(`     - ${img}`);
            });
            if (imageMatches.length > 3) {
                console.log(`     ... 还有 ${imageMatches.length - 3} 个`);
            }
        }
        
        console.log(`   Markdown链接: ${linkMatches.length} 个`);
        if (linkMatches.length > 0) {
            linkMatches.slice(0, 3).forEach(link => {
                console.log(`     - ${link}`);
            });
            if (linkMatches.length > 3) {
                console.log(`     ... 还有 ${linkMatches.length - 3} 个`);
            }
        }
        
        // 保存对比结果
        const comparisonFile = filepath.replace('.md', '_comparison.txt');
        const comparisonContent = `文件: ${filename}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【原始内容】（用于手动检测）
字符数: ${rawLength}
────────────────────────────────────────
${rawContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【处理后内容】（系统用于AI检测的内容）
字符数: ${processedLength}
────────────────────────────────────────
${processedContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【差异分析】
- 字符数差异: ${difference} (${percentDiff}%)
- 移除的图片占位符: ${imageMatches.length} 个
- 移除的Markdown链接: ${linkMatches.length} 个
`;

        fs.writeFileSync(comparisonFile, comparisonContent, 'utf8');
        console.log(`\n💾 对比结果已保存到: ${path.basename(comparisonFile)}`);
        
        return {
            filename,
            rawLength,
            processedLength,
            difference,
            percentDiff: parseFloat(percentDiff),
            imageCount: imageMatches.length,
            linkCount: linkMatches.length
        };
    }

    analyzeAll() {
        if (!fs.existsSync(this.golferDir)) {
            console.log('❌ 今日文章目录不存在');
            return;
        }

        const files = fs.readdirSync(this.golferDir)
            .filter(f => f.endsWith('.md') && f.startsWith('wechat_article_'));

        console.log(`\n🔍 分析AI检测差异原因`);
        console.log(`📁 目录: ${this.golferDir}`);
        console.log(`📊 文章数量: ${files.length}`);

        const results = [];
        
        // 分析前5篇文章
        const samplesToAnalyze = Math.min(5, files.length);
        for (let i = 0; i < samplesToAnalyze; i++) {
            const result = this.compareArticle(files[i]);
            if (result) {
                results.push(result);
            }
        }

        // 总结
        if (results.length > 0) {
            console.log(`\n\n📊 总体分析结果:`);
            console.log('━'.repeat(80));
            
            const avgDiff = results.reduce((sum, r) => sum + r.percentDiff, 0) / results.length;
            const totalImages = results.reduce((sum, r) => sum + r.imageCount, 0);
            const totalLinks = results.reduce((sum, r) => sum + r.linkCount, 0);
            
            console.log(`平均文本差异: ${avgDiff.toFixed(2)}%`);
            console.log(`总图片占位符: ${totalImages} 个`);
            console.log(`总Markdown链接: ${totalLinks} 个`);
            
            console.log(`\n💡 结论:`);
            console.log(`系统在进行AI检测前会自动移除以下内容：`);
            console.log(`1. 图片占位符 [IMAGE_X:描述]`);
            console.log(`2. Markdown链接格式（只保留链接文本）`);
            console.log(`\n这就是为什么自动检测和手动检测结果不同的原因。`);
            console.log(`\n建议：手动检测时，应该先移除这些格式，只检测纯文本内容。`);
        }
    }
}

// 执行分析
const analyzer = new AIDetectionComparison();
analyzer.analyzeAll();