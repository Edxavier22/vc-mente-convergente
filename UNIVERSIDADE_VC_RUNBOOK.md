# Universidade V&C — estado e sequência de ativação

## O que o código entrega
- Página pública `/universidade-vc`, mantendo o site institucional único.
- Área `/aluno-lideranca` com dez módulos, 20 horas **planejadas** em blocos orientados de 45+75 minutos, evidências e avaliação.
- O conteúdo das aulas vive apenas na função privada `vc-universidade-course` no Supabase; a função consulta a identidade e os direitos no V&C Core a cada acesso. O repositório público contém apenas a interface. Sem direito ativo P-021, retorna 403. Não confundir proteção contra acesso anônimo com impedimento de cópia por um aluno legítimo.
- As evidências e conclusões de módulos são gravadas em `vc_course_evidence` com RLS para o próprio aluno e um rascunho local de contingência. A avaliação formativa ainda é corrigida no navegador, sem registro oficial de tentativas. Não anunciar certificado automático até implementar e homologar essa etapa.

## Gate antes de vender
1. Homologar o conteúdo com ao menos uma pessoa piloto; verificar duração real, linguagem, correção das respostas e resultado das oficinas. A estimativa de 20h vem do desenho de atividades, não de um relógio verificável no navegador.
2. Validar em conta real a gravação de evidências; implementar tentativas de avaliação e critério de conclusão auditável. Configurar certificado de conclusão apenas após esse registro funcionar.
3. Confirmar titular e aplicação Mercado Pago; configurar secrets do adapter já existente no V&C Core; testar pagamentos e webhook em sandbox.
4. Publicar o site institucional em preview da branch, verificar 200 para página pública, 401 anônimo, 403 usuário sem matrícula e 200 para conta autorizada. Só depois promover a produção.
5. Criar release ativo e oferta ativa somente após deploy e compra teste. A migration insere produto e oferta em desenvolvimento/rascunho, sem cobrança.
6. Fazer compra real de baixo valor autorizada e conferir conciliação, liberação, cancelamento e revogação. Após isso, ativar botão de compra e campanha.

## Decisão comercial
Mercado Pago Checkout Pro é a opção inicial: já foi escolhida na arquitetura V&C e existe adapter no Core. Acrescentar uma área de membros de Kiwify ou Hotmart traria segunda identidade e fonte de acesso. Preço proposto para teste do curso completo: R$ 147 à vista, sem preço anterior riscado nem limite fictício de vagas. Confirmar margem após taxas vigentes e primeiras conversões.

## Segurança
Não publicar o material em diretório estático; não confiar em esconder botão como proteção. Token e direito são verificados no servidor. Rascunhos locais contêm texto escrito pelo aluno; evitar dados pessoais de terceiros. O endpoint retorna `Cache-Control: private, no-store`. Não expor segredos do Mercado Pago ou chaves privilegiadas no cliente, Git ou arquivos de entrega.
