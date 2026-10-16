import { blogPostPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/routing';
import type { BlogCard, BlogPost } from './blog';

const articles = [
  {
    key: 'manco-capac-mama-ocllo-tradiciones-titicaca', tag: 'leyendas',
    source: 'https://www.peru.travel/es/atractivos/lago-titicaca',
    translations: {
      es: { title: 'Manco Cápac y Mama Ocllo: las voces del Titicaca', excerpt: 'Una leyenda de origen con distintas versiones, para escuchar con respeto.', body: 'La tradición vincula a Manco Cápac y Mama Ocllo con las aguas del Titicaca y la fundación del mundo inca. Es un relato de origen, no una crónica histórica comprobada.\n\nLas versiones varían: algunas los presentan como hijos del Sol; otra, recogida por PROMPERÚ, los relaciona con Viracocha. Ninguna versión resume por sí sola toda la memoria andina.\n\nAl visitar el lago, pregunta a tus anfitriones cómo conocen esta historia. Escuchar sus palabras permite acercarse a una tradición viva sin convertirla en una única explicación.' },
      en: { title: 'Manco Cápac and Mama Ocllo: voices of Titicaca', excerpt: 'An origin legend with different versions, best approached through respectful listening.', body: 'Tradition connects Manco Cápac and Mama Ocllo with Lake Titicaca and the founding of the Inca world. This is an origin story, rather than a verified historical chronicle.\n\nVersions differ: some describe them as children of the Sun; another, recorded by PROMPERÚ, connects them with Viracocha. No single version represents all Andean memory.\n\nWhen visiting the lake, ask your hosts how they know the story. Listening to their words offers a way into a living tradition without reducing it to one explanation.' },
      pt: { title: 'Manco Cápac e Mama Ocllo: as vozes do Titicaca', excerpt: 'Uma lenda de origem com diferentes versões, para ouvir com respeito.', body: 'A tradição relaciona Manco Cápac e Mama Ocllo às águas do Titicaca e à fundação do mundo inca. Trata-se de uma narrativa de origem, e não de uma crônica histórica comprovada.\n\nAs versões variam: algumas os apresentam como filhos do Sol; outra, registrada pela PROMPERÚ, os relaciona a Viracocha. Nenhuma versão representa sozinha toda a memória andina.\n\nAo visitar o lago, pergunte aos seus anfitriões como conhecem essa história. Ouvir suas palavras aproxima você de uma tradição viva, sem reduzi-la a uma única explicação.' },
    },
  },
  {
    key: 'taquile-arte-textil-patrimonio-vivo', tag: 'guias',
    source: 'https://ich.unesco.org/en/RL/taquile-and-its-textile-art-00166',
    translations: {
      es: { title: 'Taquile: el tejido como patrimonio vivo', excerpt: 'Más que un recuerdo de viaje: un arte que forma parte de la vida cotidiana.', body: 'En Taquile, el arte textil forma parte de la vida diaria de mujeres y hombres de distintas edades. La UNESCO lo incluyó en su Lista Representativa del Patrimonio Cultural Inmaterial de la Humanidad en 2008, tras su proclamación en 2005.\n\nDurante tu visita, pide permiso antes de fotografiar y pregunta por el trabajo de cada pieza. El patrimonio pertenece a quienes lo mantienen vivo.' },
      en: { title: 'Taquile: weaving as living heritage', excerpt: 'More than a travel souvenir: an art woven into everyday life.', body: 'On Taquile, textile art is part of everyday life for women and men of different ages. UNESCO inscribed it on its Representative List of the Intangible Cultural Heritage of Humanity in 2008, following its proclamation in 2005.\n\nDuring your visit, ask before taking photographs and learn about the work behind each piece. This heritage belongs to the people who keep it alive.' },
      pt: { title: 'Taquile: a tecelagem como patrimônio vivo', excerpt: 'Mais que uma lembrança de viagem: uma arte presente no cotidiano.', body: 'Em Taquile, a arte têxtil faz parte do cotidiano de mulheres e homens de diferentes idades. A UNESCO a inscreveu na Lista Representativa do Patrimônio Cultural Imaterial da Humanidade em 2008, após sua proclamação em 2005.\n\nDurante a visita, peça permissão antes de fotografar e conheça o trabalho por trás de cada peça. Esse patrimônio pertence às pessoas que o mantêm vivo.' },
    },
  },
] as const;

/** Editorial guides, not traveller submissions. No invented authors or publication dates. */
export function journalArticles(locale: Locale): BlogPost[] {
  return articles.map(article => {
    const text = article.translations[locale];
    const alternates = { es: blogPostPath('es', article.key), en: blogPostPath('en', article.key), pt: blogPostPath('pt', article.key) };
    const sourceLabel = locale === 'en' ? 'Source' : locale === 'pt' ? 'Fonte' : 'Fuente';
    return { key: article.key, slug: article.key, path: alternates[locale], alternates, fallback: false,
      title: text.title, excerpt: text.excerpt, body: `${text.body}\n\n[${sourceLabel}: ${article.tag === 'leyendas' ? 'PROMPERÚ' : 'UNESCO'}](${article.source})${article.tag === 'leyendas' ? '\n\n[PROMPERÚ — Titicaca](https://www.peru.travel/stories/lake-titicaca-the-beginning-of-the-inca-empire)' : ''}`,
      image: { src: '/hero-motion/titicaca-0.webp', alt: locale === 'en' ? 'Lake Titicaca' : 'Lago Titicaca' },
      publishedAt: null, author: null, tags: [article.tag], metaTitle: text.title, metaDescription: text.excerpt };
  });
}

/** CMS/seed entries win by canonical key; a colliding locale URL must never be duplicated. */
export function mergeJournalArticles<T extends BlogCard>(existing: T[], curated: T[]): T[] {
  const keys = new Set(existing.map(post => post.key));
  const paths = new Set(existing.map(post => post.path));
  return [...existing, ...curated.filter(post => !keys.has(post.key) && !paths.has(post.path))];
}
