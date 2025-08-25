#!/usr/bin/env node

const axios = require('axios');
const config = require('./bitbrowser_config.json');

async function testAnyProfile() {
    console.log('🚀 测试比特浏览器 - 使用任意配置文件\n');
    
    const baseUrl = `${config.apiHost}:${config.apiPort}`;
    const headers = {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json'
    };
    
    try {
        // 1. 获取所有配置文件
        console.log('1. 获取所有配置文件...');
        const listResponse = await axios.post(`${baseUrl}/browser/list`, {
            page: 0,
            pageSize: 100  // 获取更多
        }, { headers });
        
        const data = listResponse.data.data;
        console.log(`总配置数: ${data.totalNum}`);
        console.log(`当前获取: ${data.list.length} 个\n`);
        
        if (data.list.length === 0) {
            // 尝试第二页
            console.log('尝试获取第二页...');
            const page2Response = await axios.post(`${baseUrl}/browser/list`, {
                page: 1,
                pageSize: 100
            }, { headers });
            data.list = page2Response.data.data.list;
        }
        
        if (data.list.length === 0) {
            console.log('❌ 没有找到任何配置文件');
            return;
        }
        
        // 显示所有配置文件
        console.log('配置文件列表:');
        data.list.forEach((p, i) => {
            console.log(`${i+1}. ${p.name || '未命名'} (ID: ${p.id})`);
            console.log(`   代理类型: ${p.proxyType}`);
            console.log(`   代理地址: ${p.host}:${p.port || '无'}`);
            console.log(`   状态: ${p.status === 0 ? '空闲' : '使用中'}`);
            console.log('');
        });
        
        // 选择第一个配置文件
        const profile = data.list[0];
        console.log(`\n2. 测试配置文件: ${profile.name || profile.id}`);
        
        if (profile.proxyType === 'socks5' && profile.host === '532') {
            console.log('\n⚠️ 警告: 代理配置有问题');
            console.log('   host "532" 不是有效的IP地址');
            console.log('   建议在比特浏览器中修改为:');
            console.log('   - 不使用代理 (noproxy)');
            console.log('   - 或填入正确的代理地址\n');
            
            console.log('是否仍要尝试启动？可能会失败。');
            console.log('按Ctrl+C取消，或等待5秒继续...\n');
            
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // 3. 尝试启动
        console.log('3. 启动浏览器...');
        console.log('(如果因代理问题失败，请在比特浏览器中修改配置)\n');
        
        const openResponse = await axios.post(`${baseUrl}/browser/open`, {
            id: profile.id,
            loadExtensions: false,
            args: [],
            extractIp: false  // 不提取IP，避免代理问题
        }, { 
            headers,
            timeout: 30000
        });
        
        if (openResponse.data.success) {
            console.log('✅ 浏览器启动成功！');
            const browserData = openResponse.data.data;
            console.log('浏览器信息:', JSON.stringify(browserData, null, 2));
            
            console.log('\n按Ctrl+C关闭浏览器...');
            
            process.on('SIGINT', async () => {
                console.log('\n关闭浏览器...');
                try {
                    await axios.post(`${baseUrl}/browser/close`, {
                        id: profile.id
                    }, { headers });
                    console.log('✅ 已关闭');
                } catch (e) {
                    console.log('⚠️ 关闭失败');
                }
                process.exit(0);
            });
            
            setInterval(() => {}, 1000);
            
        } else {
            console.log('❌ 启动失败:', openResponse.data.msg || '未知错误');
        }
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        
        if (error.code === 'ECONNRESET') {
            console.log('\n💡 ECONNRESET错误解决方案：');
            console.log('1. 重启比特浏览器客户端');
            console.log('2. 修复代理配置（host不能是"532"）');
            console.log('3. 或创建一个无代理的新配置文件');
        }
    }
}

testAnyProfile().catch(console.error);