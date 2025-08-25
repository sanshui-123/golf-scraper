#!/usr/bin/env node
// system_diagnostic.js - 诊断现有功能是否正常工作

const fs = require('fs');
const path = require('path');

class SystemDiagnostic {
    constructor() {
        this.dateStr = new Date().toISOString().split('T')[0];
        this.baseDir = path.join(process.cwd(), 'golf_content', this.dateStr);
        this.issues = [];
        this.recommendations = [];
    }

    async runDiagnostic() {
        console.log('🔍 开始系统功能诊断...\n');
        
        // 1. 检查文件结构
        this.checkFileStructure();
        
        // 2. 检查核心模块
        this.checkCoreModules();
        
        // 3. 检查配置文件
        this.checkConfigFiles();
        
        // 4. 检查现有文章
        this.checkExistingArticles();
        
        // 5. 检查图片处理
        this.checkImageProcessing();
        
        // 6. 检查HTML生成
        this.checkHTMLGeneration();
        
        // 7. 检查微信复制功能
        this.checkWechatCopyFeatures();
        
        // 8. 生成报告
        this.generateReport();
    }

    checkFileStructure() {
        console.log('📁 检查文件结构...');
        
        const expectedFiles = [
            'batch_process_articles.js',
            'article_rewriter_enhanced.js',
            'image_processor_final.js',
            'website_configs.json',
            'golf_rewrite_prompt_turbo.txt'
        ];
        
        const expectedDirs = [
            'golf_content',
            path.join('golf_content', this.dateStr),
            path.join('golf_content', this.dateStr, 'images'),
            path.join('golf_content', this.dateStr, 'wechat_ready'),
            path.join('golf_content', this.dateStr, 'wechat_html')
        ];
        
        expectedFiles.forEach(file => {
            if (fs.existsSync(file)) {
                console.log(`  ✅ ${file}`);
            } else {
                console.log(`  ❌ ${file} - 缺失`);
                this.issues.push(`缺失核心文件: ${file}`);
            }
        });
        
        expectedDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                console.log(`  ✅ ${dir}/`);
            } else {
                console.log(`  ⚠️  ${dir}/ - 不存在，将自动创建`);
                this.recommendations.push(`创建目录: ${dir}`);
            }
        });
    }

    checkCoreModules() {
        console.log('\n🔧 检查核心模块...');
        
        // 检查 ArticleRewriterEnhanced
        try {
            const ArticleRewriterEnhanced = require('./article_rewriter_enhanced');
            const rewriter = new ArticleRewriterEnhanced();
            console.log('  ✅ ArticleRewriterEnhanced - 可加载');
            
            // 检查是否有关键方法
            if (typeof rewriter.rewriteArticle === 'function') {
                console.log('    ✅ rewriteArticle 方法存在');
            } else {
                console.log('    ❌ rewriteArticle 方法缺失');
                this.issues.push('ArticleRewriterEnhanced.rewriteArticle 方法缺失');
            }
        } catch (error) {
            console.log(`  ❌ ArticleRewriterEnhanced - 加载失败: ${error.message}`);
            this.issues.push(`ArticleRewriterEnhanced 模块问题: ${error.message}`);
        }
        
        // 检查 ImageProcessorFinal
        try {
            const ImageProcessorFinal = require('./image_processor_final');
            const imageProcessor = new ImageProcessorFinal(this.baseDir);
            console.log('  ✅ ImageProcessorFinal - 可加载');
            
            // 检查关键方法
            const methods = ['downloadImages', 'replaceImagePlaceholders'];
            methods.forEach(method => {
                if (typeof imageProcessor[method] === 'function') {
                    console.log(`    ✅ ${method} 方法存在`);
                } else {
                    console.log(`    ❌ ${method} 方法缺失`);
                    this.issues.push(`ImageProcessorFinal.${method} 方法缺失`);
                }
            });
        } catch (error) {
            console.log(`  ❌ ImageProcessorFinal - 加载失败: ${error.message}`);
            this.issues.push(`ImageProcessorFinal 模块问题: ${error.message}`);
        }
    }

    checkConfigFiles() {
        console.log('\n⚙️ 检查配置文件...');
        
        // 检查 website_configs.json
        if (fs.existsSync('website_configs.json')) {
            try {
                const configs = JSON.parse(fs.readFileSync('website_configs.json', 'utf8'));
                console.log('  ✅ website_configs.json - 格式正确');
                
                const sites = Object.keys(configs);
                console.log(`    📋 配置的网站: ${sites.join(', ')}`);
                
                // 检查必要字段
                sites.forEach(site => {
                    const config = configs[site];
                    if (config.selectors) {
                        console.log(`    ✅ ${site} - 有选择器配置`);
                    } else {
                        console.log(`    ⚠️ ${site} - 缺少选择器配置`);
                        this.recommendations.push(`为 ${site} 添加选择器配置`);
                    }
                });
            } catch (error) {
                console.log(`  ❌ website_configs.json - 格式错误: ${error.message}`);
                this.issues.push(`website_configs.json 格式问题: ${error.message}`);
            }
        } else {
            console.log('  ❌ website_configs.json - 缺失');
            this.issues.push('缺失 website_configs.json 配置文件');
        }
        
        // 检查提示词文件
        if (fs.existsSync('golf_rewrite_prompt_turbo.txt')) {
            const promptContent = fs.readFileSync('golf_rewrite_prompt_turbo.txt', 'utf8');
            console.log('  ✅ golf_rewrite_prompt_turbo.txt - 存在');
            console.log(`    📝 提示词长度: ${promptContent.length} 字符`);
            
            // 检查关键词
            const keywords = ['高尔夫', '中文', '微信', '改写'];
            const missingKeywords = keywords.filter(keyword => !promptContent.includes(keyword));
            if (missingKeywords.length === 0) {
                console.log('    ✅ 包含必要的关键词');
            } else {
                console.log(`    ⚠️ 缺少关键词: ${missingKeywords.join(', ')}`);
                this.recommendations.push(`在提示词中添加: ${missingKeywords.join(', ')}`);
            }
        } else {
            console.log('  ❌ golf_rewrite_prompt_turbo.txt - 缺失');
            this.issues.push('缺失 golf_rewrite_prompt_turbo.txt 提示词文件');
        }
    }

    checkExistingArticles() {
        console.log('\n📰 检查现有文章...');
        
        const articleDir = path.join(this.baseDir, 'wechat_ready');
        const htmlDir = path.join(this.baseDir, 'wechat_html');
        const imageDir = path.join(this.baseDir, 'images');
        
        if (!fs.existsSync(articleDir)) {
            console.log('  ⚠️ 今日还没有处理任何文章');
            return;
        }
        
        const mdFiles = fs.readdirSync(articleDir).filter(f => f.endsWith('.md'));
        const htmlFiles = fs.existsSync(htmlDir) ? fs.readdirSync(htmlDir).filter(f => f.endsWith('.html')) : [];
        const imageFiles = fs.existsSync(imageDir) ? fs.readdirSync(imageDir).filter(f => f.match(/\.jpg|\.png|\.jpeg/i)) : [];
        
        console.log(`  📋 今日统计:`);
        console.log(`    - Markdown文件: ${mdFiles.length}`);
        console.log(`    - HTML文件: ${htmlFiles.length}`);
        console.log(`    - 图片文件: ${imageFiles.length}`);
        
        // 检查文件对应关系
        mdFiles.forEach(mdFile => {
            const articleNum = mdFile.match(/wechat_article_(\d+)\.md/)?.[1];
            if (articleNum) {
                const expectedHtml = `wechat_article_${articleNum}.html`;
                if (htmlFiles.includes(expectedHtml)) {
                    console.log(`    ✅ 文章${articleNum} - MD+HTML完整`);
                } else {
                    console.log(`    ❌ 文章${articleNum} - 缺少HTML文件`);
                    this.issues.push(`文章${articleNum} 缺少HTML文件`);
                }
            }
        });
    }

    checkImageProcessing() {
        console.log('\n🖼️ 检查图片处理功能...');
        
        const imageDir = path.join(this.baseDir, 'images');
        if (!fs.existsSync(imageDir)) {
            console.log('  ⚠️ 图片目录不存在');
            return;
        }
        
        const imageFiles = fs.readdirSync(imageDir);
        console.log(`  📊 图片文件统计: ${imageFiles.length} 个`);
        
        // 检查图片命名规范
        const correctNaming = imageFiles.filter(f => f.match(/article_\d+_img_\d+\.(jpg|png|jpeg)/i));
        const incorrectNaming = imageFiles.filter(f => !f.match(/article_\d+_img_\d+\.(jpg|png|jpeg)/i));
        
        console.log(`    ✅ 正确命名: ${correctNaming.length}`);
        if (incorrectNaming.length > 0) {
            console.log(`    ⚠️ 命名不规范: ${incorrectNaming.length}`);
            this.recommendations.push('重新规范化图片文件命名');
        }
        
        // 检查图片大小
        const largeSizeImages = imageFiles.filter(f => {
            const filePath = path.join(imageDir, f);
            const stats = fs.statSync(filePath);
            return stats.size > 5 * 1024 * 1024; // 大于5MB
        });
        
        if (largeSizeImages.length > 0) {
            console.log(`    ⚠️ 大文件图片: ${largeSizeImages.length} (>5MB)`);
            this.recommendations.push('考虑压缩大尺寸图片以优化性能');
        }
    }

    checkHTMLGeneration() {
        console.log('\n🌐 检查HTML生成功能...');
        
        const htmlDir = path.join(this.baseDir, 'wechat_html');
        if (!fs.existsSync(htmlDir)) {
            console.log('  ⚠️ HTML目录不存在');
            return;
        }
        
        const htmlFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
        if (htmlFiles.length === 0) {
            console.log('  ⚠️ 没有HTML文件');
            return;
        }
        
        // 检查第一个HTML文件的功能
        const sampleHtml = htmlFiles[0];
        const htmlContent = fs.readFileSync(path.join(htmlDir, sampleHtml), 'utf8');
        
        console.log(`  📄 检查样本文件: ${sampleHtml}`);
        
        // 检查关键功能
        const features = [
            { name: '复制全文按钮', pattern: /copyAllContent/, label: 'copyAllContent函数' },
            { name: '复制文字按钮', pattern: /copyOnlyText/, label: 'copyOnlyText函数' },
            { name: '图片点击复制', pattern: /copyImage/, label: 'copyImage函数' },
            { name: '工具栏样式', pattern: /\.toolbar/, label: '工具栏CSS' },
            { name: '响应式设计', pattern: /@media/, label: '响应式CSS' },
            { name: '复制成功提示', pattern: /copy-success/, label: '复制反馈' }
        ];
        
        features.forEach(feature => {
            if (feature.pattern.test(htmlContent)) {
                console.log(`    ✅ ${feature.name}`);
            } else {
                console.log(`    ❌ ${feature.name} - 缺失`);
                this.issues.push(`HTML模板缺失: ${feature.name}`);
            }
        });
        
        // 检查Base64图片功能
        if (htmlContent.includes('base64')) {
            console.log('    ✅ Base64图片支持');
        } else {
            console.log('    ⚠️ 可能缺少Base64图片功能');
            this.recommendations.push('验证Base64图片内嵌功能');
        }
    }

    checkWechatCopyFeatures() {
        console.log('\n📱 检查微信复制功能...');
        
        // 检查是否有微信专用的复制功能实现
        const htmlDir = path.join(this.baseDir, 'wechat_html');
        if (!fs.existsSync(htmlDir)) {
            console.log('  ⚠️ 无法检查 - HTML目录不存在');
            return;
        }
        
        const htmlFiles = fs.readdirSync(htmlDir).filter(f => f.endsWith('.html'));
        if (htmlFiles.length === 0) {
            console.log('  ⚠️ 无法检查 - 没有HTML文件');
            return;
        }
        
        const sampleHtml = path.join(htmlDir, htmlFiles[0]);
        const htmlContent = fs.readFileSync(sampleHtml, 'utf8');
        
        // 检查微信相关功能
        const wechatFeatures = [
            { name: '15px字体设置', pattern: /font-size:\s*15px/, desc: '微信公众号标准字体' },
            { name: '1.8行高设置', pattern: /line-height:\s*1\.8/, desc: '微信阅读体验优化' },
            { name: '图片居中样式', pattern: /text-align:\s*center/, desc: '图片居中显示' },
            { name: 'ClipboardItem API', pattern: /ClipboardItem/, desc: '现代剪贴板API' },
            { name: '富文本复制', pattern: /text\/html/, desc: '保持格式的复制' }
        ];
        
        wechatFeatures.forEach(feature => {
            if (feature.pattern.test(htmlContent)) {
                console.log(`    ✅ ${feature.name} - ${feature.desc}`);
            } else {
                console.log(`    ⚠️ ${feature.name} - 可能缺失`);
                this.recommendations.push(`添加${feature.name}: ${feature.desc}`);
            }
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 诊断报告');
        console.log('='.repeat(60));
        
        if (this.issues.length === 0) {
            console.log('🎉 恭喜！系统功能完整，未发现严重问题');
        } else {
            console.log(`❌ 发现 ${this.issues.length} 个问题需要修复:`);
            this.issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
        }
        
        if (this.recommendations.length > 0) {
            console.log(`\n💡 建议改进 ${this.recommendations.length} 项:`);
            this.recommendations.forEach((rec, index) => {
                console.log(`${index + 1}. ${rec}`);
            });
        }
        
        console.log('\n🔧 修复建议:');
        if (this.issues.length > 0) {
            console.log('1. 先修复标记为❌的严重问题');
            console.log('2. 再考虑⚠️的改进建议');
            console.log('3. 最后优化💡的功能增强');
        } else {
            console.log('1. 系统运行良好，可以正常使用');
            console.log('2. 考虑实施改进建议以提升体验');
        }
        
        // 生成修复脚本建议
        if (this.issues.length > 0) {
            console.log('\n🛠️ 自动修复脚本:');
            console.log('node fix_system_issues.js  # 我可以为你生成这个修复脚本');
        }
    }
}

// 执行诊断
if (require.main === module) {
    const diagnostic = new SystemDiagnostic();
    diagnostic.runDiagnostic().catch(console.error);
}

module.exports = SystemDiagnostic;