export function normalizeSearchText(text) {
    if(text === null || text === undefined) {
        return '';
    }

    return text
        .toString()
        .replace(/İ/g, 'i')
        .replace(/I/g, 'ı')
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

export function searchMatches(target, query) {
    if(!query || !query.trim()) {
        return true;
    }

    const normalizedQuery = normalizeSearchText(query);
    if(!normalizedQuery) {
        return true;
    }

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const normalizedTarget = normalizeSearchText(target);

    return tokens.every((token) => normalizedTarget.includes(token));
}

