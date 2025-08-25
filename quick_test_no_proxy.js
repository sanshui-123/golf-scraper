#!/usr/bin/env node

/**
 * 快速测试脚本 - 使用第二个配置文件（无代理）
 */

const axios = require('axios');
const config = require('./bitbrowser_config.json');

async function quickTest() {
    console.log('🚀 快速测试比特浏览器（使用无代理配置）\n');
    
    const baseUrl = `${config.apiHost}:${config.apiPort}`;
    const headers = {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json'
    };
    
    try {
        // 1. 获取配置文件列表
        console.log('1. 获取配置文件...');
        const listResponse = await axios.post(`${baseUrl}/browser/list`, {
            page: 0,
            pageSize: 10
        }, { headers });
        
        const profiles = listResponse.data.data.list;
        
        console.log(`获取到 ${profiles.length} 个配置文件：`);
        profiles.forEach((p, i) => {
            console.log(`${i+1}. ${p.name || '未命名'} - 代理类型: ${p.proxyType}`);
        });
        console.log('');
        
        // 找到无代理的配置文件
        const noProxyProfile = profiles.find(p => p.proxyType === 'noproxy');
        
        if (!noProxyProfile) {
            console.log('❌ 没有找到无代理配置文件');
            console.log('请在比特浏览器中创建一个不使用代理的配置文件');
            return;
        }
        
        console.log(`✅ 找到无代理配置: ${noProxyProfile.name || noProxyProfile.id}`);
        console.log(`   ID: ${noProxyProfile.id}`);
        console.log(`   代理类型: ${noProxyProfile.proxyType}\n`);
        
        // 2. 启动浏览器
        console.log('2. 启动浏览器...');
        const openResponse = await axios.post(`${baseUrl}/browser/open`, {
            id: noProxyProfile.id,
            loadExtensions: false,  // 不加载扩展，加快启动
            args: [],
            extractIp: true
        }, { 
            headers,
            timeout: 30000  // 30秒超时
        });
        
        if (openResponse.data.success) {
            console.log('✅ 浏览器启动成功！');
            const browserData = openResponse.data.data;
            console.log(`   WebSocket: ${browserData.ws || '未知'}`);
            console.log(`   HTTP端口: ${browserData.http || '未知'}`);
            console.log(`   当前IP: ${browserData.ip || '获取中...'}\n`);
            
            console.log('💡 浏览器已打开，你可以：');
            console.log('1. 在浏览器中手动测试');
            console.log('2. 访问 https://www.whatismyip.com 查看IP');
            console.log('3. 测试完成后按Ctrl+C结束\n');
            
            // 保持进程运行
            process.on('SIGINT', async () => {
                console.log('\n关闭浏览器...');
                try {
                    await axios.post(`${baseUrl}/browser/close`, {
                        id: noProxyProfile.id
                    }, { headers });
                    console.log('✅ 浏览器已关闭');
                } catch (e) {
                    console.log('⚠️ 关闭浏览器失败，请手动关闭');
                }
                process.exit(0);
            });
            
            // 防止进程退出
            setInterval(() => {}, 1000);
            
        } else {
            console.log('❌ 启动失败:', openResponse.data.msg || '未知错误');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        
        if (error.code === 'ECONNRESET') {
            console.log('\n💡 解决方案：');
            console.log('1. 重启比特浏览器客户端');
            console.log('2. 确保Local API已启用');
            console.log('3. 检查防火墙设置');
        }
    }
}

quickTest().catch(console.error);