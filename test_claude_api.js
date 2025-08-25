const Anthropic = require('@anthropic-ai/sdk');

async function testClaudeAPI() {
    try {
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        console.log('Testing Claude API connectivity...');
        
        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 100,
            messages: [{
                role: 'user',
                content: 'Hello, Claude! Please respond with a simple greeting.'
            }]
        });

        console.log('✅ API connection successful!');
        console.log('Response:', response.content[0].text);
        
    } catch (error) {
        console.error('❌ API connection failed:');
        console.error('Error:', error.message);
        if (error.status) {
            console.error('Status:', error.status);
        }
    }
}

testClaudeAPI();