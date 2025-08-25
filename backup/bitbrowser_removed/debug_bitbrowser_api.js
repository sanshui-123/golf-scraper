#!/usr/bin/env node

const axios = require('axios');
const config = require('./bitbrowser_config.json');

async function debugAPI() {
    const baseUrl = `${config.apiHost}:${config.apiPort}`;
    const apiKey = config.apiKey;
    
    console.log('🔍 调试比特浏览器API...\n');
    console.log(`API地址: ${baseUrl}`);
    console.log(`API Key: ${apiKey}\n`);
    
    // 测试不同的分页参数
    const tests = [
        { page: 1, pageSize: 10, desc: '第1页，每页10条' },
        { page: 1, pageSize: 100, desc: '第1页，每页100条' },
        { page: 0, pageSize: 10, desc: '第0页，每页10条' },
        { desc: '无分页参数' },
        { pageNum: 1, pageSize: 10, desc: 'pageNum而非page' },
    ];
    
    for (const test of tests) {
        console.log(`\n测试: ${test.desc}`);
        console.log('请求参数:', JSON.stringify(test));
        
        try {
            const response = await axios.post(`${baseUrl}/browser/list`, test, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            console.log('✅ 响应成功!');
            console.log('响应数据:', JSON.stringify(response.data, null, 2));
            
            // 如果获取到列表，显示详细信息
            if (response.data.data && response.data.data.list && response.data.data.list.length > 0) {
                console.log('\n📋 配置文件详情:');
                response.data.data.list.forEach((profile, index) => {
                    console.log(`\n${index + 1}. ${profile.name || '未命名'}`);
                    console.log(`   ID: ${profile.id}`);
                    console.log(`   状态: ${profile.status || '未知'}`);
                    console.log(`   用户名: ${profile.userName || '无'}`);
                    console.log(`   备注: ${profile.remark || '无'}`);
                });
            }
            
        } catch (error) {
            console.log('❌ 请求失败:', error.message);
            if (error.response) {
                console.log('错误详情:', error.response.data);
            }
        }
    }
    
    // 尝试其他可能的API端点
    console.log('\n\n测试其他可能的端点...');
    const otherEndpoints = [
        '/browser/open',
        '/browser/detail',
        '/profile/list',
        '/open/list',
    ];
    
    for (const endpoint of otherEndpoints) {
        console.log(`\n测试 POST ${baseUrl}${endpoint}`);
        try {
            const response = await axios.post(`${baseUrl}${endpoint}`, {
                page: 1,
                pageSize: 10
            }, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            });
            console.log('✅ 成功!');
            console.log('响应:', JSON.stringify(response.data, null, 2).substring(0, 300));
        } catch (error) {
            console.log('❌ 失败:', error.message);
        }
    }
}

debugAPI().catch(console.error);