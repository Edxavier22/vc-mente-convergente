# Liderança Estratégica Aplicada — manifesto editorial v1.1

Este arquivo registra o contrato pedagógico e técnico da versão 1.1. O conteúdo integral permanece na fonte privada versionada da Universidade e não deve ser publicado no repositório.

## Contrato de cada módulo

Cada módulo deve entregar, quando aplicável: abertura, objetivos observáveis, conteúdo aprofundado, conceitos fundamentais, Princípio V&C, exemplo, estudo de caso, erros comuns, aplicação, reflexão, oficina, evidência, preparação para o Checkpoint V&C, síntese e referências verificáveis.

Os campos estruturados aceitos pelo renderizador são:

- `opening`;
- `objectives[]`;
- `study[]`;
- `concepts[{ title, body }]`;
- `principle{ title, body }`;
- `example{ title, body }`;
- `caseStudy{ title, scenario, analysisQuestions[] }`;
- `commonErrors[]`;
- `application[]`;
- `guidedStudy[]`;
- `reflection[]`;
- `workshop[]`;
- `evidence` e `rubric`;
- `checkpointReview[]`;
- `synthesis[]`;
- `references[{ authors, year, title, source, doi?, url? }]`.

O renderizador mantém compatibilidade com o conteúdo 1.0: campos novos são opcionais e nenhum gabarito é enviado junto com a aula.

## Carga horária pedagógica estimada

As 20 horas representam o percurso educacional, não permanência artificial com a página aberta:

| Componente | Estimativa |
| --- | ---: |
| Conteúdo e estudos guiados | 7h |
| Casos, exercícios e checkpoints | 3h |
| Oficinas e evidências práticas | 6h |
| Projeto de Liderança de 30 dias | 3h |
| Avaliação final e revisão | 1h |
| **Total** | **20h** |

A trilha oficial é registrada por eventos persistentes: matrícula, abertura, evidência, checkpoint, tentativas, avaliação, projeto, conclusão e certificado. Não se usa cronômetro de página como comprovação acadêmica.

## Política de integridade editorial

- Não usar citações ornamentais ou frases atribuídas sem fonte verificável.
- Distinguir fato, interpretação, hipótese e elaboração metodológica.
- Identificar formulações autorais como **Princípio V&C**.
- Não transformar instrumentos educacionais em diagnóstico psicológico, jurídico ou clínico.
- Em assédio, discriminação, violência, risco ou irregularidade, orientar para procedimentos formais e profissionais competentes.
- Não expor nomes, dados pessoais ou informações sensíveis de terceiros nas evidências.

## Referências-base verificadas

- Edmondson, A. C. (1999). *Psychological Safety and Learning Behavior in Work Teams*. Administrative Science Quarterly, 44(2), 350–383. DOI: 10.2307/2666999.
- Reason, J. (2000). *Human error: models and management*. BMJ, 320(7237), 768–770. DOI: 10.1136/bmj.320.7237.768.
- Hattie, J.; Timperley, H. (2007). *The Power of Feedback*. Review of Educational Research, 77(1), 81–112. DOI: 10.3102/003465430298487.
- Kahneman, D.; Klein, G. (2009). *Conditions for intuitive expertise: a failure to disagree*. American Psychologist, 64(6), 515–526. DOI: 10.1037/a0016755.
- Lally, P.; van Jaarsveld, C. H. M.; Potts, H. W. W.; Wardle, J. (2010). *How are habits formed: Modelling habit formation in the real world*. European Journal of Social Psychology, 40(6), 998–1009. DOI: 10.1002/ejsp.674.
- International Labour Organization (2019). *Violence and Harassment Convention, 2019 (No. 190)* e *Recommendation No. 206*.
- Ministério do Trabalho e Emprego. *Norma Regulamentadora nº 1 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais*, texto oficial vigente.
- International Organization for Standardization. *Quality management principles* e ISO 9001:2026.

Referências complementares aparecem em cada módulo. Elas sustentam conceitos; não são usadas para inventar endossos, resultados ou promessas comerciais.

## Critérios de publicação

Uma versão de conteúdo só pode tornar-se corrente após:

1. validação estrutural dos dez módulos;
2. revisão editorial e das referências;
3. testes do renderizador em desktop e mobile;
4. confirmação de que a prova contém 20 questões e aprovação configurada em 70%;
5. homologação autenticada da progressão e persistência;
6. preservação da versão anterior para rollback.
