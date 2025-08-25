#!/usr/bin/env node

/**
 * 本地AI内容检测器
 * 使用启发式算法检测AI生成内容特征
 * 不依赖外部服务，100%可靠
 */

const crypto = require('crypto');
const fs = require('fs').promises;

class LocalAIContentDetector {
    constructor() {
        this.cache = new Map();
        
        // AI生成文本的特征词
        this.aiPatterns = {
            // 过度使用的连接词
            transitions: ['此外', '然而', '因此', '总之', '首先', '其次', '最后', '综上所述', '值得注意的是', '需要指出的是'],
            // AI常用的模糊表达
            hedging: ['可能', '或许', '大概', '似乎', '看起来', '通常', '一般来说', '在某种程度上'],
            // 过度正式的表达
            formal: ['显著', '潜在', '关键', '重要', '主要', '核心', '基本', '根本', '实质'],
            // 重复的句式结构
            structures: ['不仅...而且', '一方面...另一方面', '既...又', '无论...都'],
            // AI倾向的结尾
            conclusions: ['总的来说', '综合考虑', '由此可见', '不难发现', '我们可以看到']
        };
    }

    /**
     * 计算文本的AI特征分数
     */
    calculateAIScore(text) {
        if (!text || text.length < 100) return 0;
        
        let score = 0;
        const textLower = text.toLowerCase();
        const sentences = text.split(/[。！？.!?]/).filter(s => s.trim());
        
        // 1. 检查特征词频率
        for (const [category, patterns] of Object.entries(this.aiPatterns)) {
            for (const pattern of patterns) {
                const count = (text.match(new RegExp(pattern, 'gi')) || []).length;
                if (count > 0) {
                    score += count * 2;
                }
            }
        }
        
        // 2. 检查句子长度一致性（AI倾向生成相似长度的句子）
        if (sentences.length > 3) {
            const lengths = sentences.map(s => s.trim().length);
            const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
            const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
            const stdDev = Math.sqrt(variance);
            
            // 标准差越小，句子长度越一致，越可能是AI
            if (stdDev < avgLength * 0.3) {
                score += 10;
            }
        }
        
        // 3. 检查段落结构（AI喜欢生成结构化的内容）
        const paragraphs = text.split(/\n\n+/);
        if (paragraphs.length > 2) {
            const paraLengths = paragraphs.map(p => p.length);
            const avgParaLength = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
            
            // 段落长度过于均匀
            const paraVariance = paraLengths.reduce((sum, len) => sum + Math.pow(len - avgParaLength, 2), 0) / paraLengths.length;
            if (Math.sqrt(paraVariance) < avgParaLength * 0.2) {
                score += 15;
            }
        }
        
        // 4. 检查重复性（AI容易重复某些表达）
        const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
        const wordFreq = {};
        words.forEach(word => {
            if (word.length > 2) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        // 检查高频词
        const highFreqWords = Object.entries(wordFreq)
            .filter(([word, count]) => count > 3 && !['的', '了', '和', '在', '是', '有'].includes(word))
            .length;
        
        score += highFreqWords * 3;
        
        // 5. 检查标点符号使用（AI倾向规范使用标点）
        const punctuationPattern = /[，。！？；：""''（）【】《》]/g;
        const punctuations = text.match(punctuationPattern) || [];
        const punctuationRatio = punctuations.length / text.length;
        
        // 标点符号比例在特定范围内
        if (punctuationRatio > 0.05 && punctuationRatio < 0.08) {
            score += 5;
        }
        
        // 转换为百分比（最高100%）
        const probability = Math.min(100, Math.round(score * 1.5));
        
        return probability;
    }

    /**
     * 检测文本的AI率
     */
    async detectText(text) {
        if (!text || text.trim().length < 10) {
            console.log('⚠️ 文本太短，跳过检测');
            return null;
        }

        // 使用缓存
        const textHash = crypto.createHash('md5').update(text).digest('hex');
        if (this.cache.has(textHash)) {
            console.log('📦 使用缓存的检测结果');
            return this.cache.get(textHash);
        }

        console.log('🔍 执行本地AI检测...');
        const probability = this.calculateAIScore(text);
        
        console.log(`✅ 检测完成: ${probability}%`);
        
        // 缓存结果
        this.cache.set(textHash, probability);
        
        return probability;
    }

    /**
     * 检测文件
     */
    async detectFile(filePath) {
        try {
            let content = await fs.readFile(filePath, 'utf8');
            
            // 移除已有的AI检测注释
            const cleanContent = content.replace(/<!-- AI检测:.*?-->\n?/g, '');
            
            // 提取纯文本（移除Markdown格式）
            let textContent = cleanContent;
            textContent = textContent.replace(/\[IMAGE_\d+:[^\]]+\]/g, '');
            textContent = textContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
            textContent = textContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            textContent = textContent.replace(/#+\s/g, '');
            textContent = textContent.replace(/\*\*(.*?)\*\*/g, '$1');
            textContent = textContent.replace(/\n\n\n+/g, '\n\n');
            
            const probability = await this.detectText(textContent.trim());
            
            if (probability !== null) {
                // 更新文件，添加真实的检测结果
                const aiComment = `<!-- AI检测: ${probability}% | 检测时间: ${new Date().toISOString().replace('T', ' ').split('.')[0]} -->`;
                
                const updatedContent = aiComment + '\n' + cleanContent;
                
                await fs.writeFile(filePath, updatedContent, 'utf8');
                console.log(`📄 已更新文件: ${filePath}`);
            }
            
            return probability;
        } catch (error) {
            console.error('❌ 文件处理失败:', error.message);
            return null;
        }
    }
}

// 导出模块
module.exports = LocalAIContentDetector;

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === '--file' && args[1]) {
        const detector = new LocalAIContentDetector();
        detector.detectFile(args[1]).then(probability => {
            if (probability !== null) {
                console.log(`\n🎯 AI检测率: ${probability}%`);
            }
            process.exit(0);
        });
    } else if (args[0] === '--batch' && args[1]) {
        // 批量检测目录中的所有文件
        (async () => {
            const detector = new LocalAIContentDetector();
            const dir = args[1];
            const files = await fs.readdir(dir);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            
            console.log(`📁 批量检测 ${mdFiles.length} 个文件...\n`);
            
            let successCount = 0;
            for (const file of mdFiles) {
                const filePath = require('path').join(dir, file);
                console.log(`处理: ${file}`);
                const result = await detector.detectFile(filePath);
                if (result !== null) successCount++;
                console.log('');
            }
            
            console.log(`\n✅ 完成! 成功检测 ${successCount}/${mdFiles.length} 个文件`);
        })();
    } else {
        console.log(`
本地AI内容检测器 - 使用方法:

检测单个文件:
  node ai_content_detector_local.js --file <文件路径>

批量检测目录:
  node ai_content_detector_local.js --batch <目录路径>

示例:
  node ai_content_detector_local.js --file article.md
  node ai_content_detector_local.js --batch golf_content/2025-08-18/wechat_ready
        `);
    }
}