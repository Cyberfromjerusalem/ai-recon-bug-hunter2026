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
        try {
            await fs.mkdir(this.workspaceDir, { recursive: true });
            await fs.mkdir(this.resultsDir, { recursive: true });
        } catch (error) {
            console.log('Directory creation error (non-critical):', error.message);
        }
    }

    // ==================== STEP 1: ASSET DISCOVERY ====================
    async assetDiscovery(domain) {
        console.log(`\n📡 Step 1: Asset Discovery for ${domain}`);
        
        try {
            // Use dig for DNS enumeration (works everywhere)
            console.log('   Using dig for DNS enumeration...');
            
            const commonSubs = [
                'www', 'mail', 'remote', 'blog', 'webmail', 'server', 'ns1', 'ns2', 
                'smtp', 'secure', 'vpn', 'admin', 'portal', 'support', 'pop', 'pop3',
                'ftp', 'ssh', 'exchange', 'mail2', 'gw', 'proxy', 'test', 'dev',
                'staging', 'stage', 'beta', 'shop', 'store', 'api', 'app', 'demo',
                'media', 'cdn', 'static', 'assets', 'images', 'img', 'video',
                'download', 'downloads', 'files', 'file', 'upload', 'uploads',
                'forum', 'community', 'chat', 'help', 'docs', 'documentation',
                'wiki', 'kb', 'knowledge', 'faq', 'status', 'health', 'monitor',
                'monitoring', 'stats', 'statistics', 'analytics', 'metrics',
                'logs', 'log', 'debug', 'trace', 'internal', 'external',
                'public', 'private', 'auth', 'login', 'signin', 'signup',
                'register', 'account', 'accounts', 'user', 'users', 'profile',
                'profiles', 'member', 'members', 'customer', 'customers',
                'client', 'clients', 'partner', 'partners', 'vendor', 'vendors',
                'backup', 'backups', 'archive', 'archives', 'old', 'new',
                'temp', 'tmp', 'cache', 'cached', 'storage', 'staging',
                'preview', 'preprod', 'production', 'prod', 'development',
                'sandbox', 'playground', 'lab', 'labs', 'testlab',
                'jenkins', 'git', 'gitlab', 'jira', 'confluence',
                'phpmyadmin', 'adminer', 'mysql', 'pma',
                'webmin', 'cpanel', 'whm', 'plesk',
                'kibana', 'elastic', 'grafana', 'prometheus',
                'docker', 'k8s', 'kubernetes', 'rancher',
                'redis', 'memcache', 'mongodb', 'rabbitmq'
            ];

            const domains = new Set();
            
            // Check main domain first
            try {
                const mainDig = await execPromise(`dig +short ${domain} A`);
                if (mainDig.stdout.trim()) {
                    domains.add(domain);
                }
            } catch (e) {}

            // Check common subdomains
            for (const sub of commonSubs) {
                try {
                    const subdomain = `${sub}.${domain}`;
                    const { stdout } = await execPromise(`dig +short ${subdomain} A`);
                    
                    if (stdout.trim()) {
                        domains.add(subdomain);
                        console.log(`      Found: ${subdomain}`);
                    }
                } catch (e) {
                    // Ignore errors
                }
            }

            const domainsList = Array.from(domains);
            console.log(`   Found ${domainsList.length} domains`);
            return domainsList;
            
        } catch (error) {
            console.error('   Asset discovery error:', error.message);
            return [domain]; // Return at least the main domain
        }
    }

    // ==================== STEP 2: URL EXTRACTION ====================
    async extractUrls(domain) {
        console.log(`\n🔗 Step 2: URL Extraction for ${domain}`);
        
        const allUrls = new Set();

        try {
            // Wayback Machine
            console.log('   Fetching from Wayback Machine...');
            try {
                const waybackCmd = `curl -s "http://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=text&fl=original&collapse=urlkey" | head -2000`;
                const { stdout } = await execPromise(waybackCmd, { timeout: 10000 });
                
                stdout.split('\n').forEach(url => {
                    if (url.trim() && url.includes(domain)) {
                        allUrls.add(url.trim());
                    }
                });
                console.log(`      Found ${stdout.split('\n').length} URLs from Wayback`);
            } catch (e) {
                console.log('      Wayback fetch failed:', e.message);
            }

            // CommonCrawl
            console.log('   Fetching from CommonCrawl...');
            try {
                const ccCmd = `curl -s "http://index.commoncrawl.org/CC-MAIN-2024-10-index?url=*.${domain}/*&output=json" | jq -r '.url' 2>/dev/null | head -500`;
                const { stdout } = await execPromise(ccCmd, { timeout: 10000 });
                
                stdout.split('\n').forEach(url => {
                    if (url.trim() && url.includes(domain)) {
                        allUrls.add(url.trim());
                    }
                });
            } catch (e) {}

            // Add some common paths
            const commonPaths = [
                '/robots.txt', '/sitemap.xml', '/.env', '/.git/config',
                '/wp-config.php', '/backup.zip', '/database.sql',
                '/phpinfo.php', '/info.php', '/test.php'
            ];

            for (const sub of [domain, `www.${domain}`, `api.${domain}`, `admin.${domain}`]) {
                for (const path of commonPaths) {
                    allUrls.add(`https://${sub}${path}`);
                    allUrls.add(`http://${sub}${path}`);
                }
            }

            console.log(`   Total unique URLs: ${allUrls.size}`);
            return Array.from(allUrls);
            
        } catch (error) {
            console.error('   URL extraction error:', error.message);
            return [];
        }
    }

    // ==================== STEP 3: SMART GREP (FILES + SECRETS) ====================
    async smartGrep(urls) {
        console.log(`\n🔍 Step 3: Smart Grep - Finding Sensitive Files and Secrets`);
        
        const results = {
            sensitiveFiles: [],
            secrets: [],
            highValueUrls: []
        };

        // ===== HIGH-RISK FILE EXTENSIONS =====
        const fileExtensions = [
            // Archives & Backups
            'zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz', 'tgz', 'tbz2',
            'backup', 'bak', 'bck', 'back', 'old', 'orig', 'copy', 'copies',
            
            // Config & Code
            'env', 'config', 'conf', 'cfg', 'ini', 'yml', 'yaml', 'json',
            'xml', 'toml', 'properties', 'plist', 'cnf', 'reg', 'inf',
            
            // Logs & Debug
            'log', 'logs', 'debug', 'trace', 'audit', 'out', 'err',
            
            // Databases
            'sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'dbf',
            'sqlitedb', 'dat', 'data', 'dmp', 'dump',
            
            // Source Code
            'java', 'php', 'py', 'rb', 'go', 'js', 'ts', 'cs', 'cpp',
            'c', 'h', 'swift', 'kt', 'scala',
            
            // Documents
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
            
            // Keys & Certificates
            'pem', 'key', 'crt', 'cer', 'p12', 'pfx', 'jks', 'keystore',
            'asc', 'gpg', 'pgp', 'sk', 'pk', 'pub',
            
            // Web Files
            'htaccess', 'htpasswd', 'htgroup', 'svn', 'git', 'gitignore',
            'dockerignore', 'npmignore', 'bower.json', 'composer.json',
            'package.json', 'package-lock.json', 'yarn.lock', 'Gemfile',
            'requirements.txt', 'Pipfile',
            
            // Temporary
            'tmp', 'temp', 'cache', 'swp', 'swo', 'swn',
            
            // Environment & Secrets
            'secret', 'secrets', 'credentials', 'cred', 'auth',
            'password', 'passwd', 'pwd', 'token', 'tokens'
        ];

        // ===== HIGH-SIGNAL SECRET PATTERNS =====
        const secretPatterns = [
            // API Keys & Tokens
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
            { name: 'AWS Secret Key', pattern: /(?i)aws_secret(_access)?_key[=:]["']?[A-Za-z0-9\/+=]{40}["']?/g },
            { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
            { name: 'Google OAuth', pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g },
            { name: 'Facebook Token', pattern: /EAACEdEose0cBA[0-9A-Za-z]+/g },
            { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
            { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
            { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g },
            { name: 'Twilio Key', pattern: /SK[0-9a-f]{32}/g },
            
            // Database connections
            { name: 'MongoDB', pattern: /mongodb(?:\+srv)?:\/\/[^\s]+/g },
            { name: 'MySQL', pattern: /mysql:\/\/[^\s]+/g },
            { name: 'PostgreSQL', pattern: /postgresql:\/\/[^\s]+/g },
            { name: 'Redis', pattern: /redis:\/\/[^\s]+/g },
            
            // JWT Tokens
            { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
            
            // Private Keys
            { name: 'RSA Private Key', pattern: /-----BEGIN RSA PRIVATE KEY-----/g },
            { name: 'OpenSSH Private Key', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
            
            // Credentials in URLs
            { name: 'Password in URL', pattern: /[?&]password=[^&\s]+/gi },
            { name: 'Token in URL', pattern: /[?&]token=[^&\s]+/gi },
            { name: 'API Key in URL', pattern: /[?&]api[_-]?key=[^&\s]+/gi },
            { name: 'Secret in URL', pattern: /[?&]secret=[^&\s]+/gi },
            { name: 'Auth in URL', pattern: /[?&]auth=[^&\s]+/gi },
            
            // Common env vars
            { name: 'DB Password', pattern: /DB_PASSWORD=['"][^'"]+['"]/gi },
            { name: 'DB Username', pattern: /DB_USERNAME=['"][^'"]+['"]/gi },
            { name: 'API Key env', pattern: /API_KEY=['"][^'"]+['"]/gi },
            { name: 'Secret Key', pattern: /SECRET_KEY=['"][^'"]+['"]/gi },
            
            // Cloud
            { name: 'AWS S3 Bucket', pattern: /[a-zA-Z0-9.-]+\.s3\.amazonaws\.com/g },
            { name: 'Firebase URL', pattern: /https:\/\/[a-zA-Z0-9-]+\.firebaseio\.com/g },
            
            // Personal Data
            { name: 'Email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
            { name: 'Phone', pattern: /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g },
            
            // Internal
            { name: 'Internal IP', pattern: /(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})/g },
            { name: 'Localhost', pattern: /(localhost|127\.0\.0\.1|0\.0\.0\.0)/gi }
        ];

        // Process URLs
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            
            // Check file extensions
            const urlPath = url.split('?')[0]; // Remove query string
            const ext = urlPath.split('.').pop()?.toLowerCase();
            
            if (ext && fileExtensions.includes(ext)) {
                results.sensitiveFiles.push({
                    url,
                    extension: ext
                });
                results.highValueUrls.push(url);
            }

            // Check URL for secrets
            for (const pattern of secretPatterns) {
                const matches = url.match(pattern.pattern);
                if (matches) {
                    results.secrets.push({
                        url,
                        type: pattern.name,
                        matches: matches.slice(0, 3)
                    });
                    results.highValueUrls.push(url);
                    break; // Found a secret, move to next URL
                }
            }

            // Progress indicator
            if (i % 500 === 0 && i > 0) {
                console.log(`      Processed ${i}/${urls.length} URLs...`);
            }
        }

        // Remove duplicates from highValueUrls
        results.highValueUrls = [...new Set(results.highValueUrls)];

        console.log(`\n   📊 Smart Grep Results:`);
        console.log(`      - Sensitive Files: ${results.sensitiveFiles.length}`);
        console.log(`      - Secrets in URLs: ${results.secrets.length}`);
        console.log(`      - High-Value URLs: ${results.highValueUrls.length}`);

        return results;
    }

    // ==================== STEP 4: SCAN HIGH-VALUE URLS ====================
    async scanHighValueUrls(highValueUrls) {
        console.log(`\n🔬 Step 4: Scanning ${highValueUrls.length} high-value URLs`);
        
        const findings = [];

        for (let i = 0; i < Math.min(highValueUrls.length, 30); i++) {
            const url = highValueUrls[i];
            console.log(`      Scanning ${i+1}/${Math.min(highValueUrls.length, 30)}: ${url.substring(0, 60)}...`);

            try {
                // Fetch URL content
                const cmd = `curl -s -k -L --max-time 5 -A "Mozilla/5.0 (compatible; ReconBot/1.0)" "${url}" | head -c 20000`;
                const { stdout } = await execPromise(cmd, { timeout: 8000 });

                if (stdout.length > 0) {
                    const urlFindings = {
                        url,
                        size: stdout.length,
                        preview: stdout.substring(0, 300).replace(/[\n\r]/g, ' ').substring(0, 200) + '...'
                    };

                    // Quick check for obvious secrets in content
                    const secretIndicators = [
                        'password', 'PASSWORD', 'secret', 'SECRET', 
                        'api_key', 'API_KEY', 'token', 'TOKEN',
                        'aws_access', 'AWS_ACCESS', 'private key'
                    ];

                    const hasSecret = secretIndicators.some(indicator => 
                        stdout.toLowerCase().includes(indicator.toLowerCase())
                    );

                    if (hasSecret) {
                        urlFindings.hasSecret = true;
                    }

                    findings.push(urlFindings);
                }
            } catch (error) {
                // Silently fail for individual URLs
            }
        }

        console.log(`   Found ${findings.length} accessible high-value URLs`);
        return findings;
    }

    // ==================== MAIN SCAN FUNCTION ====================
    async run(domain) {
        const startTime = Date.now();
        const scanId = crypto.randomBytes(8).toString('hex');

        console.log('\n' + '='.repeat(70));
        console.log(`🚀 SMART RECON SCAN STARTED - ID: ${scanId}`);
        console.log(`📌 Target: ${domain}`);
        console.log('='.repeat(70));

        const results = {
            scanId,
            domain,
            timestamp: new Date().toISOString(),
            duration: 0,
            summary: {
                domainsFound: 0,
                urlsExtracted: 0,
                sensitiveFiles: 0,
                secretsInUrls: 0,
                highValueUrls: 0,
                confirmedFindings: 0
            },
            data: {
                domains: [],
                urls: [],
                smartGrep: {
                    sensitiveFiles: [],
                    secrets: [],
                    highValueUrls: []
                },
                confirmedFindings: []
            }
        };

        try {
            // Step 1: Asset Discovery
            const domains = await this.assetDiscovery(domain);
            results.data.domains = domains.slice(0, 100);
            results.summary.domainsFound = domains.length;

            // Step 2: URL Extraction
            const urls = await this.extractUrls(domain);
            results.data.urls = urls.slice(0, 2000);
            results.summary.urlsExtracted = urls.length;

            if (urls.length === 0) {
                console.log('❌ No URLs found');
                return results;
            }

            // Step 3: Smart Grep
            const smartResults = await this.smartGrep(urls);
            results.data.smartGrep = smartResults;
            results.summary.sensitiveFiles = smartResults.sensitiveFiles.length;
            results.summary.secretsInUrls = smartResults.secrets.length;
            results.summary.highValueUrls = smartResults.highValueUrls.length;

            // Step 4: Scan High-Value URLs
            if (smartResults.highValueUrls.length > 0) {
                const confirmedFindings = await this.scanHighValueUrls(smartResults.highValueUrls);
                results.data.confirmedFindings = confirmedFindings;
                results.summary.confirmedFindings = confirmedFindings.length;
            }

        } catch (error) {
            console.error('Scan error:', error);
        }

        // Finalize
        results.duration = Date.now() - startTime;

        // Try to save results (may fail on Vercel, but that's ok)
        try {
            const resultFile = path.join(this.resultsDir, `${domain}-${scanId}.json`);
            await fs.writeFile(resultFile, JSON.stringify(results, null, 2));
            console.log(`📁 Results saved to: ${resultFile}`);
        } catch (e) {
            // Silently fail if can't save (Vercel serverless)
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ SCAN COMPLETE');
        console.log(`⏱️  Duration: ${(results.duration / 1000).toFixed(2)}s`);
        console.log(`📊 Summary:`);
        console.log(`   - Domains found: ${results.summary.domainsFound}`);
        console.log(`   - URLs extracted: ${results.summary.urlsExtracted}`);
        console.log(`   - Sensitive files: ${results.summary.sensitiveFiles}`);
        console.log(`   - Secrets in URLs: ${results.summary.secretsInUrls}`);
        console.log(`   - High-value URLs: ${results.summary.highValueUrls}`);
        console.log(`   - Confirmed findings: ${results.summary.confirmedFindings}`);
        console.log('='.repeat(70));

        return results;
    }
}

// ==================== API ENDPOINTS ====================
const scanner = new SmartReconWorkflow();

app.post('/api/smart-recon', async (req, res) => {
    try {
        const { domain } = req.body;
        
        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        // Validate domain format
        const domainRegex = /^([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            return res.status(400).json({ error: 'Invalid domain format' });
        }

        console.log(`\n🔍 New scan request for domain: ${domain}`);
        
        const results = await scanner.run(domain);
        res.json(results);

    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ 
            error: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        message: 'SMART RECON is ready'
    });
});

// Root endpoint - serve info
app.get('/', (req, res) => {
    res.json({
        name: 'AI RECON PRO',
        version: '2.0.0',
        endpoints: {
            health: '/api/health',
            scan: '/api/smart-recon (POST with {"domain": "example.com"})'
        }
    });
});

// ==================== EXPORT FOR VERCEL ====================
module.exports = app;

// ==================== LOCAL DEVELOPMENT ONLY ====================
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(50));
        console.log(`🚀 SMART RECON running locally on port ${PORT}`);
        console.log(`📡 API: http://localhost:${PORT}/api/smart-recon`);
        console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
        console.log('='.repeat(50));
    });
}
