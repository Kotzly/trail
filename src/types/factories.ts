import type { Title, Url } from "./ids";

export function urlToTitle(url: Url): Title {
    return url as unknown as Title;
}