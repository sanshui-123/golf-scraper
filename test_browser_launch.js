#!/usr/bin/env node

const axios = require('axios');
const config = require('./bitbrowser_config.json');

async function testBrowserLaunch() {
    console.log('测试比特浏览器启动功能...\n');
    
    const baseUrl = `${config.apiHost}:${config.apiPort}`;
    const headers = {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json'
    };
    
    try {
        // 1. 获取配置文件列表
        console.log('1. 获取配置文件列表...');
        const listResponse = await axios.post(`${baseUrl}/browser/list`, {
            page: 0,
            pageSize: 10
        }, { headers });
        
        const profiles = listResponse.data.data.list;
        console.log(`找到 ${profiles.length} 个配置文件\n`);
        
        if (profiles.length === 0) {
            console.log('没有配置文件，请先创建');
            return;
        }
        
        // 2. 选择第一个配置文件
        const profile = profiles[0];
        console.log(`2. 选择配置文件: ${profile.name || profile.id}`);
        console.log(`   代理类型: ${profile.proxyType}`);
        console.log(`   状态: ${profile.status === 0 ? '空闲' : '使用中'}\n`);
        
        // 3. 启动浏览器
        console.log('3. 启动浏览器...');
        try {
            const openResponse = await axios.post(`${baseUrl}/browser/open`, {
                id: profile.id,
                loadExtensions: true,
                args: [],
                extractIp: true
            }, { headers });
            
            if (openResponse.data.success) {
                console.log('✅ 浏览器启动成功!');
                const browserData = openResponse.data.data;
                console.log('浏览器数据:', JSON.stringify(browserData, null, 2));
                
                // 4. 等待几秒
                console.log('\n等待10秒...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                
                // 5. 关闭浏览器
                console.log('\n5. 关闭浏览器...');
                const closeResponse = await axios.post(`${baseUrl}/browser/close`, {
                    id: profile.id
                }, { headers });
                
                if (closeResponse.data.success) {
                    console.log('✅ 浏览器已关闭');
                } else {
                    console.log('❌ 关闭失败:', closeResponse.data.msg);
                }
            } else {
                console.log('❌ 启动失败:', openResponse.data.msg);
            }
        } catch (error) {
            console.log('❌ 启动浏览器时出错:', error.message);
            if (error.response) {
                console.log('错误响应:', error.response.data);
            }
        }
        
    } catch (error) {
        console.error('测试失败:', error.message);
        if (error.code === 'ECONNRESET') {
            console.log('\n💡 连接被重置，可能的解决方案:');
            console.log('1. 重启比特浏览器客户端');
            console.log('2. 检查防火墙设置');
            console.log('3. 确认API服务已启用');
        }
    }
}

testBrowserLaunch().catch(console.error);