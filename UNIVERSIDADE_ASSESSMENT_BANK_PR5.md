# PR5 — Banco de questões, checkpoints e prova final

Branch feat/ie-course-assessment-bank; base exata 8a9744bb4d7196bf0b2a20b932882ef8d7e8c3fd. Depends on #14. Stack #11→#12→#13→#14→este PR; sem merge.

## Diagnóstico

PR14 confirmado aberto/Draft no SHA aprovado; source remoto learner v19 e admin v7 idêntico à base. Professor v12 preservado. Questions/options canônicos já suportavam chave estável, versão, competência, nível, status e correct_option_id; banco IE vazio e competências/fontes ainda não materializadas. Liderança tinha checkpoints publicados nas versões1.0/1.1, prova1.1 com30itens e1.0 arquivada. Checkpoint PR2 corrigia por option_id, mas sem sessão congelada antes da resposta. Prova legada corrigia por correct_index, selecionava20 e reconsultava banco atual; cursos estruturados estavam bloqueados nessa rota. Final attempts tinha SELECT autenticado e precisou de grant por coluna para proteger o novo snapshot privado.

## Banco editorial

70 itens redigidos individualmente sobre os temas fornecidos:50checkpoints (cinco por módulo) e20integrativos finais (cinco em cada movimento PERCEBER/REGULAR/RELACIONAR/DECIDIR E EVOLUIR). Nenhum template de geração de perguntas genéricas.

IDs IE-M01-Q01…IE-M10-Q05 e IE-QF01…IE-QF20; UUIDs internos determinísticos coexistem. Cada item contém competência principal C1–C7, nívelN1/N2/N3, tipo, enunciado, quatro opções com IDs e feedback próprio, correta porID, conceito, versão e status. Predominância N2 no checkpoint eN3 na prova; todas as20finais sãoN3.

Banco privado em supabase/seed-data/ie-assessment-bank.v1.json e import canônico. Fonte da arquitetura fornecida classificadaD; fonte suplementar das heurísticasH, ligadas via source_links. Não se apresenta ferramenta V&C como ciência validada. Todos os70 permanecem Draft/inativos em homologação, inclusive após testes.

**Gaps editoriais explícitos:** não foram fornecidos passos/composição oficiais de PENTA,3R,FARO,CPTR,CALMA. Cinco itens avaliam os princípios disponíveis e sinalizam o gap; não inventam a expansão dessas ferramentas. QA/editorial deve validar cobertura e texto antes de publicar. Novas versões/edições poderão completar a cobertura sem alterar tentativa passada. Este PR não inventa aulas ou conceitos científicos.

## Motor e integridade

Reutiliza vc_university_final_sessions para checkpoints e finais por assessment_purpose; nenhum banco/sistema de sessão paralelo. Sessão guarda versão de curso/módulo,20ou5IDs, snapshot privado completo, opções na ordem visual randomizada, identidade correta/feedback/fontes e limiar congelado. Sessão aberta é retomável e expira após24h; não há relógio de pressão. Endpoint devolve apenas projeção pública do instrumento, sem correct_option_id/is_correct/feedback pré-resposta.

RPCs service-only SECURITY INVOKER validam identidade, matrícula fixada, curso publicado, módulo/dependências e todos os10módulos concluídos para prova. Correção recebe question_id/selected_option_id contra snapshot e grava resultado, tentativa, requisito e conclusão PR2 numa transação. Client score/enrollment/course_version/reviewer não são aceitos como autoridade.

Checkpoint3/5=60falha;4/5=80passa para limiar70. Prova13/20=65falha;14/20=70passa. Aprovação por comparação inteira sem arredondamento; score_percent numeric exato. Retry sem bloqueio permanente; histórico retido. Nova implementação permite novas tentativas após revisão, sem cooldown artificial; limites legados de Liderança permanecem.

Session UUID é idempotência: mesmo payload devolve o mesmo resultado; payload diferente depois de envio é recusado. Tentativas/snapshots imutáveis, versões contíguas por identidade editorial, conteúdo publicado/usado congelado. Arquivamento não muda instrumento aberto. Anulação explicita motivo e evento, exclui seleção futura e preserva notas históricas; remediação humana de notas anuladas fica como política futura, sem recálculo silencioso.

## UX, preview e mestre

Renderer compartilhado em universidade-assessment.js: uma questão por etapa, labels/fieldset/legend, opções touch48px, revisão final de respostas, erros associados/foco, aria-live e feedback específico após envio. Retry reutiliza o mesmo fluxo com nova sessão. Sem score emocional/percentil/perfil.

Preview administrativo autorizado recebe banco para simular localmente checkpoint/prova/feedback/retry sem sessão/tentativa/requisito/evento. Conteúdo-mestre owner mostra gabarito, feedbacks, competência, nível, status, versão, fonte e gaps. Acesso comum de aluno não recebe esse modo; professor atribuído pode acessar preview autorizado, sem acesso às narrativas privadas do PR4.

.vercelignore exclui supabase/,scripts/,SQL/testes unitários e relatórios dos arquivos estáticos publicados; banco/gabarito/migrations não devem ser servidos pelo Vercel. Fixture pública QA usa exclusivamente perguntas técnicas hipotéticas, nunca questões oficiais.

## Independência e segurança

Prova disponível apósM10 enquanto IE30 segue ativo. final_assessment_passed satisfeito somente na aprovação; requisito configurado como certification_gate=true/module_completion_gate=false. E10/final_project_approved permanece independente e exige revisão humana PR4. Nenhum certificado IE/QR/publicação comercial/pagamento/PDF/IA avaliadora.

AlunoA/B, option de outra questão, question_id estrangeiro, quantidade de respostas, sessão alheia, módulo bloqueado, prova antesM10, revisão histórica e raw key protegidos por RPC/grants/RLS. Audit log contém estado, identificação editorial, versão, totais acadêmicos; nenhuma resposta do aluno é copiada para log geral. Chaves corretas históricas só no snapshot privado.

## Migrations e funções

Aplicadas uma vez em homologação ctzgsxxbyvruzmfqibnl, nomes alinhados ao ledger:

- 20261006191742_universidade_assessment_sessions.sql
- 20261006191806_universidade_ie_assessment_bank.sql
- 20261006192234_universidade_assessment_hardening.sql
- 20261006192457_universidade_assessment_policy_integrity.sql

Hardening corrige alias PL/pgSQL encontrado no teste real e congela metadados/política, sem reaplicar as migrations anteriores. Learner v20/admin v9 implantadas; professor v12 preservado. GatewayJWT do learner preservadofalse com auth própria; admin preservadotrue.

## Validações

189/189testes Node (160anteriores+29novos), check/lint/typecheck/diffcheck/secret scan aprovados. Teste real BEGIN/ROLLBACK: M1disponível→3/5falha→retry4/5→M1conclui→checkpointsatéM10→IE30ativo→prova13/20→retry14/20→requisito final satisfeito, E10intacta. Também testa publicação/arquivamento/nova versão, ordenação congelada, idempotência, isolamentoA/B/grants e audit sem respostas. Todas as fixtures Auth/aluno/sessão/ciclo revertidas; uma tentativa checkpoint preexistente de Liderança preservada.

SQL regressões evidence_flow(PR3),application_cycle_flow(PR4),foundation_RLS,progression_RLS,LiderançaM1→M2 aprovadas. Asserções não autorizadasHTTP, browser390, CI e deployment final são registradas no PR.

## Pendências/riscos e PR6

QA/editorial dos70Draft e lacunas de instruções das cinco ferramentas acima; nenhuma publicação comercial neste PR. Conteúdo autorizado/aulas oficiais e certificação IE são futuros. Motor de certificação deverá ler ambos os gates explicitamente; concluirM10/prova não aprovaE10.

**Pendência PR4 preservada:** preview administrativo autenticado IE30/E10 ainda precisa ser exercitado no QA final. Não declarado resolvido. Fixture visual isolada não substitui login real aluno/professor/owner nem aparelho físico.

Anulação histórica requer política de remediação humana futura; expiração de ciclo/notificações/reabertura continuam gaps PR4. Advisor Auth preexistente de leaked-password protection permanece: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Não houve merge na main.
