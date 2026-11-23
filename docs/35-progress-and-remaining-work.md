# 35 — Progresso estimado e trabalho restante

## Referência de 23/10/2026

Estimativa de planejamento: **aproximadamente 70% do escopo Docker/Cattle**, com cerca de30% restante. Faixa de incerteza65–75%. Não é contagem automática de telas, commits ou testes. O último gate geral é565 testes/65 arquivos + TypeScript/Vite; testes são evidência dos recortes, não percentual de paridade.

A estimativa pondera implementação e aceite. Pesos são julgamento de esforço/risco e devem ser revistos quando um contrato nativo exigir mudança de backend. Não representa prontidão produtiva. F9 (VMs/Windows/Kubernetes/Swarm/Mesos) não entra no denominador: o plano original condiciona cada opcional a uso e laboratório próprios. Se todos forem exigidos, o percentual do escopo total terá de ser recalculado.

| Fase | Peso no escopo Cattle | Progresso estimado | Trabalho aberto principal |
|---|---:|---:|---|
| F0 configuração/reversão |5%|80%|Migração versionada, recuperação completa e contas técnicas |
| F1 componentes/temas/shell |10%|90%|Leitor de tela, teclado manual, volume alto e revisão final |
| F2 autenticação/sessão |10%|80%|Expiração real de JWT, logout federado e indisponibilidade do IdP |
| F3 grupos/RBAC |10%|85%|Migração de vínculos, identidades externas dinâmicas e matriz restante |
| F4 environments/templates |5%|80%|Matriz ampliada de templates/bindings/rede e regressões |
| F5 stacks/serviços/containers |20%|75%|Formulários avançados, scheduling/security/healthcheck/sidecars e opções Compose |
| F6 hosts/dados/rede/catálogo |15%|55%|LB/TLS/multi-host, armazenamento/backup, drivers e fontes por environment/clone físico |
| F7 logs/terminal/métricas |5%|80%|Revogação de streams abertos, expiração e matriz física completa |
| F8 administração/integrações |10%|75%|Admin de provedores/auth, configuração HA, drivers de catálogo, eventos reais de webhook |
| F10 consolidação |10%|30%|Migrações, restore/rollback completos, segurança, performance, attribution/empacotamento |

Média ponderada71,25%, arredondada para70% para não sugerir precisão inexistente. A fundação e as operações mais usadas estão mais adiantadas que infraestrutura e consolidação.

## Seis blocos restantes

1. **Completar operação Cattle**: campos avançados de serviço/container, tipos especiais, scheduling, healthchecks, segurança, sidecars e opções Compose; revisão contextual e provas de efeitos reais.
2. **Completar infraestrutura**: clone/sincronização de fontes (delegação aceita no recorte45); drivers de catálogo e provisionamento isolado; LB/TLS/multi-host; volumes/pools, snapshots e backup/restore.
3. **Fechar identidade e autorização**: expiração real/federated logout, revogação de conexões abertas, contas técnicas, migração de acessos individuais e identidades externas previstas.
4. **Fechar administração**: capacidades de provedores de auth (contas locais/credenciais/privilégio global aceitos no recorte42), configuração HA e entrega real de eventos de webhooks.
5. **Consolidar experiência e escala**: teclado/leitor de tela, responsividade, temas efetivos verificados, filtros/contexto mantidos e cargas sintéticas maiores.
6. **Fechar entrega e recuperação**: migrações de banco versionadas, preservação/restore de Rancher e Keycloak, rollback e pacote reproduzível com atribuições/licenças. Publicação externa não está autorizada por esse plano.

Ordem imediata: fontes de catálogo por environment → formulários avançados → gates físicos/identidade → consolidação. Pode mudar conforme evidência de contratos. Não atribuir uma data de término antes de medir os trabalhos que dependem de infraestrutura; não converter percentual em horas restantes de maneira linear.

O dump real foi explicitamente adiado pelo usuário. Os próximos testes usam exclusivamente fixtures sintéticas locais, sem leitura/migração de produção.
