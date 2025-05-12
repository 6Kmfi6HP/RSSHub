import { Route, Data, DataItem } from '@/types';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import ofetch from '@/utils/ofetch';
import type { Context } from 'hono';

interface NewsItem {
    id: number;
    title: string;
    abstract: string;
    publishTime: string;
    fullPath: string;
    credit?: string;
    sourceFrom?: string;
    tags?: string[];
    image?: string;
    coverImage?: {
        url?: string;
    };
    content?: string;
}

interface NewsData {
    highlight?: NewsItem[];
    panorama?: NewsItem[];
    scoop?: NewsItem[];
    toplasted?: NewsItem[];
    lastestNews?: NewsItem[];
    breakingNews?: NewsItem[];
    popular?: NewsItem[];
    loadmore?: NewsItem[];
}

export const route: Route = {
    path: '/:category?/:subcategory?/:region?',
    categories: ['traditional-media'],
    example: '/thairath/news/local',
    parameters: {
        category: {
            description: 'Category. Default is empty (homepage). Available: news, sport, entertainment, tv, world, etc.',
            default: '',
        },
        subcategory: {
            description: 'Subcategory. For example under "news" category: local, crime, politics, etc.',
        },
        region: {
            description: 'Region. For some subcategories like local: bangkok, central, north, northeast, east, south, etc.',
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['thairath.co.th/:category?/:subcategory?/:region?', 'thairath.co.th/'],
            target: '/:category?/:subcategory?/:region?',
        },
    ],
    name: 'News',
    maintainers: ['DIYgod'],
    handler,
};

// 清理HTML内容中的复杂图片标签，只保留简单的img标签
function cleanHtmlContent(content = '') {
    if (!content) {
        return '';
    }

    const $ = load(content);

    // 处理figure/picture组合
    $('figure picture').each((_, element) => {
        const picture = $(element);
        const img = picture.find('img');

        // 如果找到img标签
        if (img.length > 0) {
            const src = img.attr('src') || '';
            const alt = img.attr('alt') || '';

            // 创建新的img标签替换整个picture
            picture.parent().html(`<img src="${src}" alt="${alt}" referrerpolicy="no-referrer" />`);
        }
    });

    // 处理单独的picture标签
    $('picture').each((_, element) => {
        const picture = $(element);
        const img = picture.find('img');

        if (img.length > 0) {
            const src = img.attr('src') || '';
            const alt = img.attr('alt') || '';

            // 替换整个picture标签为img
            picture.replaceWith(`<img src="${src}" alt="${alt}" referrerpolicy="no-referrer" />`);
        }
    });

    // 确保所有img标签都有referrerpolicy属性
    $('img').each((_, element) => {
        $(element).attr('referrerpolicy', 'no-referrer');
    });

    return $.html();
}

async function handler(ctx: Context): Promise<Data> {
    const category = ctx.req.param('category') || '';
    const subcategory = ctx.req.param('subcategory') || '';
    const region = ctx.req.param('region') || '';

    // Build the URL path based on available parameters
    let path = '';
    if (category) {
        path += `/${category}`;
        if (subcategory) {
            path += `/${subcategory}`;
            if (region) {
                path += `/${region}`;
            }
        }
    }

    const baseUrl = 'https://www.thairath.co.th';
    const url = path ? `${baseUrl}${path}` : baseUrl;

    // Set request headers to mimic browser behavior
    const headers = {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'th-TH;q=0.9,th;q=0.8',
        'cache-control': 'no-cache',
        'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        referer: 'https://www.thairath.co.th/',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    };

    const response = await ofetch(url, { headers });

    // Extract JSON data from the Next.js data script
    const $ = load(response);
    const nextDataText = $('#__NEXT_DATA__').text();
    if (!nextDataText) {
        throw new Error('Could not find __NEXT_DATA__');
    }

    const jsonData = JSON.parse(nextDataText);

    // Extract the news data based on the structure
    let newsList: NewsItem[] = [];

    // Check different possible locations of news data
    const newsState = jsonData.props?.initialState?.news?.data;
    const contentState = jsonData.props?.initialState?.content?.data;

    if (newsState?.items) {
        // For list pages
        const items = newsState.items as NewsData;
        newsList = [
            ...(items.highlight || []),
            ...(items.panorama || []),
            ...(items.scoop || []),
            ...(items.toplasted || []),
            ...(items.lastestNews || []),
            ...(items.breakingNews || []),
            ...(items.popular || []),
            ...(items.loadmore || []),
        ];
    } else if (contentState?.items) {
        // For article pages (redirecting to list)
        // Get image URL from coverImage if available
        const coverImageUrl = contentState.items.coverImage?.url || contentState.items.image;

        // Create image HTML if image exists
        const imageHtml = coverImageUrl ? `<p><img src="${coverImageUrl}" alt="${contentState.items.title || 'Thairath News'}" referrerpolicy="no-referrer" /></p>` : '';

        // 清理文章内容
        const cleanedContent = cleanHtmlContent(contentState.items.content) || contentState.items.abstract;

        const item: DataItem = {
            title: contentState.items.title,
            description: `${imageHtml}${cleanedContent}`,
            pubDate: parseDate(contentState.items.publishTime),
            link: url,
            author: contentState.items.credit || contentState.items.sourceFrom,
            category: contentState.items.tags,
        };

        return {
            title: `Thairath - ${contentState.items.title || 'News'}`,
            link: url,
            item: [item],
        };
    }

    // Remove duplicates by id
    newsList = newsList.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id));

    // Fetch full article content for each item
    const items: DataItem[] = await Promise.all(
        newsList.slice(0, 15).map(async (item) => {
            const articleUrl = `${baseUrl}${item.fullPath}`;

            const cachedItem = await cache.tryGet(`thairath:${item.id}`, async () => {
                try {
                    const articleResponse = await ofetch(articleUrl, { headers });
                    const article$ = load(articleResponse);
                    const articleNextData = article$('#__NEXT_DATA__').text();

                    if (articleNextData) {
                        const articleJsonData = JSON.parse(articleNextData);
                        const articleContent = articleJsonData.props?.initialState?.content?.data?.items;

                        if (articleContent) {
                            // Get image URL from coverImage if available, fallback to item.image
                            const imageUrl = articleContent.coverImage?.url || articleContent.image || item.coverImage?.url || item.image;

                            // Create image HTML if image exists
                            const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${articleContent.title}" referrerpolicy="no-referrer" /></p>` : '';

                            // 清理文章内容
                            const cleanedContent = cleanHtmlContent(articleContent.content) || articleContent.abstract;

                            return {
                                title: articleContent.title,
                                description: `${imageHtml}${cleanedContent}`,
                                pubDate: parseDate(articleContent.publishTime),
                                link: articleUrl,
                                author: articleContent.credit || articleContent.sourceFrom,
                                category: articleContent.tags,
                            };
                        }
                    }

                    // Fallback if article data cannot be extracted
                    const imageUrl = item.coverImage?.url || item.image;
                    const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${item.title}" referrerpolicy="no-referrer" /></p>` : '';

                    return {
                        title: item.title,
                        description: `${imageHtml}${item.abstract}`,
                        pubDate: parseDate(item.publishTime),
                        link: articleUrl,
                        author: item.credit || item.sourceFrom,
                        category: item.tags,
                    };
                } catch {
                    // If article fetch fails, return basic info with image if available
                    const imageUrl = item.coverImage?.url || item.image;
                    const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${item.title}" referrerpolicy="no-referrer" /></p>` : '';

                    return {
                        title: item.title,
                        description: `${imageHtml}${item.abstract}`,
                        pubDate: parseDate(item.publishTime),
                        link: articleUrl,
                        author: item.credit || item.sourceFrom,
                        category: item.tags,
                    };
                }
            });

            return cachedItem as DataItem;
        })
    );

    // Create a category title from the parameters
    let categoryTitle = 'News';
    if (category) {
        categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        if (subcategory) {
            categoryTitle += ` - ${subcategory.charAt(0).toUpperCase() + subcategory.slice(1)}`;
            if (region) {
                categoryTitle += ` - ${region.charAt(0).toUpperCase() + region.slice(1)}`;
            }
        }
    }

    return {
        title: `Thairath - ${categoryTitle}`,
        link: url,
        item: items,
    };
}
