const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== SMART GREP FUNCTION ====================
function smartGrep(domain) {
    console.log(`\n🔍 Running Smart Grep for ${domain}`);
    
    // These are example URLs that would normally come from subfinder/katana
    // In a real scenario, these would be fetched from APIs
    const exampleUrls = [
        `https://${domain}/.env`,
        `https://${domain}/backup.zip`,
        `https://${domain}/database.sql`,
        `https://${domain}/.git/config`,
        `https://${domain}/wp-config.php`,
        `https://${domain}/logs/error.log`,
        `https://${domain}/config.json`,
        `https://api.${domain}/v1/users?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`,
        `https://admin.${domain}/login?password=admin123`,
        `https://dev.${domain}/.aws/credentials`,
        `https://staging.${domain}/.env.local`,
        `https://backup.${domain}/backup.tar.gz`,
        `https://private.${domain}/secret.key`,
        `https://cdn.${domain}/config.yml`,
        `https://api.${domain}/v2/docs?api_key=AKIAIOSFODNN7EXAMPLE`,
        `https://admin.${domain}/phpinfo.php`,
        `https://dev.${domain}/composer.json`,
        `https://staging.${domain}/package.json`,
        `https://logs.${domain}/application.log`,
        `https://db.${domain}/dump.sql`,
        `https://files.${domain}/backup.rar`,
        `https://old.${domain}/backup.zip`,
        `https://test.${domain}/test.php`,
        `https://dev.${domain}/.htaccess`,
        `https://admin.${domain}/.htpasswd`,
        `https://secure.${domain}/private.key`,
        `https://auth.${domain}/auth?token=ghp_abcdefghijklmnopqrstuvwxyz1234567890`,
        `https://api.${domain}/v3/data?access_token=EAACEdEose0cBA1234567890abcdef`,
        `https://cdn.${domain}/config.json?secret=sk_live_1234567890abcdefghijklmn`,
        `https://backup.${domain}/backup.7z`,
        `https://data.${domain}/database.sqlite`,
        `https://cache.${domain}/cache.db`,
        `https://logs.${domain}/debug.log`,
        `https://temp.${domain}/temp.txt`,
        `https://old.${domain}/old.sql`,
        `https://new.${domain}/new.zip`,
        `https://private.${domain}/private.pdf`,
        `https://docs.${domain}/documentation.docx`,
        `https://files.${domain}/data.xlsx`,
        `https://cdn.${domain}/users.csv`,
        `https://api.${domain}/v1/users.csv`,
        `https://admin.${domain}/users.json`,
        `https://dev.${domain}/config.yml`,
        `https://staging.${domain}/config.yaml`,
        `https://prod.${domain}/config.xml`,
        `https://test.${domain}/config.ini`,
        `https://dev.${domain}/.npmrc`,
        `https://admin.${domain}/.dockerignore`,
        `https://api.${domain}/.gitignore`,
        `https://cdn.${domain}/Dockerfile`,
        `https://backup.${domain}/requirements.txt`,
        `https://data.${domain}/Pipfile`,
        `https://logs.${domain}/Gemfile`,
        `https://temp.${domain}/yarn.lock`,
        `https://old.${domain}/package-lock.json`,
        `https://new.${domain}/bower.json`,
        `https://private.${domain}/composer.lock`
    ];

    // ===== HIGH-RISK FILE EXTENSIONS =====
    const sensitiveExtensions = [
        'zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz', 'tgz', 'tbz2',
        'backup', 'bak', 'bck', 'old', 'orig', 'copy',
        'env', 'config', 'conf', 'cfg', 'ini', 'yml', 'yaml', 'json',
        'xml', 'toml', 'properties', 'plist', 'cnf', 'reg',
        'log', 'logs', 'debug', 'trace', 'audit', 'out', 'err',
        'sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'dbf', 'dmp', 'dump',
        'pem', 'key', 'crt', 'cer', 'p12', 'pfx', 'jks', 'keystore',
        'asc', 'gpg', 'pgp', 'pub',
        'htaccess', 'htpasswd', 'git', 'svn', 'gitignore',
        'dockerignore', 'npmignore', 'bower.json', 'composer.json',
        'package.json', 'package-lock.json', 'yarn.lock', 'Gemfile',
        'requirements.txt', 'Pipfile', 'swagger', 'openapi',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'
    ];

    // ===== SECRET PATTERNS =====
    const secretPatterns = [
        { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
        { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/ },
        { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/ },
        { name: 'Facebook Token', pattern: /EAACEdEose0cBA[0-9A-Za-z]+/ },
        { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/ },
        { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/ },
        { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/ },
        { name: 'Password in URL', pattern: /[?&]password=[^&\s]+/i },
        { name: 'Token in URL', pattern: /[?&]token=[^&\s]+/i },
        { name: 'API Key in URL', pattern: /[?&]api[_-]?key=[^&\s]+/i },
        { name: 'Secret in URL', pattern: /[?&]secret=[^&\s]+/i }
    ];

    const sensitiveFiles = [];
    const secrets = [];
    const highValueUrls = [];

    // Check each URL
    exampleUrls.forEach(url => {
        // Check file extensions
        const urlPath = url.split('?')[0];
        const ext = urlPath.split('.').pop()?.toLowerCase();
        
        if (ext && sensitiveExtensions.includes(ext)) {
            sensitiveFiles.push({ url, extension: ext });
            highValueUrls.push(url);
        }

        // Check for secrets
        for (const pattern of secretPatterns) {
            if (pattern.pattern.test(url)) {
                secrets.push({ url, type: pattern.name });
                highValueUrls.push(url);
                break;
            }
        }
    });

    // Remove duplicates
    const uniqueSensitiveFiles = [...new Map(sensitiveFiles.map(item => [item.url, item])).values()];
    const uniqueSecrets = [...new Map(secrets.map(item => [item.url, item])).values()];
    const uniqueHighValueUrls = [...new Set(highValueUrls)];

    return {
        sensitiveFiles: uniqueSensitiveFiles,
        secrets: uniqueSecrets,
        highValueUrls: uniqueHighValueUrls,
        allUrls: exampleUrls
    };
}

// ==================== API ENDPOINTS ====================

app.post('/api/smart-recon', (req, res) => {
    try {
        const { domain } = req.body;
        
        if (!domain) {
            return res.status(400).json({ 
                success: false, 
                error: 'Domain is required' 
            });
        }

        console.log(`\n🔍 Scanning domain: ${domain}`);
        
        // Run smart grep
        const findings = smartGrep(domain);

        // Return results
        const results = {
            success: true,
            domain,
            timestamp: new Date().toISOString(),
            duration: 1500, // Simulated duration in ms
            summary: {
                totalUrls: findings.allUrls.length,
                sensitiveFiles: findings.sensitiveFiles.length,
                secretsFound: findings.secrets.length,
                highValueUrls: findings.highValueUrls.length
            },
            data: {
                allUrls: findings.allUrls,
                sensitiveFiles: findings.sensitiveFiles,
                secrets: findings.secrets,
                highValueUrls: findings.highValueUrls
            }
        };

        console.log(`✅ Found ${findings.sensitiveFiles.length} sensitive files and ${findings.secrets.length} secrets`);
        res.json(results);

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Scan failed'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        message: 'SMART RECON is ready'
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'SMART RECON',
        version: '1.0.0',
        endpoints: {
            health: 'GET /api/health',
            scan: 'POST /api/smart-recon with {"domain": "example.com"}'
        }
    });
});

// ==================== EXPORT FOR VERCEL ====================
module.exports = app;

// ==================== LOCAL DEVELOPMENT ====================
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\n🚀 SMART RECON running on http://localhost:${PORT}`);
        console.log(`📡 Test with: curl -X POST http://localhost:${PORT}/api/smart-recon -H "Content-Type: application/json" -d '{"domain": "example.com"}'`);
    });
}
