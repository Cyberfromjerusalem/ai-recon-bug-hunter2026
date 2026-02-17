const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const http = require('http');
const dns = require('dns').promises;

const app = express();
app.use(cors());
app.use(express.json());

const execPromise = util.promisify(exec);

// ==================== STEP 1: ASSET DISCOVERY ====================
async function assetDiscovery(domain) {
    console.log(`\n📡 Step 1: Asset Discovery for ${domain}`);
    const domains = new Set();
    
    try {
        // First, try using dig for common subdomains (works everywhere)
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
            'sandbox', 'playground', 'lab', 'labs', 'testlab'
        ];

        // Add main domain
        domains.add(domain);
        domains.add(`www.${domain}`);

        // Check each subdomain with DNS
        for (const sub of commonSubs) {
            const subdomain = `${sub}.${domain}`;
            try {
                await dns.resolve4(subdomain);
                domains.add(subdomain);
                console.log(`   ✅ Found: ${subdomain}`);
            } catch (e) {
                // Try AAAA (IPv6)
                try {
                    await dns.resolve6(subdomain);
                    domains.add(subdomain);
                    console.log(`   ✅ Found: ${subdomain} (IPv6)`);
                } catch (e2) {
                    // Not found, skip
                }
            }
        }

        // Check HTTP/HTTPS for each domain
        console.log('\n   Checking HTTP/HTTPS status...');
        const liveDomains = [];
        for (const sub of domains) {
            try {
                // Try HTTPS first
                const httpsCheck = await checkHttp(`https://${sub}`);
                if (httpsCheck.online) {
                    liveDomains.push({
                        domain: sub,
                        url: `https://${sub}`,
                        statusCode: httpsCheck.statusCode,
                        https: true
                    });
                    continue;
                }

                // Try HTTP
                const httpCheck = await checkHttp(`http://${sub}`);
                if (httpCheck.online) {
                    liveDomains.push({
                        domain: sub,
                        url: `http://${sub}`,
                        statusCode: httpCheck.statusCode,
                        https: false
                    });
                }
            } catch (e) {
                // Domain not responding
            }
        }

        console.log(`\n   📊 Found ${domains.size} total domains, ${liveDomains.length} live`);
        return {
            all: Array.from(domains),
            live: liveDomains
        };

    } catch (error) {
        console.error('   Asset discovery error:', error.message);
        return {
            all: [domain, `www.${domain}`],
            live: []
        };
    }
}

// Helper to check HTTP/HTTPS
function checkHttp(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, {
            timeout: 3000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReconBot/1.0)' }
        }, (res) => {
            resolve({
                online: true,
                statusCode: res.statusCode,
                headers: res.headers
            });
            res.destroy();
        }).on('error', () => {
            resolve({ online: false });
        });

        req.setTimeout(3000, () => {
            req.destroy();
            resolve({ online: false });
        });
    });
}

// ==================== STEP 2: URL EXTRACTION ====================
async function extractUrls(domain, liveDomains) {
    console.log(`\n🔗 Step 2: URL Extraction for ${domain}`);
    const urls = new Set();

    try {
        // Get URLs from Wayback Machine
        console.log('   Fetching from Wayback Machine...');
        const waybackUrls = await fetchWaybackUrls(domain);
        waybackUrls.forEach(url => urls.add(url));

        // Get URLs from CommonCrawl
        console.log('   Fetching from CommonCrawl...');
        const ccUrls = await fetchCommonCrawlUrls(domain);
        ccUrls.forEach(url => urls.add(url));

        // Generate common paths for each live domain
        console.log('   Generating common paths...');
        const commonPaths = [
            '/robots.txt', '/sitemap.xml', '/.env', '/.git/config',
            '/wp-config.php', '/backup.zip', '/database.sql', '/backup.sql',
            '/phpinfo.php', '/info.php', '/test.php', '/.htaccess',
            '/config.php', '/configuration.php', '/settings.py',
            '/.aws/credentials', '/.npmrc', '/.bash_history',
            '/secret', '/private', '/hidden', '/admin', '/administrator',
            '/api/docs', '/swagger.json', '/openapi.json', '/graphql',
            '/logs', '/log.txt', '/error.log', '/debug.log',
            '/dump.sql', '/db.sql', '/data.sql', '/backup.tar.gz',
            '/backup.zip', '/backup.rar', '/backup.7z', '/backup.tgz',
            '/.ssh/id_rsa', '/.ssh/id_dsa', '/.ssh/authorized_keys',
            '/composer.json', '/package.json', '/yarn.lock', '/Gemfile',
            '/requirements.txt', '/Pipfile', '/Dockerfile',
            '/.dockerignore', '/.gitignore', '/.env.local', '/.env.production'
        ];

        // Add URLs from live domains
        const domainsToList = liveDomains.length > 0 
            ? liveDomains.map(d => d.domain)
            : [domain, `www.${domain}`, `api.${domain}`, `admin.${domain}`];

        for (const sub of domainsToList) {
            for (const path of commonPaths) {
                urls.add(`https://${sub}${path}`);
                urls.add(`http://${sub}${path}`);
            }
        }

        console.log(`   ✅ Total unique URLs: ${urls.size}`);
        return Array.from(urls);

    } catch (error) {
        console.error('   URL extraction error:', error.message);
        return [];
    }
}

async function fetchWaybackUrls(domain) {
    const urls = [];
    try {
        const { stdout } = await execPromise(
            `curl -s "http://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=text&fl=original&collapse=urlkey" | head -2000`,
            { timeout: 10000 }
        );
        
        stdout.split('\n').forEach(line => {
            if (line.trim() && line.includes(domain)) {
                urls.push(line.trim());
            }
        });
    } catch (e) {
        console.log('      Wayback fetch failed (non-critical)');
    }
    return urls;
}

async function fetchCommonCrawlUrls(domain) {
    const urls = [];
    try {
        const { stdout } = await execPromise(
            `curl -s "http://index.commoncrawl.org/CC-MAIN-2024-10-index?url=*.${domain}/*&output=json" | jq -r '.url' 2>/dev/null | head -500`,
            { timeout: 10000 }
        );
        
        stdout.split('\n').forEach(line => {
            if (line.trim() && line.includes(domain)) {
                urls.push(line.trim());
            }
        });
    } catch (e) {
        console.log('      CommonCrawl fetch failed (non-critical)');
    }
    return urls;
}

// ==================== STEP 3: SMART GREP (FILES + SECRETS) ====================
function smartGrep(urls) {
    console.log(`\n🔍 Step 3: Smart Grep - Finding Sensitive Files and Secrets`);
    
    const results = {
        sensitiveFiles: [],
        secrets: [],
        highValueUrls: []
    };

    // ===== HIGH-RISK FILE EXTENSIONS =====
    const fileExtensions = [
        'zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz', 'tgz', 'tbz2',
        'backup', 'bak', 'bck', 'old', 'orig', 'copy',
        'config', 'conf', 'cfg', 'ini', 'env', 'yml', 'yaml', 'json',
        'xml', 'toml', 'properties', 'plist', 'cnf', 'reg',
        'log', 'logs', 'debug', 'trace', 'audit', 'out', 'err',
        'sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'dbf', 'dmp', 'dump',
        'java', 'php', 'py', 'rb', 'go', 'js', 'ts', 'cs', 'cpp',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
        'pem', 'key', 'crt', 'cer', 'p12', 'pfx', 'jks', 'keystore',
        'asc', 'gpg', 'pgp', 'pub',
        'htaccess', 'htpasswd', 'git', 'svn', 'gitignore',
        'dockerignore', 'npmignore', 'bower.json', 'composer.json',
        'package.json', 'package-lock.json', 'yarn.lock', 'Gemfile',
        'requirements.txt', 'Pipfile', 'swagger', 'openapi'
    ];

    // ===== HIGH-SIGNAL SECRET PATTERNS (from your regex) =====
    const secretRegex = /(?i)(?:(?:access_key|access_token|admin_pass|admin_user|algolia_admin_key|algolia_api_key|alias_pass|alicloud_access_key|amazon_secret_access_key|amazonaws|ansible_vault_password|aos_key|api_key|api_key_secret|api_key_sid|api_secret|api[._-]?googlemaps[._-]?aiza|apidocs|apikey|apiSecret|app_debug|app_id|app_key|app_log_level|app_secret|appkey|appkeysecret|application_key|appsecret|appspot|auth_token|authorizationToken|authsecret|aws_access|aws_access_key_id|aws_bucket|aws_key|aws_secret|aws_secret_key|aws_token|AWSSecretKey|b2_app_key|bashrc[._-]?password|bintray_apikey|bintray_gpg_password|bintray_key|bintraykey|bluemix_api_key|bluemix_pass|browserstack_access_key|bucket_password|bucketeer_aws_access_key_id|bucketeer_aws_secret_access_key|built_branch_deploy_key|bx_password|cache_driver|cache_s3_secret_key|cattle_access_key|cattle_secret_key|certificate_password|ci_deploy_password|client_secret|client_zpk_secret_key|clojars_password|cloud_api_key|cloud_watch_aws_access_key|cloudant_password|cloudflare_api_key|cloudflare_auth_key|cloudinary_api_secret|cloudinary_name|codecov_token|config|conn[._-]?login|connectionstring|consumer_key|consumer_secret|credentials|cypress_record_key|database_password|database_schema_test|datadog_api_key|datadog_app_key|db_password|db_server|db_username|dbpasswd|dbpassword|dbuser|deploy_password|digitalocean_ssh_key_body|digitalocean_ssh_key_ids|docker_hub_password|docker_key|docker_pass|docker_passwd|docker_password|dockerhub_password|dockerhubpassword|dot[._-]?files|dotfiles|droplet_travis_password|dynamoaccesskeyid|dynamosecretaccesskey|elastica_host|elastica_port|elasticsearch_password|encryption_key|encryption_password|env[._-]?heroku_api_key|env[._-]?sonatype_password|eureka[._-]?awssecretkey)[a-z0-9_.,-]{0,25})[:<>=|]{1,2}.{0,5}['"]([0-9A-Za-z\-_=]{8,64})['"]/g;

    // Additional simple patterns for quick matching
    const simplePatterns = [
        { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
        { name: 'Google API', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
        { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
        { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
        { name: 'Password in URL', pattern: /[?&]password=[^&\s]+/gi },
        { name: 'Token in URL', pattern: /[?&]token=[^&\s]+/gi },
        { name: 'API Key in URL', pattern: /[?&]api[_-]?key=[^&\s]+/gi },
        { name: 'Secret in URL', pattern: /[?&]secret=[^&\s]+/gi }
    ];

    // Process each URL
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        // Check file extensions
        const urlPath = url.split('?')[0];
        const ext = urlPath.split('.').pop()?.toLowerCase();
        
        if (ext && fileExtensions.includes(ext)) {
            results.sensitiveFiles.push({
                url,
                extension: ext
            });
            results.highValueUrls.push(url);
        }

        // Check for complex secret patterns
        const complexMatches = url.match(secretRegex);
        if (complexMatches) {
            results.secrets.push({
                url,
                type: 'Complex Secret Pattern',
                matches: complexMatches.slice(0, 3)
            });
            results.highValueUrls.push(url);
        }

        // Check for simple patterns
        for (const pattern of simplePatterns) {
            const matches = url.match(pattern.pattern);
            if (matches) {
                results.secrets.push({
                    url,
                    type: pattern.name,
                    matches: matches.slice(0, 3)
                });
                results.highValueUrls.push(url);
                break;
            }
        }

        // Progress indicator
        if (i % 500 === 0 && i > 0) {
            console.log(`      Processed ${i}/${urls.length} URLs...`);
        }
    }

    // Remove duplicates
    results.highValueUrls = [...new Set(results.highValueUrls)];
    
    // Deduplicate secrets (keep first occurrence)
    const seenUrls = new Set();
    results.secrets = results.secrets.filter(s => {
        if (seenUrls.has(s.url)) return false;
        seenUrls.add(s.url);
        return true;
    });

    console.log(`\n   📊 Results:`);
    console.log(`      - Sensitive Files: ${results.sensitiveFiles.length}`);
    console.log(`      - Secrets Found: ${results.secrets.length}`);
    console.log(`      - High-Value URLs: ${results.highValueUrls.length}`);

    return results;
}

// ==================== API ENDPOINTS ====================

app.post('/api/smart-recon', async (req, res) => {
    try {
        const { domain } = req.body;
        
        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        // Validate domain
        const domainRegex = /^([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            return res.status(400).json({ error: 'Invalid domain format' });
        }

        console.log('\n' + '='.repeat(70));
        console.log(`🚀 SMART RECON SCAN STARTED for ${domain}`);
        console.log('='.repeat(70));

        const startTime = Date.now();

        // Step 1: Asset Discovery
        const assets = await assetDiscovery(domain);
        
        // Step 2: URL Extraction
        const urls = await extractUrls(domain, assets.live);
        
        // Step 3: Smart Grep
        const findings = smartGrep(urls);

        const results = {
            success: true,
            domain,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            summary: {
                totalDomains: assets.all.length,
                liveDomains: assets.live.length,
                totalUrls: urls.length,
                sensitiveFiles: findings.sensitiveFiles.length,
                secretsFound: findings.secrets.length,
                highValueUrls: findings.highValueUrls.length
            },
            data: {
                domains: assets.all.slice(0, 100),
                liveDomains: assets.live.slice(0, 50),
                urls: urls.slice(0, 1000),
                sensitiveFiles: findings.sensitiveFiles.slice(0, 200),
                secrets: findings.secrets.slice(0, 100),
                highValueUrls: findings.highValueUrls.slice(0, 200)
            }
        };

        console.log('\n' + '='.repeat(70));
        console.log('✅ SCAN COMPLETE');
        console.log(`⏱️  Duration: ${(results.duration / 1000).toFixed(2)}s`);
        console.log(`📊 Summary:`);
        console.log(`   - Domains found: ${results.summary.totalDomains}`);
        console.log(`   - Live domains: ${results.summary.liveDomains}`);
        console.log(`   - URLs extracted: ${results.summary.totalUrls}`);
        console.log(`   - Sensitive files: ${results.summary.sensitiveFiles}`);
        console.log(`   - Secrets found: ${results.summary.secretsFound}`);
        console.log(`   - High-value URLs: ${results.summary.highValueUrls}`);
        console.log('='.repeat(70));

        res.json(results);

    } catch (error) {
        console.error('❌ Scan error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            tip: 'Make sure domain is valid (e.g., example.com)'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        endpoints: {
            scan: 'POST /api/smart-recon with {"domain": "example.com"}'
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'SMART RECON',
        version: '2.0.0',
        description: 'Professional reconnaissance tool',
        endpoints: {
            health: '/api/health',
            scan: '/api/smart-recon (POST with {"domain": "example.com"})'
        }
    });
});

// ==================== EXPORT FOR VERCEL ====================
module.exports = app;

// ==================== LOCAL DEVELOPMENT ====================
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
