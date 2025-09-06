const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

class ArticleRewriterAPI {
    constructor() {
        // 初始化Anthropic客户端
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        // 配置
        this.model = 'claude-opus-4-20250514'; // Claude Opus 4 - 你的Claude Code版本
        this.maxTokens = 4000;
        this.temperature = 0.7;
        
        // 读取改写提示词
        this.promptFile = path.join(__dirname, 'golf_rewrite_prompt_turbo.txt');
        this.systemPrompt = fs.readFileSync(this.promptFile, 'utf8');
        
        // 性能追踪
        this.stats = {
            totalCalls: 0,
            totalTime: 0,
            avgResponseTime: 0
        };
    }

    /**
     * 使用官方API改写文章
     */
    async rewriteArticle(title, content, url = null) {
        const startTime = Date.now();
        
        try {
            // 构建用户消息
            let userMessage = `**标题**: ${title}\n\n`;
            if (url && url !== 'undefined' && url !== 'null') {
                userMessage += `【原文URL】${url}\n\n`;
            }
            userMessage += `**内容**:\n${content}`;
            
            console.log(`  🚀 使用Claude API改写文章...`);
            console.log(`  📊 模型: ${this.model}`);
            console.log(`  📝 内容长度: ${(content.length/1024).toFixed(1)}KB`);
            
            // 调用API
            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                system: this.systemPrompt,
                messages: [{
                    role: 'user',
                    content: userMessage
                }]
            });
            
            // 提取响应内容
            const rewrittenContent = response.content[0].text;
            
            // 验证响应
            if (!rewrittenContent || rewrittenContent.trim().length === 0) {
                throw new Error('API返回空内容');
            }
            
            // 检查是否为有效的改写内容
            if (!this.isValidRewrite(rewrittenContent)) {
                throw new Error('API返回的不是有效的改写文章');
            }
            
            // 更新统计
            const responseTime = Date.now() - startTime;
            this.updateStats(responseTime);
            
            console.log(`  ✅ 改写成功！耗时: ${(responseTime/1000).toFixed(1)}秒`);
            console.log(`  📊 平均响应时间: ${(this.stats.avgResponseTime/1000).toFixed(1)}秒`);
            
            return rewrittenContent;
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error(`  ❌ API调用失败 (${(responseTime/1000).toFixed(1)}秒): ${error.message}`);
            
            // 处理特定错误
            if (error.status === 429) {
                throw new Error('API速率限制，请稍后重试');
            } else if (error.status === 401) {
                throw new Error('API密钥无效，请检查ANTHROPIC_API_KEY');
            } else if (error.status === 500) {
                throw new Error('Claude服务暂时不可用');
            }
            
            throw error;
        }
    }

    /**
     * 使用流式API改写（更快的首字节时间）
     */
    async rewriteArticleStream(title, content, url = null) {
        const startTime = Date.now();
        let fullContent = '';
        
        try {
            // 构建用户消息
            let userMessage = `**标题**: ${title}\n\n`;
            if (url && url !== 'undefined' && url !== 'null') {
                userMessage += `【原文URL】${url}\n\n`;
            }
            userMessage += `**内容**:\n${content}`;
            
            console.log(`  🚀 使用Claude API流式改写...`);
            
            // 创建流式响应
            const stream = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                system: this.systemPrompt,
                messages: [{
                    role: 'user',
                    content: userMessage
                }],
                stream: true
            });
            
            // 处理流式响应
            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta') {
                    fullContent += chunk.delta.text;
                    
                    // 显示进度
                    const sizeKB = (fullContent.length / 1024).toFixed(1);
                    process.stdout.write(`\r     📥 接收中: ${sizeKB}KB`);
                }
            }
            
            process.stdout.write('\r' + ' '.repeat(50) + '\r');
            
            // 验证响应
            if (!fullContent || fullContent.trim().length === 0) {
                throw new Error('API返回空内容');
            }
            
            const responseTime = Date.now() - startTime;
            console.log(`  ✅ 流式改写成功！耗时: ${(responseTime/1000).toFixed(1)}秒`);
            
            return fullContent;
            
        } catch (error) {
            console.error(`  ❌ 流式API失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 验证改写内容是否有效
     */
    isValidRewrite(content) {
        // 检查是否包含标题标记
        if (!content.includes('#')) {
            return false;
        }
        
        // 检查是否为确认消息
        const confirmationPatterns = [
            /已完成.*文章.*改写/,
            /改写完成/,
            /文章已.*改写/
        ];
        
        return !confirmationPatterns.some(pattern => pattern.test(content));
    }

    /**
     * 更新性能统计
     */
    updateStats(responseTime) {
        this.stats.totalCalls++;
        this.stats.totalTime += responseTime;
        this.stats.avgResponseTime = this.stats.totalTime / this.stats.totalCalls;
    }

    /**
     * 测试API连接
     */
    async testConnection() {
        try {
            console.log('🔍 测试Claude API连接...');
            
            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 10,
                messages: [{
                    role: 'user',
                    content: 'Hello'
                }]
            });
            
            console.log('✅ API连接正常');
            return true;
            
        } catch (error) {
            console.error('❌ API连接失败:', error.message);
            if (error.status === 401) {
                console.error('   请设置环境变量: export ANTHROPIC_API_KEY="your-api-key"');
            }
            return false;
        }
    }
}

module.exports = ArticleRewriterAPI;