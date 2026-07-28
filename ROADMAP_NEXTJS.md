# ROADMAP NEXT.JS - Migracao futura para plataforma SaaS

## Objetivo

Migrar o site estatico para uma plataforma escalavel com conteudo, funis, pagamentos, areas logadas, dashboards e relatorios do REAL 360 Psicossocial.

## Estrutura sugerida

- Next.js App Router.
- TypeScript.
- Tailwind ou design system proprio.
- CMS para blog, paginas e materiais.
- Banco PostgreSQL.
- Autenticacao com perfis: pessoa, empresa, escola, consultor e administrador.
- Pagamentos via provedor online.
- CRM e automacao de e-mail.

## Modulos

- Site institucional.
- Blog e SEO programatico.
- Loja de livros e produtos digitais.
- Area Universidade REAL.
- Aplicacao REAL 360 Psicossocial.
- Dashboard B2B.
- Relatorios PDF.
- Biblioteca REAL Intervention System.
- CASE ZERO onboarding.

## Dados e seguranca

- Politica de privacidade.
- Consentimento de participantes.
- Separacao entre dados individuais e relatorios agregados.
- Logs de acesso.
- Criptografia em transito e repouso.
- Rotinas de exportacao e exclusao.

## Primeiro MVP SaaS

1. Cadastro de empresa.
2. Cadastro de colaboradores ou link anonimo.
3. Questionario REAL 360 Psicossocial.
4. Calculo IMPR.
5. Dashboard executivo.
6. Relatorio agregado.
7. Plano 30/60/90 dias.
8. Exportacao PDF.

## Migracao pratica

- Transformar cada HTML atual em rota Next.js.
- Converter header/footer em componentes.
- Criar tokens de design.
- Migrar formularios para APIs.
- Adicionar analytics e eventos de conversao.
- Criar testes visuais e responsivos.
