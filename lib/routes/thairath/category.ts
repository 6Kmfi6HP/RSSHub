import { Route } from '@/types';
import { route as indexRoute } from './index';

export const route: Route = {
    path: '/:category/:subcategory?/:region?',
    categories: ['traditional-media'],
    example: '/thairath/news/local',
    parameters: {
        category: {
            description: 'Category. Available: news (ข่าว), sport (กีฬา), entertainment (บันเทิง), tv (ทีวี), world (ต่างประเทศ), etc.',
        },
        subcategory: {
            description: 'Subcategory. For example under "news" category: local (ในประเทศ), crime (อาชญากรรม), politics (การเมือง), etc.',
        },
        region: {
            description: 'Region. For some subcategories like local: bangkok (กรุงเทพฯ), central (ภาคกลาง), north (ภาคเหนือ), northeast (ภาคอีสาน), east (ภาคตะวันออก), south (ภาคใต้), etc.',
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
            source: ['thairath.co.th/:category/:subcategory?/:region?'],
            target: '/:category/:subcategory?/:region?',
        },
    ],
    name: 'Category',
    maintainers: ['DIYgod'],
    url: 'thairath.co.th',
    handler: indexRoute.handler,
};
