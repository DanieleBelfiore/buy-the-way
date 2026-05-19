import { useHead } from '@unhead/vue';
import { useI18n } from 'vue-i18n';

export interface DocumentHeadOptions {
  titleKey: string;
  descriptionKey: string;
  ogImage?: string;
}

const DEFAULT_OG_IMAGE = '/branding/og-image.png';

export const useDocumentHead = (options: DocumentHeadOptions): void => {
  const { t, locale } = useI18n();
  const title = () => t(options.titleKey);
  const description = () => t(options.descriptionKey);
  const ogImage = options.ogImage ?? DEFAULT_OG_IMAGE;

  useHead({
    title,
    htmlAttrs: {
      lang: () => locale.value,
    },
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: ogImage },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
    ],
  });
};
