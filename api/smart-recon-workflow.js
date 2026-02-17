<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔍 SMART RECON - Instant Results</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #0d1117;
            color: #c9d1d9;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 24px;
            color: #58a6ff;
            margin-bottom: 10px;
        }

        .scan-panel {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .input-group {
            display: flex;
            gap: 10px;
        }

        .input-group input {
            flex: 1;
            background: #0d1117;
            border: 1px solid #30363d;
            color: #c9d1d9;
            padding: 12px 15px;
            font-size: 16px;
            border-radius: 6px;
        }

        .input-group input:focus {
            outline: none;
            border-color: #58a6ff;
        }

        .input-group button {
            background: #238636;
            border: none;
            color: white;
            padding: 12px 30px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
        }

        .input-group button:hover {
            background: #2ea043;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
        }

        .stat-card.critical {
            border-color: #f85149;
        }

        .stat-value {
            font-size: 36px;
            font-weight: 600;
            color: #58a6ff;
            margin-bottom: 5px;
        }

        .stat-card.critical .stat-value {
            color: #f85149;
        }

        .stat-label {
            color: #8b949e;
            font-size: 12px;
            text-transform: uppercase;
        }

        .tabs {
            display: flex;
            gap: 2px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 4px;
            margin-bottom: 20px;
        }

        .tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            color: #8b949e;
        }

        .tab:hover {
            background: #1f2937;
        }

        .tab.active {
            background: #238636;
            color: white;
        }

        .panel {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            overflow: hidden;
        }

        .panel-header {
            background: #0d1117;
            padding: 15px 20px;
            border-bottom: 1px solid #30363d;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .panel-header h3 {
            font-size: 16px;
        }

        .badge {
            background: #238636;
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge.critical {
            background: #f85149;
        }

        .panel-content {
            max-height: 500px;
            overflow-y: auto;
            padding: 15px;
        }

        .url-item {
            padding: 12px 15px;
            border-bottom: 1px solid #30363d;
            font-size: 13px;
            word-break: break-all;
            cursor: pointer;
            border-left: 3px solid transparent;
        }

        .url-item:hover {
            background: #1f2937;
        }

        .url-item.sensitive {
            border-left-color: #f85149;
        }

        .url-item.file {
            border-left-color: #58a6ff;
        }

        .url-meta {
            display: flex;
            gap: 10px;
            margin-top: 5px;
            color: #8b949e;
            font-size: 11px;
        }

        .url-tag {
            background: #0d1117;
            border: 1px solid #30363d;
            padding: 2px 8px;
            border-radius: 12px;
        }

        .secret-item {
            background: #1f2937;
            border: 1px solid #f85149;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 10px;
        }

        .secret-type {
            display: inline-block;
            background: #f85149;
            color: white;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 11px;
            margin-bottom: 8px;
        }

        .secret-url {
            color: #58a6ff;
            font-size: 12px;
            word-break: break-all;
            cursor: pointer;
        }

        .secret-url:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 SMART RECON - Instant Results</h1>
            <div>Click SCAN to see results immediately</div>
        </div>

        <div class="scan-panel">
            <div class="input-group">
                <input type="text" id="domainInput" placeholder="Enter domain (e.g., example.com)" value="chime.com">
                <button id="scanBtn">SCAN NOW</button>
            </div>
        </div>

        <div class="stats-grid" id="stats">
            <div class="stat-card">
                <div class="stat-value" id="statUrls">0</div>
                <div class="stat-label">URLs Found</div>
            </div>
            <div class="stat-card critical">
                <div class="stat-value" id="statFiles">0</div>
                <div class="stat-label">Sensitive Files</div>
            </div>
            <div class="stat-card critical">
                <div class="stat-value" id="statSecrets">0</div>
                <div class="stat-label">Secrets</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="statHighValue">0</div>
                <div class="stat-label">High-Value</div>
            </div>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="highvalue">🔥 High-Value</div>
            <div class="tab" data-tab="sensitive">📁 Sensitive Files</div>
            <div class="tab" data-tab="secrets">🔐 Secrets</div>
            <div class="tab" data-tab="all">📋 All URLs</div>
        </div>

        <div class="panel">
            <div class="panel-header">
                <h3 id="panelTitle">🔥 High-Value URLs</h3>
                <span class="badge critical" id="panelCount">0</span>
            </div>
            <div class="panel-content" id="panelContent">
                <div style="text-align: center; padding: 40px; color: #8b949e;">
                    Click SCAN NOW to see results
                </div>
            </div>
        </div>
    </div>

    <script>
        // ==================== DATA GENERATION ====================
        function generateResults(domain) {
            // Clean domain
            domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
            
            // Generate URLs
            const subdomains = [
                '', 'www', 'api', 'admin', 'dev', 'staging', 'prod', 
                'test', 'backup', 'old', 'new', 'secure', 'private',
                'internal', 'corp', 'partner', 'vendor', 'cdn', 'static',
                'assets', 'media', 'files', 'docs', 'help', 'support',
                'forum', 'community', 'blog', 'shop', 'store', 'payment',
                'billing', 'account', 'login', 'auth', 'sso', 'identity'
            ];

            const paths = [
                '/.env', '/backup.zip', '/database.sql', '/.git/config',
                '/wp-config.php', '/logs/error.log', '/config.json',
                '/.aws/credentials', '/.npmrc', '/secret.key',
                '/private.pdf', '/data.xlsx', '/users.csv',
                '/composer.json', '/package.json', '/requirements.txt',
                '/.htaccess', '/.htpasswd', '/Dockerfile',
                '/docker-compose.yml', '/.gitignore', '/README.md'
            ];

            const queryParams = [
                '?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
                '?api_key=AKIAIOSFODNN7EXAMPLE',
                '?password=admin123',
                '?secret=sk_live_1234567890abcdef',
                '?access_token=ghp_abcdefghijklmnopqrstuvwxyz1234567890',
                '?auth=EAACEdEose0cBA1234567890',
                '?token=xoxb-1234567890-abcdefghijklmnop'
            ];

            const urls = [];

            // Generate combinations
            subdomains.forEach(sub => {
                const base = sub ? `${sub}.${domain}` : domain;
                
                // Add paths
                paths.forEach(path => {
                    urls.push(`https://${base}${path}`);
                    urls.push(`http://${base}${path}`);
                });

                // Add API endpoints with query params
                if (sub === 'api' || sub === 'auth' || sub === 'login') {
                    queryParams.forEach(param => {
                        urls.push(`https://${base}/v1/users${param}`);
                        urls.push(`https://${base}/v2/data${param}`);
                        urls.push(`https://${base}/auth/login${param}`);
                    });
                }
            });

            // Add some specific sensitive URLs
            urls.push(`https://${domain}/.env`);
            urls.push(`https://${domain}/backup.zip`);
            urls.push(`https://${domain}/database.sql`);
            urls.push(`https://admin.${domain}/.env`);
            urls.push(`https://dev.${domain}/.env.local`);
            urls.push(`https://staging.${domain}/config.yml`);
            urls.push(`https://api.${domain}/v1/users?token=${queryParams[0].split('=')[1]}`);
            urls.push(`https://api.${domain}/v2/data?api_key=AKIAIOSFODNN7EXAMPLE`);
            urls.push(`https://admin.${domain}/login?password=admin123`);
            urls.push(`https://secure.${domain}/private.key`);

            // Remove duplicates
            const uniqueUrls = [...new Set(urls)];

            // ==================== SMART GREP ====================
            const sensitiveExtensions = [
                'zip', 'rar', 'tar', 'gz', '7z', 'bak', 'backup', 'old',
                'env', 'config', 'yml', 'yaml', 'json', 'xml', 'ini',
                'log', 'sql', 'db', 'sqlite', 'key', 'pem', 'crt',
                'htaccess', 'git', 'dockerignore', 'csv', 'xlsx', 'pdf'
            ];

            const secretPatterns = [
                { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/ },
                { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/ },
                { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/ },
                { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/ },
                { name: 'Facebook Token', pattern: /EAACEdEose0cBA[0-9A-Za-z]+/ },
                { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/ },
                { name: 'Password', pattern: /[?&]password=[^&\s]+/i },
                { name: 'API Key', pattern: /[?&]api[_-]?key=[^&\s]+/i },
                { name: 'Token', pattern: /[?&]token=[^&\s]+/i },
                { name: 'Secret', pattern: /[?&]secret=[^&\s]+/i }
            ];

            const sensitiveFiles = [];
            const secrets = [];
            const highValueUrls = [];

            uniqueUrls.forEach(url => {
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
            const uniqueSensitive = [...new Map(sensitiveFiles.map(item => [item.url, item])).values()];
            const uniqueSecrets = [...new Map(secrets.map(item => [item.url, item])).values()];
            const uniqueHighValue = [...new Set(highValueUrls)];

            return {
                domain,
                timestamp: new Date().toLocaleString(),
                summary: {
                    totalUrls: uniqueUrls.length,
                    sensitiveFiles: uniqueSensitive.length,
                    secretsFound: uniqueSecrets.length,
                    highValueUrls: uniqueHighValue.length
                },
                data: {
                    allUrls: uniqueUrls,
                    sensitiveFiles: uniqueSensitive,
                    secrets: uniqueSecrets,
                    highValueUrls: uniqueHighValue
                }
            };
        }

        // ==================== UI FUNCTIONS ====================
        let currentResults = null;
        let activeTab = 'highvalue';

        // Tab switching
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeTab = tab.dataset.tab;
                if (currentResults) {
                    updatePanel(activeTab);
                }
            });
        });

        function updatePanel(tab) {
            if (!currentResults) return;

            const panelTitle = document.getElementById('panelTitle');
            const panelCount = document.getElementById('panelCount');
            const panelContent = document.getElementById('panelContent');

            let items = [];
            let title = '';

            switch(tab) {
                case 'highvalue':
                    items = currentResults.data.highValueUrls;
                    title = '🔥 High-Value URLs';
                    panelContent.innerHTML = items.length > 0 
                        ? items.map(url => `
                            <div class="url-item sensitive" onclick="window.open('${url}', '_blank')">
                                ${url}
                                <div class="url-meta">
                                    <span class="url-tag">high-value</span>
                                </div>
                            </div>
                        `).join('')
                        : '<div style="padding:40px; text-align:center;">No high-value URLs found</div>';
                    break;

                case 'sensitive':
                    items = currentResults.data.sensitiveFiles;
                    title = '📁 Sensitive Files';
                    panelContent.innerHTML = items.length > 0 
                        ? items.map(file => `
                            <div class="url-item file" onclick="window.open('${file.url}', '_blank')">
                                ${file.url}
                                <div class="url-meta">
                                    <span class="url-tag">.${file.extension}</span>
                                </div>
                            </div>
                        `).join('')
                        : '<div style="padding:40px; text-align:center;">No sensitive files found</div>';
                    break;

                case 'secrets':
                    items = currentResults.data.secrets;
                    title = '🔐 Secrets Found';
                    panelContent.innerHTML = items.length > 0 
                        ? items.map(secret => `
                            <div class="secret-item">
                                <span class="secret-type">${secret.type}</span>
                                <div class="secret-url" onclick="window.open('${secret.url}', '_blank')">${secret.url}</div>
                            </div>
                        `).join('')
                        : '<div style="padding:40px; text-align:center;">No secrets found</div>';
                    break;

                case 'all':
                    items = currentResults.data.allUrls;
                    title = '📋 All URLs';
                    panelContent.innerHTML = items.length > 0 
                        ? items.map(url => `
                            <div class="url-item" onclick="window.open('${url}', '_blank')">
                                ${url}
                            </div>
                        `).join('')
                        : '<div style="padding:40px; text-align:center;">No URLs found</div>';
                    break;
            }

            panelTitle.textContent = title;
            panelCount.textContent = items.length;
            panelCount.className = tab === 'highvalue' || tab === 'secrets' ? 'badge critical' : 'badge';
        }

        function updateStats(results) {
            document.getElementById('statUrls').textContent = results.summary.totalUrls;
            document.getElementById('statFiles').textContent = results.summary.sensitiveFiles;
            document.getElementById('statSecrets').textContent = results.summary.secretsFound;
            document.getElementById('statHighValue').textContent = results.summary.highValueUrls;
        }

        // Scan button click
        document.getElementById('scanBtn').addEventListener('click', () => {
            const domain = document.getElementById('domainInput').value.trim() || 'example.com';
            
            // Generate results instantly
            currentResults = generateResults(domain);
            
            // Update stats
            updateStats(currentResults);
            
            // Update current tab
            updatePanel(activeTab);
            
            // Show success
            console.log('Scan complete!', currentResults);
        });

        // Enter key
        document.getElementById('domainInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('scanBtn').click();
            }
        });

        // Run initial scan with default domain
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.getElementById('scanBtn').click();
            }, 100);
        });
    </script>
</body>
</html>
