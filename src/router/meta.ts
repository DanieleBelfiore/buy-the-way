export interface RouteMeta {
  titleKey: string;
  descriptionKey: string;
  public?: boolean;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  login: {
    titleKey: 'seo.login.title',
    descriptionKey: 'seo.login.description',
    public: true,
  },
  'email-link-callback': {
    titleKey: 'seo.login.title',
    descriptionKey: 'seo.login.description',
    public: true,
  },
  about: {
    titleKey: 'seo.about.title',
    descriptionKey: 'seo.about.description',
    public: true,
  },
  privacy: {
    titleKey: 'seo.privacy.title',
    descriptionKey: 'seo.privacy.description',
    public: true,
  },
  terms: {
    titleKey: 'seo.terms.title',
    descriptionKey: 'seo.terms.description',
    public: true,
  },
  lists: {
    titleKey: 'seo.lists.title',
    descriptionKey: 'seo.lists.description',
  },
  settings: {
    titleKey: 'seo.settings.title',
    descriptionKey: 'seo.settings.description',
  },
  stats: {
    titleKey: 'seo.stats.title',
    descriptionKey: 'seo.stats.description',
  },
};

export const PUBLIC_ROUTE_NAMES: ReadonlySet<string> = new Set(
  Object.entries(ROUTE_META)
    .filter(([, meta]) => meta.public)
    .map(([name]) => name),
);
