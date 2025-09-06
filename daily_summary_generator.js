#!/usr/bin/env node

/**
 * 每日高尔夫资讯总结生成器
 * 功能：
 * 1. 收集当天所有处理过的文章
 * 2. 分析和分类内容
 * 3. 生成一个综合性的每日总结
 * 4. 输出适合微信公众号的格式
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class DailySummaryGenerator {
    constructor(date = null) {
        this.date = date || new Date().toISOString().split('T')[0];
        this.articlesPath = path.join(__dirname, 'golf_content', this.date, 'wechat_ready');
        this.articles = [];
        this.categories = {
            tournaments: [],      // 比赛动态
            players: [],         // 球员新闻
            techniques: [],      // 技术教学
            equipment: [],       // 装备资讯
            culture: [],         // 高尔夫文化
            college: [],         // 大学高尔夫
            other: []           // 其他
        };
        
        // Claude API配置
        this.apiKey = process.env.ANTHROPIC_API_KEY;
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
    }
    
    async generateSummary() {
        console.log(`📊 开始生成 ${this.date} 的每日高尔夫资讯总结...`);
        
        // 1. 收集文章
        await this.collectArticles();
        
        if (this.articles.length === 0) {
            console.log('❌ 没有找到当天的文章，无法生成总结');
            return;
        }
        
        console.log(`✅ 收集到 ${this.articles.length} 篇文章`);
        
        // 2. 分类文章
        this.categorizeArticles();
        
        // 3. 提取关键信息
        const keyInfo = this.extractKeyInformation();
        
        // 4. 生成总结
        const summary = await this.generateAISummary(keyInfo);
        
        // 5. 保存总结
        await this.saveSummary(summary);
        
        console.log('✅ 每日总结生成完成！');
    }
    
    async collectArticles() {
        try {
            if (!fs.existsSync(this.articlesPath)) {
                console.log(`⚠️ 目录不存在: ${this.articlesPath}`);
                return;
            }
            
            const files = fs.readdirSync(this.articlesPath)
                .filter(f => f.endsWith('.md') && !f.includes('_ai_detection'));
            
            for (const file of files) {
                const content = fs.readFileSync(path.join(this.articlesPath, file), 'utf8');
                const article = this.parseArticle(content, file);
                if (article) {
                    this.articles.push(article);
                }
            }
        } catch (error) {
            console.error('❌ 收集文章时出错:', error.message);
        }
    }
    
    parseArticle(content, filename) {
        try {
            const lines = content.split('\n');
            const article = {
                filename,
                title: '',
                content: '',
                fullContent: '', // 添加完整内容字段
                sourceUrl: '',
                sourceSite: '',
                category: '',
                keywords: []
            };
            
            // 提取标题
            for (const line of lines) {
                if (line.startsWith('# ')) {
                    article.title = line.substring(2).trim();
                    break;
                }
            }
            
            // 提取源链接
            const urlMatch = content.match(/\[查看原文\]\((https?:\/\/[^\)]+)\)/);
            if (urlMatch) {
                article.sourceUrl = urlMatch[1];
                article.sourceSite = new URL(article.sourceUrl).hostname;
            }
            
            // 提取完整内容（不再限制字符数）
            const contentStart = content.indexOf(article.title) + article.title.length;
            const contentEnd = content.lastIndexOf('[查看原文]');
            if (contentStart > 0 && contentEnd > contentStart) {
                // 保存完整内容
                article.fullContent = content.substring(contentStart, contentEnd)
                    .replace(/\n{3,}/g, '\n\n')
                    .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片
                    .replace(/<!--[\s\S]*?-->/g, '') // 移除注释
                    .trim();
                
                // 同时保存简短版本用于分类
                article.content = article.fullContent.substring(0, 500);
            }
            
            return article;
        } catch (error) {
            console.error(`⚠️ 解析文章失败 ${filename}:`, error.message);
            return null;
        }
    }
    
    categorizeArticles() {
        for (const article of this.articles) {
            const { title, content } = article;
            const text = (title + ' ' + content).toLowerCase();
            
            if (text.includes('锦标赛') || text.includes('冠军') || text.includes('领先') || 
                text.includes('赛事') || text.includes('tournament') || text.includes('championship')) {
                article.category = 'tournaments';
                this.categories.tournaments.push(article);
            }
            else if (text.includes('大学') || text.includes('college') || text.includes('ncaa')) {
                article.category = 'college';
                this.categories.college.push(article);
            }
            else if (text.includes('技巧') || text.includes('练习') || text.includes('教学') || 
                     text.includes('推杆') || text.includes('切杆') || text.includes('挥杆')) {
                article.category = 'techniques';
                this.categories.techniques.push(article);
            }
            else if (text.includes('装备') || text.includes('球杆') || text.includes('equipment') || 
                     text.includes('配置')) {
                article.category = 'equipment';
                this.categories.equipment.push(article);
            }
            else if (text.includes('莱德杯') || text.includes('纪录片') || text.includes('历史') || 
                     text.includes('传奇')) {
                article.category = 'culture';
                this.categories.culture.push(article);
            }
            else if (this.isPlayerNews(text)) {
                article.category = 'players';
                this.categories.players.push(article);
            }
            else {
                article.category = 'other';
                this.categories.other.push(article);
            }
        }
        
        // 显示分类统计
        console.log('\n📊 文章分类统计:');
        for (const [category, articles] of Object.entries(this.categories)) {
            if (articles.length > 0) {
                console.log(`   ${this.getCategoryName(category)}: ${articles.length} 篇`);
            }
        }
    }
    
    isPlayerNews(text) {
        const players = ['老虎', '伍兹', 'tiger', 'woods', '麦克罗伊', 'mcilroy', 
                        '米克尔森', 'mickelson', '斯皮思', 'spieth', '科普卡', 'koepka',
                        '拉姆', 'rahm', '谢奥菲勒', 'scheffler', '查理', 'charlie'];
        
        return players.some(player => text.includes(player));
    }
    
    getCategoryName(category) {
        const names = {
            tournaments: '⛳ 比赛动态',
            players: '🏌️ 球员新闻',
            techniques: '📚 技术教学',
            equipment: '🏌️‍♂️ 装备资讯',
            culture: '🎯 高尔夫文化',
            college: '🎓 大学高尔夫',
            other: '📰 其他资讯'
        };
        return names[category] || category;
    }
    
    extractKeyInformation() {
        const keyInfo = {
            date: this.date,
            totalArticles: this.articles.length,
            categories: {},
            topStories: [],
            tournaments: [],
            playerNews: [],
            techniques: [],
            allArticles: [], // 添加所有文章的完整内容
            connections: [], // 添加文章间的关联
            mainThemes: [], // 添加主要主题
            keyPlayers: [], // 添加关键球员
            trends: [] // 添加趋势分析
        };
        
        // 提取每个类别的完整信息
        for (const [category, articles] of Object.entries(this.categories)) {
            if (articles.length > 0) {
                keyInfo.categories[category] = articles.map(a => ({
                    title: a.title,
                    content: a.fullContent || a.content, // 使用完整内容
                    sourceSite: a.sourceSite
                }));
            }
        }
        
        // 保存所有文章的完整内容
        keyInfo.allArticles = this.articles.map(a => ({
            title: a.title,
            content: a.fullContent || a.content,
            category: this.getCategoryName(a.category),
            sourceSite: a.sourceSite
        }));
        
        // 提取热门故事及其完整内容
        keyInfo.topStories = this.articles
            .filter(a => a.title.length > 10)
            .sort((a, b) => this.getImportanceScore(b) - this.getImportanceScore(a))
            .slice(0, 5)
            .map(a => ({
                title: a.title,
                content: a.fullContent || a.content
            }));
        
        // 提取比赛信息及内容
        if (this.categories.tournaments.length > 0) {
            keyInfo.tournaments = this.categories.tournaments.map(a => ({
                title: a.title,
                content: a.fullContent || a.content
            }));
        }
        
        // 提取球员新闻及内容
        if (this.categories.players.length > 0) {
            keyInfo.playerNews = this.categories.players.map(a => ({
                title: a.title,
                content: a.fullContent || a.content
            }));
        }
        
        // 提取技术要点及内容
        if (this.categories.techniques.length > 0) {
            keyInfo.techniques = this.categories.techniques.map(a => ({
                title: a.title,
                content: a.fullContent || a.content
            }));
        }
        
        // 分析文章间的关联
        keyInfo.connections = this.findArticleConnections();
        
        // 提取主要主题
        keyInfo.mainThemes = this.extractMainThemes();
        
        // 提取关键球员
        keyInfo.keyPlayers = this.extractKeyPlayers();
        
        // 分析趋势
        keyInfo.trends = this.analyzeTrends();
        
        return keyInfo;
    }
    
    getImportanceScore(article) {
        let score = 0;
        const text = (article.title + ' ' + article.content).toLowerCase();
        
        // 重要关键词加分
        const importantKeywords = ['冠军', '夺冠', '领先', '纪录', '首次', '历史', 
                                  '大满贯', 'major', 'win', 'victory', 'record'];
        
        for (const keyword of importantKeywords) {
            if (text.includes(keyword)) score += 10;
        }
        
        // 知名球员加分
        const famousPlayers = ['老虎伍兹', '麦克罗伊', '拉姆', '谢奥菲勒'];
        for (const player of famousPlayers) {
            if (text.includes(player)) score += 5;
        }
        
        // 标题长度适中加分
        if (article.title.length > 15 && article.title.length < 40) score += 3;
        
        return score;
    }
    
    // 查找文章间的关联
    findArticleConnections() {
        const connections = [];
        const articles = this.articles;
        
        // 查找涉及相同球员的文章
        const playerArticles = {};
        articles.forEach((article, i) => {
            const players = this.extractPlayersFromArticle(article);
            players.forEach(player => {
                if (!playerArticles[player]) playerArticles[player] = [];
                playerArticles[player].push(i);
            });
        });
        
        // 查找涉及相同赛事的文章
        const tournamentArticles = {};
        articles.forEach((article, i) => {
            const tournaments = this.extractTournamentsFromArticle(article);
            tournaments.forEach(tournament => {
                if (!tournamentArticles[tournament]) tournamentArticles[tournament] = [];
                tournamentArticles[tournament].push(i);
            });
        });
        
        // 生成关联
        Object.entries(playerArticles).forEach(([player, indices]) => {
            if (indices.length > 1) {
                connections.push({
                    type: 'player',
                    name: player,
                    articles: indices.map(i => articles[i].title)
                });
            }
        });
        
        Object.entries(tournamentArticles).forEach(([tournament, indices]) => {
            if (indices.length > 1) {
                connections.push({
                    type: 'tournament',
                    name: tournament,
                    articles: indices.map(i => articles[i].title)
                });
            }
        });
        
        return connections;
    }
    
    // 提取文章中的球员
    extractPlayersFromArticle(article) {
        const players = [];
        const text = (article.title + ' ' + article.content).toLowerCase();
        
        const knownPlayers = [
            { name: '老虎伍兹', aliases: ['老虎', '伍兹', 'tiger', 'woods'] },
            { name: '麦克罗伊', aliases: ['mcilroy', 'rory'] },
            { name: '拉姆', aliases: ['rahm', 'jon'] },
            { name: '谢奥菲勒', aliases: ['scheffler', 'scottie'] },
            { name: '米克尔森', aliases: ['mickelson', 'phil'] },
            { name: '斯皮思', aliases: ['spieth', 'jordan'] },
            { name: '科普卡', aliases: ['koepka', 'brooks'] },
            { name: '查理伍兹', aliases: ['查理', 'charlie woods'] }
        ];
        
        knownPlayers.forEach(player => {
            if (player.aliases.some(alias => text.includes(alias))) {
                players.push(player.name);
            }
        });
        
        return [...new Set(players)];
    }
    
    // 提取文章中的赛事
    extractTournamentsFromArticle(article) {
        const tournaments = [];
        const text = article.title + ' ' + article.content;
        
        const tournamentPatterns = [
            /([\u4e00-\u9fa5]+锦标赛)/g,
            /([\u4e00-\u9fa5]+公开赛)/g,
            /([\u4e00-\u9fa5]+巡回赛)/g,
            /([A-Za-z\s]+Championship)/gi,
            /([A-Za-z\s]+Open)/gi,
            /([A-Za-z\s]+Tour)/gi,
            /(莱德杯|Ryder Cup)/gi,
            /(美国大师赛|Masters)/gi,
            /(PGA锦标赛|PGA Championship)/gi
        ];
        
        tournamentPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                tournaments.push(...matches);
            }
        });
        
        return [...new Set(tournaments)];
    }
    
    // 提取主要主题
    extractMainThemes() {
        const themes = [];
        const categories = this.categories;
        
        // 分析各类别的主要内容
        if (categories.tournaments.length > 5) {
            themes.push('赛事密集期');
        }
        if (categories.players.length > 3) {
            themes.push('球员动态焦点');
        }
        if (categories.techniques.length > 2) {
            themes.push('技术提升专题');
        }
        
        // 分析特殊事件
        const allText = this.articles.map(a => a.title + ' ' + a.content).join(' ').toLowerCase();
        
        if (allText.includes('莱德杯') || allText.includes('ryder cup')) {
            themes.push('莱德杯相关');
        }
        if (allText.includes('纪录') || allText.includes('record')) {
            themes.push('纪录突破');
        }
        if (allText.includes('首次') || allText.includes('first')) {
            themes.push('历史性时刻');
        }
        
        return themes;
    }
    
    // 提取关键球员
    extractKeyPlayers() {
        const playerCount = {};
        
        this.articles.forEach(article => {
            const players = this.extractPlayersFromArticle(article);
            players.forEach(player => {
                playerCount[player] = (playerCount[player] || 0) + 1;
            });
        });
        
        // 返回出现次数最多的前5位球员
        return Object.entries(playerCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([player, count]) => ({ name: player, mentions: count }));
    }
    
    // 分析趋势
    analyzeTrends() {
        const trends = [];
        const categories = this.categories;
        
        // 分析类别分布趋势
        const total = this.articles.length;
        Object.entries(categories).forEach(([category, articles]) => {
            const percentage = (articles.length / total * 100).toFixed(1);
            if (articles.length > total * 0.3) {
                trends.push(`${this.getCategoryName(category)}内容占比达${percentage}%`);
            }
        });
        
        // 分析内容趋势
        const allText = this.articles.map(a => a.title + ' ' + a.content).join(' ').toLowerCase();
        
        if (allText.includes('青少年') || allText.includes('junior')) {
            trends.push('青少年高尔夫受关注');
        }
        if (allText.includes('女子') || allText.includes('lpga')) {
            trends.push('女子高尔夫发展迅速');
        }
        if (allText.includes('技术') && allText.includes('装备')) {
            trends.push('技术装备创新活跃');
        }
        
        return trends;
    }
    
    async generateAISummary(keyInfo) {
        // 准备所有文章的详细内容
        let articlesContent = '\n=== 所有文章详细内容 ===\n\n';
        
        keyInfo.allArticles.forEach((article, index) => {
            articlesContent += `\n【文章${index + 1}】${article.title}\n`;
            articlesContent += `分类：${article.category}\n`;
            articlesContent += `来源：${article.sourceSite || '未知'}\n`;
            articlesContent += `内容：\n${article.content}\n`;
            articlesContent += '---\n';
        });
        
        // 准备关联分析
        let connectionsContent = '';
        if (keyInfo.connections && keyInfo.connections.length > 0) {
            connectionsContent = '\n=== 文章关联分析 ===\n';
            keyInfo.connections.forEach(conn => {
                connectionsContent += `\n- ${conn.type === 'player' ? '球员' : '赛事'}【${conn.name}】在多篇文章中出现\n`;
            });
        }
        
        // 准备主题和趋势
        let themesContent = '';
        if (keyInfo.mainThemes && keyInfo.mainThemes.length > 0) {
            themesContent = '\n今日主要主题：' + keyInfo.mainThemes.join('、');
        }
        
        let keyPlayersContent = '';
        if (keyInfo.keyPlayers && keyInfo.keyPlayers.length > 0) {
            keyPlayersContent = '\n关键球员：' + keyInfo.keyPlayers.map(p => `${p.name}(提及${p.mentions}次)`).join('、');
        }
        
        const prompt = `你是一位资深的高尔夫记者和专栏作家。请根据以下所有文章的完整内容，撰写一篇吸引人的高尔夫特稿文章。

日期：${keyInfo.date}
文章总数：${keyInfo.totalArticles}篇
${themesContent}
${keyPlayersContent}
${connectionsContent}

${articlesContent}

请撰写一篇3000-4000字的深度特稿，要求：

1. **文章风格**：
   - 写成一篇完整、流畅的特稿文章，而不是分板块的总结
   - 使用故事化的叙述方式，让读者沉浸其中
   - 有开头、发展、高潮和结尾的完整结构
   - 融合所有文章内容，但不要机械地罗列

2. **内容要求**：
   - 从今日最引人注目的故事开始
   - 自然地过渡到其他重要新闻
   - 将相关的事件和人物联系起来
   - 引用具体的数据、得分、排名等细节
   - 提供专业的分析和见解
   - 展现高尔夫运动的人文精神

3. **叙述技巧**：
   - 使用生动的细节描写
   - 创造场景感和代入感
   - 通过对比和联系增强可读性
   - 适当使用比喻和修辞手法
   - 保持专业但不失亲和力

4. **文章结构建议**（只作参考，请灵活运用）：
   - 引人入胜的开头（300-400字）
   - 主要故事线的展开（800-1000字）
   - 相关事件的交织叙述（1000-1200字）
   - 深度分析与观察（600-800字）
   - 意味深长的结尾（300-400字）

5. **语言风格**：
   - 优美流畅，富有感染力
   - 专业而不失温度
   - 适当使用表情符号点缀
   - 避免过于正式或创板

6. **标题要求**：
   - 主标题要吸引眼球，概括今日亮点
   - 可以使用副标题补充说明
   - 在文章中使用小标题分隔不同部分

格式要求：
- 使用Markdown格式
- 主标题使用 # 格式
- 小标题使用 ## 或 ### 格式
- 重要内容使用 **加粗**
- 引用具体数据时使用 \`数字\` 格式
- 重要引言使用 > 引用格式

请发挥你的创作才华，写出一篇让人想要一口气读完的精彩文章。`;

        try {
            console.log('\n🤖 调用AI生成深度总结...');
            console.log(`📝 发送${keyInfo.totalArticles}篇文章的完整内容进行融合分析...`);
            
            const response = await axios.post(this.apiUrl, {
                model: 'claude-opus-4-20250514', // 使用Claude Opus 4 - 你的Claude Code版本
                max_tokens: 4000, // 增加token限制
                temperature: 0.7,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });
            
            if (response.data && response.data.content && response.data.content[0]) {
                return response.data.content[0].text;
            } else {
                throw new Error('AI返回格式错误');
            }
        } catch (error) {
            console.error('❌ AI生成总结失败:', error.message);
            
            // 返回增强版备用模板
            return this.generateEnhancedFallbackSummary(keyInfo);
        }
    }
    
    generateEnhancedFallbackSummary(keyInfo) {
        const date = new Date(keyInfo.date);
        const dateStr = date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
        const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
        
        // 获取头条故事
        const headlineStory = keyInfo.topStories[0] || keyInfo.allArticles[0];
        
        // 生成一个吸引人的标题
        let mainTitle = `高尔夫今日特稿`;
        if (headlineStory) {
            // 根据头条内容生成标题
            if (headlineStory.title.includes('冠军') || headlineStory.title.includes('夺冠')) {
                mainTitle = `冠军荣耀：${dateStr}高尔夫赛场的高光时刻`;
            } else if (headlineStory.title.includes('纪录')) {
                mainTitle = `历史时刻：${dateStr}高尔夫界的纪录突破`;
            } else if (keyInfo.mainThemes && keyInfo.mainThemes.includes('赛事密集期')) {
                mainTitle = `激战正酣：${dateStr}高尔夫赛场全景扫描`;
            } else if (keyInfo.keyPlayers && keyInfo.keyPlayers.length > 0) {
                mainTitle = `球星闪耀：${dateStr}高尔夫界的焦点人物`;
            }
        }
        
        let summary = `# ${mainTitle}\n\n`;
        summary += `> ${weekday}的高尔夫世界，${keyInfo.totalArticles}个故事在这里交汇\n\n`;
        
        // 开篇故事
        if (headlineStory) {
            summary += `${weekday}的晨光洒在球场上，高尔夫世界迎来了新的一天。`;
            
            // 提取头条的核心内容
            const excerpt = headlineStory.content.substring(0, 200).replace(/\n/g, ' ');
            summary += `而今天最引人注目的，莫过于**${headlineStory.title}**。${excerpt}...\n\n`;
            
            // 深入展开头条故事
            const moreContent = headlineStory.content.substring(200, 600).replace(/\n/g, ' ');
            summary += `${moreContent}...\n\n`;
        }
        
        // 过渡到赛事分析
        if (keyInfo.tournaments.length > 0) {
            summary += `## 赛场风云\n\n`;
            
            if (keyInfo.tournaments.length === 1) {
                const t = keyInfo.tournaments[0];
                summary += `不过今天的高尔夫界并不只有一个故事。**${t.title}**同样牵引着人们的目光。`;
                const content = t.content.substring(0, 400).replace(/\n/g, ' ');
                summary += `${content}...\n\n`;
            } else {
                summary += `而在同一天的不同球场上，还有${keyInfo.tournaments.length}场精彩的赛事同时上演。`;
                
                keyInfo.tournaments.slice(0, 2).forEach((t, i) => {
                    if (i === 0) {
                        summary += `**${t.title}**中，`;
                    } else {
                        summary += `而在**${t.title}**上，`;
                    }
                    const content = t.content.substring(0, 200).replace(/\n/g, ' ');
                    summary += `${content}...\n\n`;
                });
            }
        }
        
        // 球员故事线
        if (keyInfo.playerNews.length > 0) {
            summary += `## 球员群像\n\n`;
            
            if (keyInfo.keyPlayers && keyInfo.keyPlayers.length > 0) {
                const topPlayer = keyInfo.keyPlayers[0];
                summary += `今天的赛场上，**${topPlayer.name}**无疑是最受关注的焦点人物。`;
            }
            
            keyInfo.playerNews.slice(0, 2).forEach((p, i) => {
                const content = p.content.substring(0, 300).replace(/\n/g, ' ');
                if (i === 0) {
                    summary += `${content}...\n\n`;
                } else {
                    summary += `与此同时，**${p.title}**。${content}...\n\n`;
                }
            });
        }
        
        // 技术与启示
        if (keyInfo.techniques.length > 0) {
            summary += `## 技术解析\n\n`;
            summary += `在竞技的背后，技术的提升永远是每个高尔夫球手关心的话题。`;
            
            const t = keyInfo.techniques[0];
            summary += `今天的**${t.title}**为我们带来了实用的指导。`;
            const content = t.content.substring(0, 250).replace(/\n/g, ' ');
            summary += `${content}...\n\n`;
        }
        
        // 关联分析
        if (keyInfo.connections && keyInfo.connections.length > 0) {
            summary += `## 关联与思考\n\n`;
            const conn = keyInfo.connections[0];
            if (conn.type === 'player') {
                summary += `值得注意的是，**${conn.name}**在今天的多篇报道中都有出现，`;
                summary += `这显示了他在当前高尔夫界的重要地位。`;
            } else {
                summary += `**${conn.name}**成为今天多个新闻的共同话题，`;
                summary += `反映了这项赛事在高尔夫界的影响力。`;
            }
            summary += `\n\n`;
        }
        
        // 数据视角
        summary += `## 数字背后\n\n`;
        summary += `今天的${keyInfo.totalArticles}篇报道中，`;
        
        const mainCategory = Object.entries(this.categories)
            .filter(([_, articles]) => articles.length > 0)
            .sort((a, b) => b[1].length - a[1].length)[0];
        
        if (mainCategory) {
            const percentage = ((mainCategory[1].length / keyInfo.totalArticles) * 100).toFixed(0);
            summary += `${this.getCategoryName(mainCategory[0])}占据了${percentage}%的篇幅，`;
        }
        
        summary += `这些数字勾勒出了今日高尔夫界的全貌。`;
        
        // 趋势观察
        if (keyInfo.trends && keyInfo.trends.length > 0) {
            summary += `从中我们可以看到，${keyInfo.trends[0]}，`;
            summary += `这可能预示着高尔夫运动的新走向。\n\n`;
        } else {
            summary += `\n\n`;
        }
        
        // 结尾思考
        summary += `## 今日感悟\n\n`;
        
        // 根据内容特点生成不同的结尾
        if (keyInfo.mainThemes && keyInfo.mainThemes.includes('纪录突破')) {
            summary += `今天的高尔夫世界见证了历史。每一个纪录的背后，都是无数次的挥杆和汗水。`;
            summary += `这提醒我们，在高尔夫这项运动中，突破极限不仅是可能的，更是值得追求的。`;
        } else if (keyInfo.mainThemes && keyInfo.mainThemes.includes('球员动态焦点')) {
            summary += `今天的每一个故事都在提醒我们，高尔夫不仅是一项运动，更是一个充满人性光辉的舞台。`;
            summary += `无论是老将的坚守还是新人的崛起，每个球员都在书写着属于自己的传奇。`;
        } else if (this.categories.tournaments.length > 5) {
            summary += `忙碌的赛事日程背后，是高尔夫运动蓬勃发展的缩影。`;
            summary += `每一场比赛都是一次超越的机会，每一次挥杆都可能改写历史。`;
        } else {
            summary += `今天的高尔夫世界向我们展示了这项运动的多样性。`;
            summary += `从激烈的竞技到精湛的技术，从个人的奋斗到团队的荣耀，`;
            summary += `高尔夫的魅力正在于它能让每个人找到属于自己的位置。`;
        }
        
        summary += `\n\n在绿茵如茵的球场上，每一天都有新的故事在发生。`;
        summary += `而我们，有幸成为这些故事的见证者。\n\n`;
        
        // 结束语
        summary += `---\n\n`;
        summary += `*本文由高尔夫资讯AI助手根据${keyInfo.totalArticles}篇报道深度整理而成*\n\n`;
        summary += `📅 **明日同一时间，我们再会。**`;
        
        return summary;
    }
    
    // 保留原有的generateFallbackSummary作为备用
    generateFallbackSummary(keyInfo) {
        return this.generateEnhancedFallbackSummary(keyInfo);
    }
    
    async saveSummary(summary) {
        try {
            // 创建输出目录
            const outputDir = path.join(__dirname, 'golf_content', this.date, 'daily_summary');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            // 保存Markdown文件
            const mdFile = path.join(outputDir, `daily_summary_${this.date}.md`);
            fs.writeFileSync(mdFile, summary);
            console.log(`\n✅ 总结已保存到: ${mdFile}`);
            
            // 生成HTML版本
            const htmlContent = this.convertToHTML(summary);
            const htmlFile = path.join(outputDir, `daily_summary_${this.date}.html`);
            fs.writeFileSync(htmlFile, htmlContent);
            console.log(`✅ HTML版本已保存到: ${htmlFile}`);
            
            // 同时保存到wechat_ready目录，方便发布
            const wechatFile = path.join(__dirname, 'golf_content', this.date, 'wechat_ready', `daily_summary_${this.date}.md`);
            fs.writeFileSync(wechatFile, summary);
            console.log(`✅ 微信版本已保存到: ${wechatFile}`);
            
        } catch (error) {
            console.error('❌ 保存总结时出错:', error.message);
        }
    }
    
    convertToHTML(markdown) {
        // 简单的Markdown到HTML转换
        let html = markdown
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // 添加基本的HTML结构
        const template = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>高尔夫每日资讯 - ${this.date}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.8;
            color: #333;
        }
        h1 {
            text-align: center;
            color: #2e7d32;
            border-bottom: 2px solid #2e7d32;
            padding-bottom: 10px;
        }
        h2 {
            color: #1976d2;
            margin-top: 30px;
        }
        li {
            margin: 10px 0;
        }
        strong {
            color: #d32f2f;
        }
        p {
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <p>${html}</p>
</body>
</html>`;
        
        return template;
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    let date = null;
    
    // 解析参数
    if (args.length > 0 && args[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = args[0];
    }
    
    // 创建生成器实例
    const generator = new DailySummaryGenerator(date);
    
    // 生成总结
    await generator.generateSummary();
}

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('❌ 未处理的错误:', error);
    process.exit(1);
});

// 启动
if (require.main === module) {
    main();
}

module.exports = DailySummaryGenerator;