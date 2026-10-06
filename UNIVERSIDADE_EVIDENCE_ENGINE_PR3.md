# PR 3 — Evidências E01–E09

Base exata: `6a481719e4b254314b116289d92bec5dbe53d15d` (PR #12). Branch: `feat/ie-course-evidence-engine`. Stack: #11 → #12 → PR 3. Nenhum merge autorizado ou realizado.

## Auditoria anterior

PR #12 confirmado Draft na base aprovada. As cinco tabelas canônicas de evidências existiam, sem registros. Revisões e auditoria já eram imutáveis, com RLS sem bypass de proprietário. As APIs/UI ainda tratavam entrega como texto em `module_progress`; autosave era local e legado. O motor de requisitos e o RPC de conclusão do PR2 foram reutilizados.

O teste real revelou a FK legada de matrícula para `course_content` JSON. Ela foi removida, preservando a FK para o catálogo canônico de versões e a imutabilidade da versão da matrícula. O pin de versão continua compatível com Liderança e agora admite cursos publicados em blocos estruturados.

## Formulários e políticas

`content/evidence/ie-e01-e09.v1.json` contém somente os campos, quantidades e instruções fornecidos para E01–E09. Sem novas aulas, interpretações psicológicas, gabaritos ou conteúdo IE30/E10. Cada definição possui `form_schema` versionado com seções, field_key, type, label, help_text, required, min/max, options, repeatable, privacy_hint e regras estruturais.

| Evidência | Módulo | Modo | Estrutura |
|---|---:|---|---|
| E01 Mapa da Reação Automática | 1 | guided / Tipo A | 11 campos; intensidade subjetiva 0–10 |
| E02 RADAR 72H | 2 | guided / Tipo A | 3 registros; sem cronômetro |
| E03 Mapa de Padrões | 3 | sampled / Tipo B | observação, padrão prioritário e plano se–então |
| E04 Aplicação PAUSA | 4 | guided / Tipo A | 2 aplicações; antes/durante/depois |
| E05 Repertório de Regulação | 5 | sampled / Tipo B | 3 situações; PAINEL 5P V&C e FLEX |
| E06 Dossiê FIR–REAL | 6 | sampled / Tipo B | 2 situações; certeza subjetiva 0–100 |
| E07 Conversa CLARO | 7 | sampled / Tipo B | ANTES, CLARO, DEPOIS |
| E08 Mapa ELOS | 8 | sampled / Tipo B | ELOS, responsabilidades, limites e reflexão |
| E09 Decisão Estruturada | 9 | sampled / Tipo B | 3T, DECIDE e reflexão |

Política Essencial configurada: `sufficiency=on_submission`. Tipo A não entra em fila docente; Tipo B usa amostragem determinística de 10% por submission, com `review_selected` como sinalização de revisão. A infraestrutura também suporta `on_approval`/`human_required`; os testes exercitam ambos. Na política `on_submission`, parecer por amostragem é acompanhamento e não revoga silenciosamente a suficiência já concedida. Não existe avaliador semântico ou score emocional.

Definições e requisitos de IE permanecem **draft**. Não foi publicado o curso nem criadas aulas/questões. Publicação editorial depende do conteúdo oficial e dos próximos PRs.

## Persistência e segurança

Draft fica em `evidence_submissions.draft_data`, com versão otimista. Autosave usa debounce de 800 ms, requisições serializadas e flush antes da submissão/navegação. Estado de salvamento é anunciado sem repetição por tecla. Uma cópia temporária em sessionStorage, separada por usuário/definição e versão, protege atualização antes do debounce. Conflitos entre telas são recusados, sem sobrescrita silenciosa.

Submissão é RPC transacional com lock, UUID idempotente e validação estrutural no banco. Cria revisão imutável com structured_data; mesma chave/payload devolve a revisão existente; mesma chave com outro payload é recusada. Resubmissão após revision_requested cria a próxima revisão. Professor envia o ID exato da revisão atual; revisão antiga é recusada. Reviews também são append-only.

API resolve identidade, matrícula, curso/versão, módulo e definição no servidor. Escritas e RPCs são service-only. RLS concede leitura própria e leitura docente de revisões selecionadas em turma atribuída, somente sampled/human_required. Nem o proprietário recebe bypass. Draft textual não tem SELECT de navegador, inclusive para professor atribuído. B2B não integra essas tabelas nem recebe seus textos. `contains_sensitive_data` é preservado.

Eventos críticos usam `academic_audit_log` com IDs/estados/metadados mínimos: draft_created, submitted, resubmitted, revision_requested, approved e requirement_satisfied. Não registram o conteúdo nos eventos/analytics. Requisito evidence_completed aponta para revisão canônica; conclusão passa exclusivamente pelo RPC do PR2 e continua exigindo checkpoint e dependências publicados.

## UI, professor e preview

Renderer único com fieldsets/legends, labels explícitos, instruções, erros associados, foco no primeiro erro, navegação por teclado, resumo e aviso completo de privacidade antes do envio. Campos confortáveis, teclado numérico, touch targets de 48 px e etapas por seção/registro. Preview utiliza exclusivamente memória, sem API de escrita, submission, revision, requisito ou evento. Há opção de largura móvel de 390 px para inspecionar os formulários.

Professor mantém Liderança e possui seção de entregas estruturadas autorizadas, com revisão explícita e parecer. A API canonical queue/review verifica a atribuição no banco mesmo quando o chamador é proprietário.

## Migrations e funções

Aplicadas uma vez em `vc-core-homolog` (`ctzgsxxbyvruzmfqibnl`):

- `20261006152338_universidade_evidence_engine.sql`
- `20261006152900_universidade_evidence_hardening.sql`
- `20261006152951_universidade_evidence_validation_fix.sql`
- `20261006153045_universidade_evidence_draft_audit.sql`

Correções posteriores preservam o histórico aplicado: alias do validador SQL e metadados mínimos exigidos pela auditoria. Não reaplicam migrations anteriores.

Edge Functions: `vc-universidade-learner-v2` v17; `vc-universidade-professor` v10. Demais funções preservadas. JWT do gateway segue a configuração anterior; ambas verificam autenticação e escopo dentro da função.

## Verificação

- 121/121 testes Node (94 anteriores + 27 novos).
- `npm run check`, lint, typecheck e `git diff --check`: aprovados.
- Secret scan: sem chaves privadas, tokens GitHub/AWS/Supabase secret ou JWT service-role em arquivos rastreados/novos.
- SQL novo: campos de E01–E09, quantidades, faixas, draft, autosave, conflito de versão, contexto, idempotência, imutabilidade, ressubmissão, docente e revisão exata, políticas Tipo B, RLS e fluxo real E01 → checkpoint → M2 aprovados.
- SQL regressão: foundation RLS, progressão RLS e fluxo Liderança M1 → M2 aprovados.
- Fixtures em BEGIN/ROLLBACK: zero submissions reais e zero usuários de fixture retidos; curso IE segue draft.
- Chamadas sem autenticação às duas APIs: HTTP 401.
- Browser, Vercel e Actions: validação final registrada após publicação do preview.

## Limites e PR4

Não foram implementados IE30/E10, prova/rubrica final, certificado, IA avaliadora, psicometria, diagnóstico, relatórios B2B individuais ou PDFs. Conteúdo oficial de aulas/checkpoints e publicação editorial continuam fora do PR3. A sinalização `review_selected` é interna à política; um fluxo administrativo adicional para seleção manual pode ser desenvolvido quando houver política acadêmica aprovada.

Aviso preexistente no Supabase: proteção contra senhas vazadas desativada. Nenhuma mudança na configuração Auth foi feita neste PR. [Remediação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). RLS sem políticas em nove tabelas server-only é informativo; não foram encontrados novos índices FK faltantes ou tabelas de evidências sem RLS.
