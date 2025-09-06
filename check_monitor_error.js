// 检查监控页面错误的脚本
const puppeteer = require('puppeteer');

async function checkMonitorPage() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // 监听控制台消息
    page.on('console', msg => {
        console.log('页面控制台:', msg.type(), msg.text());
    });
    
    // 监听页面错误
    page.on('error', err => {
        console.error('页面错误:', err);
    });
    
    // 监听页面内JavaScript错误
    page.on('pageerror', err => {
        console.error('JavaScript错误:', err.message);
    });
    
    try {
        console.log('访问监控页面...');
        await page.goto('http://localhost:8080/monitor', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // 等待页面加载
        await page.waitForTimeout(3000);
        
        // 检查status-grid容器
        const statusGrid = await page.$('.status-grid');
        console.log('status-grid容器存在:', !!statusGrid);
        
        // 检查子元素数量
        const childCount = await page.evaluate(() => {
            const grid = document.querySelector('.status-grid');
            return grid ? grid.children.length : 0;
        });
        console.log('status-grid子元素数量:', childCount);
        
        // 检查是否有网站状态卡片
        const websiteCard = await page.$('#website-status-card');
        console.log('网站状态卡片存在:', !!websiteCard);
        
        // 获取页面上所有status-card的标题
        const cardTitles = await page.evaluate(() => {
            const cards = document.querySelectorAll('.status-card h3');
            return Array.from(cards).map(card => card.textContent);
        });
        console.log('找到的卡片标题:', cardTitles);
        
        // 手动调用updateStatus看看会发生什么
        console.log('\n手动调用updateStatus函数...');
        const result = await page.evaluate(async () => {
            try {
                // 获取API数据
                const response = await fetch('/api/system-status');
                const data = await response.json();
                
                // 检查数据
                const hasWebsites = data.websites && data.websites.length > 0;
                console.log('API返回网站数据:', hasWebsites ? data.websites.length + '个' : '无');
                
                if (hasWebsites) {
                    // 尝试手动渲染
                    const existingCard = document.getElementById('website-status-card');
                    if (existingCard) existingCard.remove();
                    
                    const websiteStatusDiv = document.createElement('div');
                    websiteStatusDiv.id = 'website-status-card';
                    websiteStatusDiv.className = 'status-card';
                    websiteStatusDiv.innerHTML = '<h3>🌐 网站处理状态(测试)</h3>';
                    
                    const statusGrid = document.querySelector('.status-grid');
                    if (statusGrid) {
                        statusGrid.appendChild(websiteStatusDiv);
                        return '成功添加网站状态卡片';
                    } else {
                        return '错误: 找不到status-grid容器';
                    }
                }
                
                return '没有网站数据';
            } catch (error) {
                return '错误: ' + error.message;
            }
        });
        console.log('手动渲染结果:', result);
        
        // 再次检查网站卡片是否存在
        await page.waitForTimeout(1000);
        const finalCheck = await page.$('#website-status-card');
        console.log('最终检查 - 网站状态卡片存在:', !!finalCheck);
        
    } catch (error) {
        console.error('检查过程出错:', error);
    }
    
    console.log('\n保持浏览器打开，按Ctrl+C退出');
}

checkMonitorPage().catch(console.error);