const fs = require('fs');
const path = require('path');

class URLFileManager {
    constructor() {
        this.urls = new Set();
    }

    loadFromFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const urls = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                urls.forEach(url => this.urls.add(url));
                return Array.from(this.urls);
            }
            return [];
        } catch (error) {
            console.error(`Error loading URLs from ${filePath}:`, error);
            return [];
        }
    }

    saveToFile(filePath, urls) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const content = urls.join('\n');
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (error) {
            console.error(`Error saving URLs to ${filePath}:`, error);
            return false;
        }
    }

    appendToFile(filePath, urls) {
        try {
            const content = urls.join('\n') + '\n';
            fs.appendFileSync(filePath, content, 'utf8');
            return true;
        } catch (error) {
            console.error(`Error appending URLs to ${filePath}:`, error);
            return false;
        }
    }

    clear() {
        this.urls.clear();
    }
}

module.exports = URLFileManager;