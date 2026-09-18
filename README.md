# V&C Mente Convergente

Site institucional e Portal **Meus Acessos** da V&C reunidos no mesmo projeto Vercel. O site apresenta o ecossistema, direciona as jornadas comerciais e consulta o V&C Core para exibir somente os produtos liberados para cada conta.

## Arquitetura

- Um único projeto público: `vc-mente-convergente`.
- Conteúdo institucional estático em HTML, CSS e JavaScript.
- Catálogo público em `produtos.html`.
- Portal autenticado em `entrar.html`, também exposto por `/meus-acessos` e `/admin`.
- Identidade, sessões e recuperação de senha pelo Supabase Auth.
- Direitos de acesso, organizações, convites e licenças coletivas pelo V&C Core.
- Nenhuma chave privilegiada é enviada ao navegador; o frontend usa somente a chave publicável.

## Páginas principais

- `/`: apresentação da V&C e caminhos para o ecossistema.
- `/produtos`: catálogo público das soluções V&C.
- `/entrar`: cadastro, login, recuperação de senha e acesso aos produtos.
- `/meus-acessos`: atalho estável para o Portal.
- `/admin`: atalho para a área administrativa protegida pelo mesmo login.
- `/empresas`, `/escolas`, `/palestras` e `/sobre-edgar`: jornadas institucionais.
- `/contato`: contato oficial por e-mail.

As páginas históricas continuam publicadas para preservar links existentes e conteúdo já indexado.

## Desenvolvimento e verificação

O projeto não possui dependências de runtime. Para validar sintaxe, links, marca, Portal e configuração Vercel:

```bash
npm run check
```

Para servir a pasta localmente:

```bash
python3 -m http.server 4173
```

## Publicação

A branch `main` está conectada ao projeto Vercel existente. Pull requests e branches geram previews; a produção só deve ser atualizada depois da homologação do preview. As rotas e os cabeçalhos de segurança são definidos em `vercel.json`.

## Estrutura relevante

- `assets/css/styles.css`: site institucional e catálogo.
- `assets/css/portal.css`: interface segura do Portal.
- `assets/js/main.js`: navegação, contato e formulários institucionais.
- `assets/js/portal.js`: Auth, sessão e integração com o V&C Core.
- `tests/site.test.mjs`: controles automáticos da consolidação.
- `vercel.json`: URLs limpas, atalhos do Portal e cabeçalhos de segurança.

Documentos históricos de visão e roadmap foram mantidos no repositório como referência e não substituem o estado operacional atual.
