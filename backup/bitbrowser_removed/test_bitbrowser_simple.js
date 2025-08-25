#!/usr/bin/env node

const BitBrowserManager = require('./bitbrowser_manager');

async function simpleTest() {
    console.log('开始简单的比特浏览器测试...\n');
    
    const manager = new BitBrowserManager();
    
    try {
        // 步骤1: 初始化
        console.log('步骤1: 初始化管理器');
        await manager.initialize();
        console.log('✅ 初始化成功\n');
        
        // 步骤2: 获取统计信息
        console.log('步骤2: 获取统计信息');
        const stats = await manager.getStatistics();
        console.log('统计信息:', JSON.stringify(stats, null, 2));
        console.log('\n');
        
        // 步骤3: 获取配置文件列表
        console.log('步骤3: 配置文件列表');
        if (manager.profiles && manager.profiles.length > 0) {
            manager.profiles.forEach((profile, index) => {
                console.log(`${index + 1}. ${profile.name || '未命名'} (ID: ${profile.id})`);
                console.log(`   代理类型: ${profile.proxyType}`);
                console.log(`   状态: ${profile.status === 0 ? '空闲' : '使用中'}`);
            });
        } else {
            console.log('没有配置文件');
        }
        console.log('\n');
        
        // 步骤4: 测试启动浏览器
        if (manager.profiles && manager.profiles.length > 0) {
            const testProfile = manager.profiles[0];
            console.log(`步骤4: 测试启动浏览器 - ${testProfile.name || testProfile.id}`);
            
            try {
                const browserInfo = await manager.launchBrowser(testProfile.id);
                console.log('✅ 浏览器启动成功!');
                console.log('浏览器信息:', JSON.stringify(browserInfo, null, 2));
                
                // 等待几秒
                console.log('\n等待5秒后关闭浏览器...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // 关闭浏览器
                await manager.closeBrowser(testProfile.id);
                console.log('✅ 浏览器已关闭');
                
            } catch (error) {
                console.log('❌ 启动浏览器失败:', error.message);
            }
        }
        
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error('错误详情:', error);
    }
}

// 运行测试
simpleTest().catch(console.error);