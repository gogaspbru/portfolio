<?php
/*
 * Котозахват — загрузчик чужих страниц для игры (работает на обычном PHP-хостинге).
 *
 *   fetch.php?mode=page&url=https://example.com   → JSON { url, html } — HTML страницы в UTF-8
 *   fetch.php?mode=asset&url=https://…/a.png      → сама картинка / стиль / шрифт
 *   fetch.php?mode=check                          → самопроверка хостинга (PHP, curl, кеш, выход в сеть)
 *
 * Безопасность:
 *  - только http/https и стандартные порты 80/443;
 *  - защита от SSRF: адрес резолвится, приватные/локальные/служебные IP запрещены,
 *    соединение «прибивается» к проверенному IP (без повторного DNS), каждый редирект проверяется заново;
 *  - таймауты и лимит размера;
 *  - лимит запросов с одного IP;
 *  - кеш ровно на 24 часа, просроченное удаляется;
 *  - чужой HTML никогда не отдаётся как text/html с нашего домена (только внутри JSON),
 *    картинки/стили — с заголовком CSP sandbox, чтобы SVG со скриптом не выполнился.
 * Совместимо с PHP 7.4+.
 */

// ---------------- настройки ----------------
const CACHE_TTL = 86400;                  // 24 часа — дольше не храним
const PAGE_MAX_BYTES = 3 * 1024 * 1024;   // HTML страницы
const ASSET_MAX_BYTES = 5 * 1024 * 1024;  // картинка, стиль, шрифт
const CONNECT_TIMEOUT = 5;
const TOTAL_TIMEOUT = 12;
const MAX_REDIRECTS = 5;
// лимиты с одного IP: [запросов, за секунд]
const RATE_LIMITS = ['page' => [15, 600], 'asset' => [1500, 600]];
const ALLOWED_PORTS = [80, 443];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Kotozahvat/1.0 (+https://goga.spb.ru/kot/)';
const CACHE_DIR = __DIR__ . '/cache';

// Только для локальной разработки: разрешить localhost. На хостинге переменной окружения нет.
define('DEV_ALLOW_LOCAL', getenv('KOTOZAHVAT_DEV_ALLOW_LOCAL') === '1');

// ---------------- вход ----------------
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fail(405, 'method', 'Только GET');
// Прокси только для самой игры: браузеры помечают запросы с чужих сайтов
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') fail(403, 'cross_site', 'Только для игры');

$mode = $_GET['mode'] ?? '';
if ($mode === 'check') selfCheck();
if ($mode !== 'page' && $mode !== 'asset') fail(400, 'mode', 'Неизвестный режим');

$url = normalizeUrl((string)($_GET['url'] ?? ''));
if ($url === null) fail(400, 'bad_url', 'Такой адрес котику нельзя');

rateLimit($mode);
maybeCleanupCache();

if ($mode === 'page') servePage($url);
serveAsset($url);

// ---------------- режимы ----------------

function servePage(string $url): void
{
    $key = 'page_' . hash('sha256', $url);
    $cached = cacheGet($key);
    if ($cached !== null) {
        sendJson(200, $cached);
    }
    $accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5';
    $noScheme = !preg_match('~^https?://~i', trim((string)($_GET['url'] ?? '')));
    $r = httpGet($url, PAGE_MAX_BYTES, $accept, $noScheme);
    if ($r === null) {
        // адрес ввели без схемы и https не ответил — пробуем старый добрый http
        $url = preg_replace('~^https://~', 'http://', $url);
        $r = httpGet($url, PAGE_MAX_BYTES, $accept);
    }
    $status = $r['status'];
    if (in_array($status, [401, 403, 407, 429, 451, 503], true)) fail(502, 'blocked', 'Сайт не пустил котика');
    if ($status >= 400) fail(502, 'http_' . $status, 'Сайт не открылся');
    $type = strtolower($r['type']);
    if ($type !== '' && strpos($type, 'html') === false) fail(502, 'not_html', 'По этому адресу не страница сайта');
    $html = toUtf8($r['body'], $type);
    if (looksLikeBotWall($html)) fail(502, 'blocked', 'Сайт не пустил котика');
    $data = ['url' => $r['url'], 'html' => $html];
    cacheSet($key, $data);
    sendJson(200, $data);
}

function serveAsset(string $url): void
{
    $key = 'asset_' . hash('sha256', $url);
    $cached = cacheGet($key);
    if ($cached === null) {
        $r = httpGet($url, ASSET_MAX_BYTES, 'image/avif,image/webp,image/*,text/css,font/*,*/*;q=0.5');
        if ($r['status'] >= 400) fail(502, 'http_' . $r['status'], 'Не загрузилось');
        $type = allowedAssetType($r['type'], $r['url']);
        if ($type === null) fail(415, 'type', 'Такой файл не нужен');
        $cached = ['type' => $type, 'body' => base64_encode($r['body'])];
        cacheSet($key, $cached);
    }
    header('Content-Type: ' . $cached['type']);
    header('Cache-Control: public, max-age=' . CACHE_TTL);
    header("Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; sandbox");
    echo base64_decode($cached['body']);
    exit;
}

/** Картинки, стили и шрифты — остальное не отдаём */
function allowedAssetType(string $type, string $url): ?string
{
    $t = strtolower(trim(explode(';', $type)[0]));
    $ok = [
        'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
        'image/x-icon', 'image/vnd.microsoft.icon', 'image/bmp',
        'text/css',
        'font/woff', 'font/woff2', 'font/ttf', 'font/otf', 'font/sfnt',
        'application/font-woff', 'application/font-woff2', 'application/x-font-woff',
        'application/x-font-ttf', 'application/x-font-otf', 'application/vnd.ms-fontobject',
    ];
    if (in_array($t, $ok, true)) return $t === 'text/css' ? 'text/css; charset=utf-8' : $t;
    // некоторые сервера отдают шрифты и картинки как octet-stream — смотрим на расширение
    $path = strtolower((string)parse_url($url, PHP_URL_PATH));
    $byExt = [
        'woff2' => 'font/woff2', 'woff' => 'font/woff', 'ttf' => 'font/ttf', 'otf' => 'font/otf',
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif',
        'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'css' => 'text/css; charset=utf-8',
    ];
    $ext = pathinfo($path, PATHINFO_EXTENSION);
    if (($t === '' || $t === 'application/octet-stream' || $t === 'text/plain' || $t === 'binary/octet-stream') && isset($byExt[$ext])) {
        return $byExt[$ext];
    }
    return null;
}

// ---------------- адреса и SSRF ----------------

function normalizeUrl(string $raw): ?string
{
    $raw = trim($raw);
    if ($raw === '' || strlen($raw) > 2048) return null;
    if (!preg_match('~^[a-z][a-z0-9+.-]*://~i', $raw)) $raw = 'https://' . $raw;
    $p = parse_url($raw);
    if (!$p || empty($p['host'])) return null;
    $scheme = strtolower($p['scheme'] ?? '');
    if ($scheme !== 'http' && $scheme !== 'https') return null;
    if (isset($p['user']) || isset($p['pass'])) return null;
    $host = strtolower(rtrim($p['host'], '.'));
    if (preg_match('/[^\x20-\x7e]/', $host)) {
        // кириллические домены (.рф) → punycode
        if (!function_exists('idn_to_ascii')) return null;
        $host = idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
        if (!$host) return null;
    }
    $port = isset($p['port']) ? (int)$p['port'] : ($scheme === 'https' ? 443 : 80);
    if (!in_array($port, ALLOWED_PORTS, true) && !DEV_ALLOW_LOCAL) return null;
    $defaultPort = ($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80);
    $path = $p['path'] ?? '/';
    if ($path === '') $path = '/';
    $query = isset($p['query']) && $p['query'] !== '' ? '?' . $p['query'] : '';
    $hostPart = strpos($host, ':') !== false && $host[0] !== '[' ? "[$host]" : $host;
    return $scheme . '://' . $hostPart . ($defaultPort ? '' : ':' . $port) . $path . $query;
}

/** Все адреса хоста должны быть публичными; возвращаем тот, к которому подключимся */
function resolvePublicIp(string $host): ?string
{
    $host = trim($host, '[]');
    if (filter_var($host, FILTER_VALIDATE_IP)) return isPublicIp($host) ? $host : null;
    if (DEV_ALLOW_LOCAL && ($host === 'localhost')) return '127.0.0.1';
    $ips = [];
    $v4 = @gethostbynamel($host);
    if (is_array($v4)) $ips = array_merge($ips, $v4);
    $v6 = @dns_get_record($host, DNS_AAAA);
    if (is_array($v6)) foreach ($v6 as $rec) if (!empty($rec['ipv6'])) $ips[] = $rec['ipv6'];
    if (!$ips) return null;
    foreach ($ips as $ip) if (!isPublicIp($ip)) return null;
    foreach ($ips as $ip) if (strpos($ip, ':') === false) return $ip; // предпочитаем IPv4
    return $ips[0];
}

function isPublicIp(string $ip): bool
{
    if (DEV_ALLOW_LOCAL && ($ip === '127.0.0.1' || $ip === '::1')) return true;
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
    // то, что filter_var может пропустить (зависит от версии PHP)
    $blocked = [
        '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12',
        '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15',
        '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4', '255.255.255.255/32',
        '::/128', '::1/128', '::ffff:0:0/96', '64:ff9b::/96', '100::/64', '2001:db8::/32',
        'fc00::/7', 'fe80::/10', 'ff00::/8',
    ];
    foreach ($blocked as $cidr) if (ipInCidr($ip, $cidr)) return false;
    return true;
}

function ipInCidr(string $ip, string $cidr): bool
{
    [$net, $bits] = explode('/', $cidr);
    $ipBin = @inet_pton($ip);
    $netBin = @inet_pton($net);
    if ($ipBin === false || $netBin === false || strlen($ipBin) !== strlen($netBin)) return false;
    $bits = (int)$bits;
    $bytes = intdiv($bits, 8);
    if ($bytes && substr($ipBin, 0, $bytes) !== substr($netBin, 0, $bytes)) return false;
    $rest = $bits % 8;
    if (!$rest) return true;
    $mask = (0xff << (8 - $rest)) & 0xff;
    return (ord($ipBin[$bytes]) & $mask) === (ord($netBin[$bytes]) & $mask);
}

/** Абсолютный адрес из относительного (для Location при редиректе) */
function resolveUrl(string $base, string $rel): string
{
    if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $rel)) return $rel;
    $b = parse_url($base);
    $origin = $b['scheme'] . '://' . $b['host'] . (isset($b['port']) ? ':' . $b['port'] : '');
    if (strpos($rel, '//') === 0) return $b['scheme'] . ':' . $rel;
    if ($rel !== '' && $rel[0] === '/') return $origin . $rel;
    $dir = preg_replace('~/[^/]*$~', '/', $b['path'] ?? '/');
    if ($rel === '' || $rel[0] === '?') return $origin . ($b['path'] ?? '/') . $rel;
    return $origin . $dir . $rel;
}

// ---------------- HTTP ----------------

/** GET с ручными редиректами: каждый адрес проверяется на SSRF, соединение идёт на проверенный IP */
function httpGet(string $url, int $maxBytes, string $accept, bool $softFail = false): ?array
{
    if (!function_exists('curl_init')) fail(500, 'no_curl', 'На хостинге нет curl');
    for ($i = 0; $i <= MAX_REDIRECTS; $i++) {
        $u = normalizeUrl($url);
        if ($u === null) fail(400, 'bad_url', 'Такой адрес котику нельзя');
        $p = parse_url($u);
        $host = $p['host'];
        $port = $p['port'] ?? ($p['scheme'] === 'https' ? 443 : 80);
        $ip = resolvePublicIp($host);
        if ($ip === null) fail(400, 'private', 'Такой адрес котику нельзя');

        $body = '';
        $headers = [];
        $tooBig = false;
        $ch = curl_init($u);
        curl_setopt_array($ch, [
            CURLOPT_RESOLVE => [trim($host, '[]') . ':' . $port . ':' . (strpos($ip, ':') !== false ? "[$ip]" : $ip)],
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT => TOTAL_TIMEOUT,
            CURLOPT_USERAGENT => USER_AGENT,
            CURLOPT_ENCODING => '', // gzip/deflate/br — curl распакует сам
            CURLOPT_HTTPHEADER => ['Accept: ' . $accept, 'Accept-Language: ru,en;q=0.8'],
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_PROXY => '', // никаких прокси из окружения: соединение строго на проверенный IP
            CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$headers) {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$body, &$tooBig, $maxBytes) {
                if (strlen($body) + strlen($chunk) > $maxBytes) {
                    $tooBig = true;
                    return 0; // обрываем загрузку
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $errno = curl_errno($ch);
        curl_close($ch);
        if ($tooBig) fail(413, 'too_big', 'Сайт слишком тяжёлый для котика');
        if ($ok === false || $status === 0) {
            if ($softFail && $i === 0) return null;
            fail(502, $errno === CURLE_OPERATION_TIMEDOUT ? 'timeout' : 'network', 'Сайт не открылся');
        }
        if ($status >= 300 && $status < 400 && !empty($headers['location'])) {
            $url = resolveUrl($u, $headers['location']);
            continue;
        }
        return ['status' => $status, 'type' => $headers['content-type'] ?? '', 'body' => $body, 'url' => $u];
    }
    fail(502, 'redirects', 'Сайт не открылся');
}

function toUtf8(string $html, string $contentType): string
{
    $fromHeader = preg_match('/charset=["\']?([\w-]+)/i', $contentType, $m) ? strtolower($m[1]) : '';
    $fromMeta = preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', substr($html, 0, 8192), $m) ? strtolower($m[1]) : '';
    $isUtf8 = function_exists('mb_check_encoding') ? mb_check_encoding($html, 'UTF-8') : (bool)preg_match('//u', $html);
    $charset = $fromHeader ?: $fromMeta;
    // заголовок бывает врёт: если байты не UTF-8 — верим meta, а для рунета по умолчанию windows-1251
    if ($charset === '' || $charset === 'utf-8' || $charset === 'utf8') {
        if ($isUtf8) return $html;
        $charset = ($fromMeta && $fromMeta !== 'utf-8' && $fromMeta !== 'utf8') ? $fromMeta : 'windows-1251';
    }
    $out = function_exists('mb_convert_encoding') ? @mb_convert_encoding($html, 'UTF-8', $charset) : false;
    if ($out === false && function_exists('iconv')) $out = @iconv($charset, 'UTF-8//IGNORE', $html);
    return $out === false ? $html : $out;
}

/** Грубая проверка на «проверку, что вы не робот» */
function looksLikeBotWall(string $html): bool
{
    if (strlen($html) > 60000) return false;
    return (bool)preg_match('/(cf-challenge|challenge-platform|captcha|Checking your browser|DDoS-Guard|Доступ ограничен)/i', $html);
}

// ---------------- лимиты и кеш ----------------

function clientIp(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // на хостинге перед PHP может стоять свой nginx — тогда настоящий адрес в заголовке
    if (!isPublicIp($ip)) {
        $fwd = $_SERVER['HTTP_X_REAL_IP'] ?? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0];
        $fwd = trim((string)$fwd);
        if ($fwd !== '' && filter_var($fwd, FILTER_VALIDATE_IP)) $ip = $fwd;
    }
    return $ip;
}

function rateLimit(string $bucket): void
{
    [$limit, $window] = RATE_LIMITS[$bucket];
    $dir = CACHE_DIR . '/rate';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) return; // без кеша — без лимита, но игра работает
    $file = $dir . '/' . hash('sha256', clientIp() . '|' . $bucket) . '.json';
    $fh = @fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $data = json_decode((string)stream_get_contents($fh), true) ?: ['start' => time(), 'count' => 0];
    if (time() - $data['start'] > $window) $data = ['start' => time(), 'count' => 0];
    $data['count']++;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    flock($fh, LOCK_UN);
    fclose($fh);
    if ($data['count'] > $limit) {
        header('Retry-After: ' . max(1, $window - (time() - $data['start'])));
        fail(429, 'rate', 'Слишком много котиков — подожди пару минут');
    }
}

function cachePath(string $key): string
{
    return CACHE_DIR . '/data/' . substr($key, 0, 60) . '.cache';
}

function cacheGet(string $key): ?array
{
    $f = cachePath($key);
    if (!is_file($f)) return null;
    if (time() - filemtime($f) > CACHE_TTL) {
        @unlink($f);
        return null;
    }
    $data = json_decode((string)@file_get_contents($f), true);
    return is_array($data) ? $data : null;
}

function cacheSet(string $key, array $data): void
{
    $dir = CACHE_DIR . '/data';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) return;
    $tmp = cachePath($key) . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)) !== false) {
        @rename($tmp, cachePath($key));
    }
}

/** Изредка чистим просроченное, чтобы ничего не лежало дольше суток */
function maybeCleanupCache(): void
{
    if (mt_rand(1, 50) !== 1) return;
    foreach (['data', 'rate'] as $sub) {
        $files = glob(CACHE_DIR . '/' . $sub . '/*') ?: [];
        foreach ($files as $f) {
            if (is_file($f) && time() - filemtime($f) > CACHE_TTL) @unlink($f);
        }
    }
}

// ---------------- ответы ----------------

function sendJson(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $code, string $message): void
{
    sendJson($status, ['error' => $code, 'message' => $message]);
}

/** fetch.php?mode=check — что умеет хостинг */
function selfCheck(): void
{
    $cacheOk = (is_dir(CACHE_DIR) || @mkdir(CACHE_DIR, 0755, true)) && is_writable(CACHE_DIR);
    $net = null;
    if (function_exists('curl_init')) {
        $ch = curl_init('https://example.com/');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_NOBODY => true, CURLOPT_PROXY => '']);
        curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $net = $code >= 200 && $code < 400 ? 'ok' : ($code ? "ответ $code — выход закрыт?" : 'ошибка: ' . curl_error($ch));
        curl_close($ch);
    }
    sendJson(200, [
        'php' => PHP_VERSION,
        'curl' => function_exists('curl_init'),
        'mbstring' => function_exists('mb_convert_encoding'),
        'intl (домены .рф)' => function_exists('idn_to_ascii'),
        'кеш доступен для записи' => $cacheOk,
        'выход в интернет' => $net,
    ]);
}
