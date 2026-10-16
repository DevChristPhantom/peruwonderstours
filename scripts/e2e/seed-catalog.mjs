import { createPrismaClient } from '../../apps/api/dist/persistence/prisma/prisma-client.js';

// Synthetic translation only. Refuse every target except the workflow's database.
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/disabled');
if (process.env.CI !== 'true' || process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1'].includes(url.hostname)
  || url.pathname !== '/pwt_browser_test') throw new Error('Portuguese catalog fixture requires isolated CI pwt_browser_test.');
const prisma = createPrismaClient(url.toString());
try {
  const tour = await prisma.tour.findUnique({ where: { slug: 'arequipa-colca-profundo-condores-4d-3n' }, select: { id: true, status: true } });
  if (!tour || tour.status !== 'published') throw new Error('Published Arequipa seed tour is required for the Portuguese fixture.');
  if (await prisma.tourTranslation.count({ where: { tourId: tour.id, locale: 'pt' } })) throw new Error('Refusing to overwrite an existing Portuguese translation.');
  await prisma.tourTranslation.create({ data: {
    tourId: tour.id, locale: 'pt', slug: 'arequipa-colca-4-dias-ci',
    title: 'Arequipa e Colca — experiência de teste em português',
    summary: 'Roteiro fictício de quatro dias em Arequipa e no Colca para validar a tradução publicada no ambiente isolado de testes.',
    description: 'Conteúdo sintético para testar a página em português. Conheça Arequipa, os vilarejos do vale e as paisagens do Colca em quatro dias.',
    itinerary: [
      { day: 1, title: 'Chegada a Arequipa', description: 'Recepção e passeio de teste pelo centro histórico.' },
      { day: 2, title: 'Paisagens do Colca', description: 'Viagem fictícia pelo vale com paradas para contemplação.' },
      { day: 3, title: 'Condores e vilarejos', description: 'Visita de teste aos mirantes e retorno a Arequipa.' },
      { day: 4, title: 'Fim do roteiro', description: 'Café da manhã e traslado fictício ao aeroporto.' },
    ],
    includes: ['Transporte fictício para testes', 'Guia de teste em português'],
    notIncluded: ['Voos não incluídos na simulação'], recommendations: ['Leve água e proteção solar.'],
    faqs: [{ question: 'Esta experiência pode ser contratada?', answer: 'Não. Este conteúdo existe somente no ambiente isolado de testes.' }],
    importantNotes: ['Fixture CI: nenhum serviço real é prestado.'],
    policies: 'Conteúdo fictício usado exclusivamente para validar o idioma português.',
    meetingPoint: 'Ponto de encontro fictício em Arequipa',
    seoTitle: 'Arequipa e Colca — teste de tradução em português',
    seoDescription: 'Conteúdo fictício para verificar a página, os cartões e o roteiro publicados em português no ambiente isolado de testes.',
  } });
  console.log('Isolated Portuguese catalog translation fixture created.');
} finally { await prisma.$disconnect(); }
