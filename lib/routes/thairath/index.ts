import { Route, Data, DataItem } from '@/types';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import ofetch from '@/utils/ofetch';
import type { Context } from 'hono';

interface NewsImage {
    thumbnail?: string;
    square?: string;
    panorama?: string;
}

interface ParentTopic {
    title?: string;
    titleEn?: string;
    path?: string;
}

interface BreadcrumbItem {
    page?: string;
    pageEn?: string;
    link?: string;
    level?: string;
    title?: string;
    titleEn?: string;
    path?: string;
}

interface ImageSML {
    small?: string;
    medium?: string;
    large?: string;
}

interface ThumbnailImage {
    EntityType?: number;
    display?: string;
    video?: any;
    image?: string;
    shareImage?: string;
    shareImage_webp?: string;
    imageSML?: ImageSML;
    imageAvif?: {
        display?: string;
        image?: string;
        shareImage?: string;
    };
}

interface ContentWidget {
    topview?: Array<{
        id: number;
        type: number;
        viewCount: number;
        title: string;
        abstract: string;
        tags: any[];
        fullpath: string;
        thumbnail: string;
    }>;
    hotnews?: Array<{
        id: number;
        type: string;
        title: string;
        section: string;
        sectionEn: string;
        topic: string;
        topicEn: string;
        topicPath: string;
        fullPath: string;
        abstract: string;
        publishTime: string;
        publishTimeTh: string;
        showTime: string;
        canonical: string;
        premiumType: string;
        image: {
            jpg: string;
            webp: string;
        };
    }>;
    hotClips?: Array<{
        id: number;
        type: string;
        section: string;
        sectionEn: string;
        title: string;
        topic: string;
        topicEn: string;
        abstract: string;
        topicPath: string;
        fullPath: string;
        publishTime: string;
        publishTimeTh: string;
        showTime: string;
        image: {
            jpg: string;
            webp: string;
        };
        duration: string;
        canonical: string;
        youtubeId: any;
        source: string;
        props: {
            ratio: string;
            showAd: boolean;
            jwplayer: any;
            topic: string;
            type: string;
            program: string;
            channel: string;
            srcPath: string;
            byteplusId: string;
        };
        program: {
            name: string;
            url: string;
        };
    }>;
}

interface DetailedArticleItem {
    id: number;
    title: string;
    type: number;
    subType?: string;
    sourceFrom?: string;
    entityType?: number;
    sectionId?: string;
    section?: string;
    sectionEn?: string;
    topicId?: string;
    topic?: string;
    topicEn?: string;
    contentarea?: any;
    contentareaEn?: any;
    topicPath?: string;
    fullPath: string;
    categoryName?: any;
    categoryNameEn?: any;
    categoryFullPath?: any;
    categoryFullPathTh?: any;
    breadcrumb?: BreadcrumbItem[];
    thumbnail?: ThumbnailImage;
    abstract?: string;
    image?: string;
    imageSML?: ImageSML;
    content?: string;
    embeds?: any[];
    hasVideo?: any;
    Gallery?: any[];
    tags?: string[];
    publishTime: string;
    publishTimeTh?: string;
    viewCount?: number;
    credit?: string;
    canonical?: string;
    layout?: {
        readmore?: boolean;
        theme?: string;
    };
    related_id?: any[];
    relates?: any[];
    factcheck?: any;
    premiumType?: string;
    followTopic?: any;
    writer?: any;
    storytelling?: string;
    creator_id?: number;
    team_id?: number;
    character?: number;
    migrationByApi?: boolean;
    logoSponsor?: any[];
    contentwidget?: ContentWidget;
    similar?: string;
    recommended?: string;
    contextual?: any;
    policy_ads?: string;
    voice?: boolean;
    nextContent?: any[];
    previousContent?: any[];
    videoReco?: any[];
}

interface NewsItem {
    id: number;
    _id?: string;
    type?: number;
    title: string;
    abstract?: string;
    content?: string;
    sourceFrom?: string;
    credit?: string;
    label?: any[];
    section?: string;
    sectionEn?: string;
    topic?: string;
    topicEn?: string;
    topicPath?: string;
    parentTopic?: ParentTopic;
    tags?: string[];
    publishTs?: number;
    publishTime: string;
    publishTimeTh?: string;
    image?: string;
    image_medium?: string;
    image_large?: string;
    fullPath: string;
    canonical?: string;
    premiumType?: string;
    images?: NewsImage;
    props?: {
        highlights?: Record<string, string>;
        showAd?: boolean;
        jwplayer?: any;
        topic?: string;
        program?: string;
        channel?: string;
        srcPath?: string;
        byteplusId?: string;
    };
    coverImage?: {
        url?: string;
    };
    imageSML?: ImageSML;
    thumbnail?: ThumbnailImage;
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
    video?: NewsItem[];
    column?: NewsItem[];
    pr?: NewsItem[];
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

// Get the best available image from different possible sources
function getBestImage(item: NewsItem | DetailedArticleItem) {
    // First try specific image paths from the thumbnail
    if ('thumbnail' in item && item.thumbnail) {
        if (item.thumbnail.shareImage) {
            return item.thumbnail.shareImage;
        }
        if (item.thumbnail.image) {
            return item.thumbnail.image;
        }
    }

    // Try the images object for list page items
    if ('images' in item && item.images) {
        if (item.images.panorama) {
            return item.images.panorama;
        }
        if (item.images.square) {
            return item.images.square;
        }
        if (item.images.thumbnail) {
            return item.images.thumbnail;
        }
    }

    // Try imageSML for detail page items
    if (item.imageSML) {
        if (item.imageSML.large) {
            return item.imageSML.large;
        }
        if (item.imageSML.medium) {
            return item.imageSML.medium;
        }
        if (item.imageSML.small) {
            return item.imageSML.small;
        }
    }

    // Fall back to standard image field
    if (item.image) {
        return item.image;
    }

    // Try coverImage for list items
    if ('coverImage' in item && item.coverImage && item.coverImage.url) {
        return item.coverImage.url;
    }

    // If nothing found
    return '';
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
    const commonState = jsonData.props?.initialState?.common?.data;

    if (newsState?.items) {
        // For news category pages
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
            ...(items.video || []),
            ...(items.column || []),
            ...(items.pr || []),
        ];
    } else if (commonState?.items) {
        // For homepage or other section pages
        const items = commonState.items as NewsData;
        newsList = [
            ...(items.highlight || []),
            ...(items.panorama || []),
            ...(items.scoop || []),
            ...(items.toplasted || []),
            ...(items.lastestNews || []),
            ...(items.breakingNews || []),
            ...(items.popular || []),
            ...(items.loadmore || []),
            ...(items.video || []),
            ...(items.column || []),
            ...(items.pr || []),
        ];
    } else if (contentState?.items) {
        // For article pages
        const articleItem = contentState.items as DetailedArticleItem;

        // Get the best image from thumbnail or other sources
        const imageUrl = getBestImage(articleItem);

        // Create image HTML if image exists
        const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${articleItem.title || 'Thairath News'}" referrerpolicy="no-referrer" /></p>` : '';

        // 清理文章内容
        const cleanedContent = cleanHtmlContent(articleItem.content) || articleItem.abstract || '';

        const item: DataItem = {
            title: articleItem.title,
            description: `${imageHtml}${cleanedContent}`,
            pubDate: parseDate(articleItem.publishTime),
            link: url,
            author: articleItem.credit || articleItem.sourceFrom,
            category: articleItem.tags,
        };

        return {
            title: `Thairath - ${articleItem.title || 'News'}`,
            link: url,
            item: [item],
        };
    } else if (jsonData.props?.initialProps?.pageProps?.items) {
        // For article pages with a different structure
        const articleItem = jsonData.props.initialProps.pageProps.items as DetailedArticleItem;

        // Get the best image from thumbnail or other sources
        const imageUrl = getBestImage(articleItem);

        // Create image HTML if image exists
        const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${articleItem.title || 'Thairath News'}" referrerpolicy="no-referrer" /></p>` : '';

        // 清理文章内容
        const cleanedContent = cleanHtmlContent(articleItem.content) || articleItem.abstract || '';

        const item: DataItem = {
            title: articleItem.title,
            description: `${imageHtml}${cleanedContent}`,
            pubDate: parseDate(articleItem.publishTime),
            link: url,
            author: articleItem.credit || articleItem.sourceFrom,
            category: articleItem.tags,
        };

        return {
            title: `Thairath - ${articleItem.title || 'News'}`,
            link: url,
            item: [item],
        };
    }

    // Remove duplicates by id
    newsList = newsList.filter((item, index, self) => index === self.findIndex((t) => t.id === item.id));

    // Fetch full article content for each item
    const items: DataItem[] = await Promise.all(
        newsList.slice(0, 50).map(async (item) => {
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
                            // Get the best image from various sources
                            const imageUrl = getBestImage(articleContent);

                            // Create image HTML if image exists
                            const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${articleContent.title}" referrerpolicy="no-referrer" /></p>` : '';

                            // 清理文章内容
                            const cleanedContent = cleanHtmlContent(articleContent.content) || articleContent.abstract || '';

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
                    const imageUrl = getBestImage(item);
                    const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${item.title}" referrerpolicy="no-referrer" /></p>` : '';

                    return {
                        title: item.title,
                        description: `${imageHtml}${item.abstract || ''}`,
                        pubDate: parseDate(item.publishTime),
                        link: articleUrl,
                        author: item.credit || item.sourceFrom,
                        category: item.tags,
                    };
                } catch {
                    // If article fetch fails, return basic info with image if available
                    const imageUrl = getBestImage(item);
                    const imageHtml = imageUrl ? `<p><img src="${imageUrl}" alt="${item.title}" referrerpolicy="no-referrer" /></p>` : '';

                    return {
                        title: item.title,
                        description: `${imageHtml}${item.abstract || ''}`,
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
