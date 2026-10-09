// Jogar.exe — lançador do Pitch Invaders para Windows.
//
// Procura o jogo (dist\PitchInvaders.html) na pasta onde está o Jogar.exe e abre-o
// numa janela própria, sem barra de endereço (modo "app" do Chrome, Edge ou Brave).
// Se nenhum desses browsers existir, abre o jogo no browser predefinido.
//
// Compilar: scripts/build-launcher.sh (MinGW-w64)

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

#define PATH_CHARS 32768

static const wchar_t *const GAME_FILES[] = {
    L"dist\\PitchInvaders.html",
    L"PitchInvaders.html",
};

// Browsers com modo "app". Nomes simples são resolvidos pelo Windows através do
// registo "App Paths"; caminhos com variáveis cobrem instalações fora desse registo.
static const wchar_t *const BROWSERS[] = {
    L"chrome.exe",
    L"%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe",
    L"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe",
    L"%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe",
    L"msedge.exe",
    L"%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"%LocalAppData%\\Microsoft\\Edge\\Application\\msedge.exe",
    L"brave.exe",
    L"%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    L"%LocalAppData%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
};

static const wchar_t TITLE[] = L"Pitch Invaders";

// Modo de teste: se a variável PITCHINVADERS_DRYRUN apontar para um ficheiro, o
// lançador escreve lá o que faria (em UTF-8) em vez de abrir o browser.
static FILE *g_dry = NULL;

static void dry_log(const wchar_t *label, const wchar_t *value) {
    if (!g_dry) return;
    int n = WideCharToMultiByte(CP_UTF8, 0, value, -1, NULL, 0, NULL, NULL);
    char *u8 = n > 0 ? (char *)malloc((size_t)n) : NULL;
    if (u8) WideCharToMultiByte(CP_UTF8, 0, value, -1, u8, n, NULL, NULL);
    char lab[64];
    WideCharToMultiByte(CP_UTF8, 0, label, -1, lab, (int)sizeof lab, NULL, NULL);
    fprintf(g_dry, "%s=%s\n", lab, u8 ? u8 : "");
    free(u8);
}

static int is_file(const wchar_t *path) {
    DWORD a = GetFileAttributesW(path);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

// Converte um caminho do Windows num URL file:// (UTF-8 com percent-encoding).
//   C:\Jogos\Pitch Invaders\a.html  ->  file:///C:/Jogos/Pitch%20Invaders/a.html
//   \\servidor\partilha\a.html      ->  file://servidor/partilha/a.html
static wchar_t *path_to_file_url(const wchar_t *path) {
    int n = WideCharToMultiByte(CP_UTF8, 0, path, -1, NULL, 0, NULL, NULL);
    if (n <= 0) return NULL;
    char *u8 = (char *)malloc((size_t)n);
    if (!u8) return NULL;
    WideCharToMultiByte(CP_UTF8, 0, path, -1, u8, n, NULL, NULL);

    const char *p = u8;
    const char *prefix = "file:///";
    if (strncmp(p, "\\\\?\\UNC\\", 8) == 0) { p += 8; prefix = "file://"; }
    else if (strncmp(p, "\\\\?\\", 4) == 0) { p += 4; }
    else if (p[0] == '\\' && p[1] == '\\') { p += 2; prefix = "file://"; }

    size_t cap = strlen(prefix) + strlen(p) * 3 + 1;
    wchar_t *url = (wchar_t *)malloc(cap * sizeof(wchar_t));
    if (!url) { free(u8); return NULL; }
    size_t k = 0;
    for (const char *s = prefix; *s; s++) url[k++] = (wchar_t)*s;
    static const char HEX[] = "0123456789ABCDEF";
    for (const unsigned char *s = (const unsigned char *)p; *s; s++) {
        unsigned char c = *s;
        if (c == '\\') c = '/';
        int keep = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
                   c == '-' || c == '.' || c == '_' || c == '~' || c == '/' || c == ':';
        if (keep) {
            url[k++] = (wchar_t)c;
        } else {
            url[k++] = L'%';
            url[k++] = (wchar_t)HEX[c >> 4];
            url[k++] = (wchar_t)HEX[c & 15];
        }
    }
    url[k] = 0;
    free(u8);
    return url;
}

static int launch(const wchar_t *file, const wchar_t *params, const wchar_t *dir) {
    if (g_dry) {
        dry_log(L"try", file);
        return 0; // em modo de teste, regista todas as tentativas
    }
    SHELLEXECUTEINFOW sei;
    ZeroMemory(&sei, sizeof sei);
    sei.cbSize = sizeof sei;
    sei.fMask = SEE_MASK_FLAG_NO_UI | SEE_MASK_NOASYNC;
    sei.lpVerb = L"open";
    sei.lpFile = file;
    sei.lpParameters = params;
    sei.lpDirectory = dir;
    sei.nShow = SW_SHOWMAXIMIZED;
    return ShellExecuteExW(&sei) ? 1 : 0;
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, LPWSTR cmd, int show) {
    (void)inst; (void)prev; (void)cmd; (void)show;

    wchar_t *dry = _wgetenv(L"PITCHINVADERS_DRYRUN");
    if (dry && *dry) g_dry = _wfopen(dry, L"w");

    // Pasta onde está o Jogar.exe.
    wchar_t *dir = (wchar_t *)calloc(PATH_CHARS, sizeof(wchar_t));
    wchar_t *game = (wchar_t *)calloc(PATH_CHARS, sizeof(wchar_t));
    wchar_t *exe = (wchar_t *)calloc(PATH_CHARS, sizeof(wchar_t));
    if (!dir || !game || !exe) return 1;
    DWORD len = GetModuleFileNameW(NULL, dir, PATH_CHARS);
    if (len == 0 || len >= PATH_CHARS) return 1;
    wchar_t *slash = wcsrchr(dir, L'\\');
    if (slash) *slash = 0;
    dry_log(L"dir", dir);

    // Ficheiro do jogo.
    int found = 0;
    for (size_t i = 0; i < sizeof GAME_FILES / sizeof GAME_FILES[0] && !found; i++) {
        _snwprintf(game, PATH_CHARS - 1, L"%ls\\%ls", dir, GAME_FILES[i]);
        found = is_file(game);
    }
    if (!found) {
        dry_log(L"error", L"game-not-found");
        if (g_dry) { fclose(g_dry); return 2; }
        MessageBoxW(NULL,
            L"N\u00e3o encontrei o ficheiro do jogo (dist\\PitchInvaders.html).\n\n"
            L"Se descarregaste o jogo em ZIP, extrai primeiro a pasta toda "
            L"(bot\u00e3o direito no ZIP \u2192 Extrair Tudo\u2026) e depois abre o "
            L"Jogar.exe que est\u00e1 dentro da pasta extra\u00edda.",
            TITLE, MB_OK | MB_ICONWARNING);
        return 2;
    }
    dry_log(L"game", game);

    wchar_t *url = path_to_file_url(game);
    if (!url) return 1;
    dry_log(L"url", url);

    size_t plen = wcslen(url) + 128;
    wchar_t *params = (wchar_t *)malloc(plen * sizeof(wchar_t));
    if (!params) return 1;
    _snwprintf(params, plen - 1, L"--app=\"%ls\" --start-maximized --no-first-run --no-default-browser-check", url);
    params[plen - 1] = 0;
    dry_log(L"params", params);

    // 1) Janela própria num browser com modo "app".
    for (size_t i = 0; i < sizeof BROWSERS / sizeof BROWSERS[0]; i++) {
        const wchar_t *b = BROWSERS[i];
        if (wcschr(b, L'\\')) {
            DWORD n = ExpandEnvironmentStringsW(b, exe, PATH_CHARS);
            if (n == 0 || n > PATH_CHARS || !is_file(exe)) continue;
            if (launch(exe, params, dir)) return 0;
        } else if (launch(b, params, dir)) {
            return 0;
        }
    }

    // 2) Browser predefinido.
    if (launch(game, NULL, dir)) return 0;

    if (g_dry) { fclose(g_dry); return 0; }
    MessageBoxW(NULL,
        L"N\u00e3o consegui abrir um browser.\n\n"
        L"Abre manualmente o ficheiro dist\\PitchInvaders.html com o Chrome, Edge ou Firefox.",
        TITLE, MB_OK | MB_ICONWARNING);
    return 3;
}
