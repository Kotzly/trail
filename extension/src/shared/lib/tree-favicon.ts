import type { NavigationTreeJSON } from '../types/tree.js';
import type { NavigationNodeJSON } from '../types/node.js';
import type { FaviconUrl } from '../types/ids.js';

type DomainInfo = {
  domain: string;
  count: number;
  publicFavicon: FaviconUrl | null;
};

/**
 * Проверяет, является ли favicon URL публичным (доступным извне расширения).
 * Публичные URL начинаются с https:// или http://.
 * Все остальное (chrome-extension://, chrome://, data:, etc.) -- приватное.
 */
function isPublicFaviconUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

/**
 * Извлекает домен из URL.
 * Возвращает null если URL невалидный или не содержит домена.
 */
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Создает Google Favicon API URL для домена.
 * Формат: https://www.google.com/s2/favicons?domain=<domain>&sz=32
 */
function createGoogleFaviconUrl(domain: string): FaviconUrl {
  const url = new URL('https://www.google.com/s2/favicons');
  url.searchParams.set('domain', domain);
  url.searchParams.set('sz', '32');
  return url.toString() as FaviconUrl;
}

/**
 * Рекурсивно обходит узел дерева и собирает информацию о доменах.
 */
function traverseNode(
  node: NavigationNodeJSON,
  domainMap: Map<string, DomainInfo>
): void {
  const url = node.data?.url;
  if (url && typeof url === 'string') {
    const domain = extractDomain(url);
    if (domain) {
      const favicon = node.data?.favicon;
      const publicFavicon =
        favicon && typeof favicon === 'string' && isPublicFaviconUrl(favicon)
          ? (favicon as FaviconUrl)
          : null;

      const existing = domainMap.get(domain);
      if (existing) {
        existing.count++;
        // Обновляем публичный favicon если его не было, но появился
        if (!existing.publicFavicon && publicFavicon) {
          existing.publicFavicon = publicFavicon;
        }
      } else {
        domainMap.set(domain, {
          domain,
          count: 1,
          publicFavicon,
        });
      }
    }
  }

  // Рекурсивно обрабатываем детей
  for (const child of node.children ?? []) {
    traverseNode(child, domainMap);
  }
}

/**
 * Находит лучший favicon для trail на основе самого частого домена.
 *
 * Алгоритм:
 * 1. Обходит все узлы дерева
 * 2. Группирует по домену и считает частоту
 * 3. Для каждого домена запоминает публичный favicon (если есть)
 * 4. Возвращает публичный favicon самого частого домена
 * 5. Если ни у одного домена нет публичного favicon -- использует Google Favicon API для самого частого домена
 *
 * @param tree JSON представление дерева навигации
 * @returns Favicon URL (публичный) или null если дерево пустое
 */
export function findBestTrailFavicon(
  tree: NavigationTreeJSON
): FaviconUrl | null {
  if (!tree.root) return null;

  const domainMap = new Map<string, DomainInfo>();
  traverseNode(tree.root, domainMap);

  if (domainMap.size === 0) return null;

  // Сортируем домены по частоте (убывание)
  const domains = Array.from(domainMap.values()).sort(
    (a, b) => b.count - a.count
  );

  // Ищем самый частый домен с публичным favicon
  for (const info of domains) {
    if (info.publicFavicon) {
      return info.publicFavicon;
    }
  }

  // Если ни у одного домена нет публичного favicon, используем Google Favicon API
  // для самого частого домена
  const mostFrequentDomain = domains[0];
  if (!mostFrequentDomain) return null;
  return createGoogleFaviconUrl(mostFrequentDomain.domain);
}
