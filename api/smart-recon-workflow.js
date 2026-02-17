const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const execPromise = util.promisify(exec);

class SmartReconWorkflow {
    constructor() {
        this.workspaceDir = path.join(__dirname, '../workspace');
        this.resultsDir = path.join(__dirname, '../results');
        this.initDirectories();
    }

    async initDirectories() {
        await fs.mkdir(this.workspaceDir, { recursive: true });
        await fs.mkdir(this.resultsDir, { recursive: true });
    }

    async assetDiscovery(domain) {
        console.log(`\n📡 Step 1: Asset Discovery for ${domain}`);
        const outputFile = path.join(this.workspaceDir, `domains-${Date.now()}.txt`);
        
        try {
            // Try subfinder
            let cmd;
            try {
                await execPromise('which subfinder');
                cmd = `subfinder -d ${domain} -silent | httpx -silent -mc 200,401,403,404 -o ${outputFile}`;
                console.log('   Using subfinder + httpx');
            } catch (e) {
                console.log('   Using fallback methods...');
                cmd = this.getAlternativeDiscoveryCmd(domain, outputFile);
            }

            await execPromise(cmd, { timeout: 120000 });
            const content = await fs.readFile(outputFile, 'utf8').catch(() => '');
            const domains = content.split('\n').filter(line => line.trim());
            
            await fs.unlink(outputFile).catch(() => {});
            console.log(`   Found ${domains.length} live domains`);
            return domains;
            
        } catch (error) {
            console.error('   Asset discovery error:', error.message);
            return [];
        }
    }

    getAlternativeDiscoveryCmd(domain, outputFile) {
        const commonSubs = [
            'www', 'mail', 'remote', 'blog', 'webmail', 'server', 'ns1', 'ns2', 
            'smtp', 'secure', 'vpn', 'admin', 'portal', 'support', 'pop', 'pop3',
            'ftp', 'ssh', 'exchange', 'api', 'app', 'demo', 'test', 'dev',
            'staging', 'stage', 'beta', 'shop', 'store', 'cdn', 'static',
            'backup', 'archive', 'storage', 'logs', 'monitor', 'status'
        ];

        let cmd = '';
        commonSubs.forEach(sub => {
            cmd += `dig +short ${sub}.${domain} A >> ${outputFile} 2>/dev/null; `;
            cmd += `echo "https://${sub}.${domain}" >> ${outputFile} 2>/dev/null; `;
        });
        return cmd;
    }

    async extractUrls(domains) {
        console.log(`\n🔗 Step 2: URL Extraction from ${domains.length} domains`);
        const allUrls = new Set();

        for (const domain of domains.slice(0, 10)) {
            try {
                // Wayback Machine
                const cmd = `curl -s "http://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=text&fl=original&collapse=urlkey" | head -1000`;
                const { stdout } = await execPromise(cmd);
                stdout.split('\n').forEach(url => {
                    if (url.trim() && url.includes(domain)) allUrls.add(url.trim());
                });
            } catch (e) {}
        }

        console.log(`   Extracted ${allUrls.size} unique URLs`);
        return Array.from(allUrls);
    }

    async smartGrep(urls) {
        console.log(`\n🔍 Step 3: Smart Grep - Finding Sensitive Files and Secrets`);
        
        const results = {
            sensitiveFiles: [],
            secrets: [],
            highValueUrls: []
        };

        // High-risk file extensions
        const fileExtensions = [
            'zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz', 'tgz',
            'backup', 'bak', 'old', 'orig', 'copy',
            'env', 'config', 'conf', 'cfg', 'ini', 'yml', 'yaml', 'json', 'xml',
            'log', 'logs', 'debug', 'trace', 'audit',
            'sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'dmp', 'dump',
            'pem', 'key', 'crt', 'cer', 'p12', 'pfx', 'jks',
            'htaccess', 'htpasswd', 'git', 'svn',
            'password', 'passwd', 'secret', 'secrets', 'credentials'
        ];

        // Secret patterns
        const secretPatterns = [
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
            { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
            { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
            { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
            { name: 'Password in URL', pattern: /[?&]password=[^&\s]+/gi },
            { name: 'Token in URL', pattern: /[?&]token=[^&\s]+/gi },
            { name: 'API Key in URL', pattern: /[?&]api[_-]?key=[^&\s]+/gi }
        ];

        for (const url of urls) {
            // Check file extensions
            const ext = url.split('.').pop()?.split('?')[0].toLowerCase();
            if (ext && fileExtensions.includes(ext)) {
                results.sensitiveFiles.push({ url, extension: ext });
                results.highValueUrls.push(url);
            }

            // Check URL secrets
            for (const pattern of secretPatterns) {
                if (url.match(pattern.pattern)) {
                    results.secrets.push({ url, type: pattern.name });
                    results.highValueUrls.push(url);
                    break;
                }
            }
        }

        results.highValueUrls = [...new Set(results.highValueUrls)];
        
        console.log(`   - Sensitive Files: ${results.sensitiveFiles.length}`);
        console.log(`   - Secrets in URLs: ${results.secrets.length}`);
        console.log(`   - High-Value URLs: ${results.highValueUrls.length}`);

        return results;
    }

    async scanHighValueUrls(highValueUrls) {
        console.log(`\n🔬 Step 4: Scanning ${highValueUrls.length} high-value URLs`);
        const findings = [];

        for (let i = 0; i < Math.min(highValueUrls.length, 20); i++) {
            const url = highValueUrls[i];
            try {
                const cmd = `curl -s -k -L --max-time 5 "${url}" | head -c 10000`;
                const { stdout } = await execPromise(cmd);

                if (stdout.length > 0) {
                    findings.push({
                        url,
                        size: stdout.length,
                        preview: stdout.substring(0, 200)
                    });
                }
            } catch (e) {}
        }

        return findings;
    }

    async run(domain) {
        const startTime = Date.now();
        const scanId = crypto.randomBytes(8).toString('hex');

        console.log('\n' + '='.repeat(60));
        console.log(`🚀 SMART RECON STARTED - ID: ${scanId}`);
        console.log(`📌 Target: ${domain}`);
        console.log('='.repeat(60));

        const domains = await this.assetDiscovery(domain);
        const urls = await this.extractUrls(domains);
        const smartResults = await this.smartGrep(urls);
        const confirmedFindings = await this.scanHighValueUrls(smartResults.highValueUrls);

        const results = {
            scanId,
            domain,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            summary: {
                domainsFound: domains.length,
                urlsExtracted: urls.length,
                sensitiveFiles: smartResults.sensitiveFiles.length,
                secretsInUrls: smartResults.secrets.length,
                highValueUrls: smartResults.highValueUrls.length,
                confirmedFindings: confirmedFindings.length
            },
            data: {
                domains: domains.slice(0, 100),
                urls: urls.slice(0, 1000),
                smartGrep: smartResults,
                confirmedFindings
            }
        };

        // Save results
        const resultFile = path.join(this.resultsDir, `${domain}-${scanId}.json`);
        await fs.writeFile(resultFile, JSON.stringify(results, null, 2));

        console.log('\n' + '='.repeat(60));
        console.log('✅ SCAN COMPLETE');
        console.log(`⏱️  Duration: ${(results.duration / 1000).toFixed(2)}s`);
        console.log(`📁 Results saved to: ${resultFile}`);
        console.log('='.repeat(60));

        return results;
    }
}

const scanner = new SmartReconWorkflow();

app.post('/api/smart-recon', async (req, res) => {
    try {
        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: 'Domain is required' });
        
        const results = await scanner.run(domain);
        res.json(results);
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/smart-recon-ui.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SMART RECON running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/smart-recon`);
    console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
    console.log(`📁 Workspace: ${scanner.workspaceDir}`);
    console.log(`📁 Results: ${scanner.resultsDir}`);
});

module.exports = app;
