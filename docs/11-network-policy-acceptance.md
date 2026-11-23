# Aceite das políticas de rede

## Checkpoint documental — 21/10/2026

O aceite ipsec de 16 checks físicos/RBAC permanece histórico e limitado ao laboratório descrito. A VM rancher16-policy-test-host foi conferida parada com disco preservado; não repetir testes presumindo host online. A flag networkPolicies permanece true no laboratório, mas o painel exige gerenciador nativo saudável para escrita.

Estado global e limites: [status atual](08-status.md). Instruções de retomada: [handoff vigente](../HANDOFF-2026-10-21.md).


## Escopo

Validar o gerenciador nativo e a nova interface sem mudar as políticas de `UI-OPS-LAB` nem o frontend clássico. A flag visual não concede autorização. O aceite ipsec descrito abaixo passou e `modules.networkPolicies` está true no laboratório; redes sem gerenciador saudável continuam somente para consulta.

## Isolamento

Criar um environment sintético exclusivo e um segundo host RancherOS emulado, com volume próprio. O container externo não usa privileged, socket Docker Desktop ou dispositivos do host. Agente e gerenciador usam os privilégios nativos somente dentro da VM isolada. Reutilizar somente arquivos de imagens oficiais do cache; não copiar o disco/identidade do host existente. Registrar um novo agente apenas no environment de teste. Manter o baseline parado.

## Execução prevista

1. Consultar a versão e os arquivos nativos do catálogo para `network-policy-manager`; registrar a referência efetiva e os requisitos.
2. Preparar host/environment de teste e infraestrutura padrão. Pré-carregar imagens oficiais em arquivos compatíveis com Docker legado, sem desativar TLS.
3. Iniciar gerenciador e dois serviços sintéticos HTTP/client. Comprovar tráfego permitido antes da alteração.
4. Aplicar política nativa somente na rede desse environment: verificar persistência, bloqueio real de tráfego entre fixtures e retorno ao permitir. Usar conexões novas para não confundir conntrack com aplicação da regra.
5. Testar a interface e permissões: revisão, envio único, resultado backend, leitor sem PUT, conflito e retirada da flag.
6. Restaurar políticas, remover serviços/recursos sintéticos pelo lifecycle nativo e parar o host adicional. Preservar volumes para recuperação; não executar prune.

## Limites e critérios

Uma resposta HTTP de sucesso ao PUT não prova enforcement. É obrigatório medir conexão permitida, bloqueada e restabelecida com controle de saúde do servidor. Não usar indisponibilidade do servidor como evidência de bloqueio. Não generalizar um host para multi-host, LB ou TLS de aplicação. Regras avançadas continuam fora da edição simplificada e não podem ser sobrescritas.

Se o suporte de política não puder ser executado no agente/driver disponível, registrar a incompatibilidade, manter a flag desligada e seguir outros domínios do roadmap; não anunciar a função como liberada.

## Resultado em 21/10/2026

- Environment `CONSOLE-POLICY-LAB` (`1a417`), host `1h2`, rede `1n71`; volume exclusivo `rancher16-rbac-lab_policy-test-state`.
- Template oficial `library:infra*network-policy-manager:3`, imagem `rancher/network-policy-manager:v0.2.8`; contrato salvo em `console/policy-catalog-contract.json`.
- Infraestrutura e manager `active/healthy`; fixtures em stacks diferentes no host dedicado. HTTP permitido antes da alteração.
- Interface aplicou default deny após revisão antes/depois. Três conexões novas falharam e o servidor permaneceu saudável por checagem local independente. Política restaurada via API ao snapshot inicial e HTTP restabelecido.
- Readonly temporário concedido ao usuário sintético `leitor`, com autorização explícita: GET permitido, schema sem PUT, tentativa direta negada e sessão existente sem acesso após revogar. Vínculo temporário removido.
- Hash da política de `UI-OPS-LAB` inalterado durante todo o teste. Duas stacks HTTP removidas pelo lifecycle nativo. VM extra desligada limpidamente; disco, environment e definições de infraestrutura preservados. O host extra não fica consumindo RAM após o gate.
- Relatório: **16 checks aprovados** em `console/policy-physical-test-results.json`. Frontend: **180 testes/18 arquivos**, TypeScript/Vite aprovados. Capturas `console-network-policy-review.png`, `console-network-policy-deny.png` e `console-network-policy-restored.png` em `evidence/`.

O primeiro start do daemon auxiliar de exportação encontrou timeout no containerd; o segundo iniciou e exportou a imagem oficial. Foi parado após a exportação. No primeiro boot da VM houve espera de alocação das fixtures; o teste passou dentro dos limites definidos, sem ampliar timeouts nem usar falha de servidor como prova de bloqueio. Não é benchmark de boot.

## Reexecução

Os scripts usam o estado de `console/policy-lab-fixture.json`, sem credenciais nesse arquivo. Não executar setup contra um environment com nome/descrição diferentes. Para religar o host parado: iniciar somente `rancher16-policy-test-host`, executar `policy_lab.py prepare` para repor a configuração privada de `/run` e aguardar status pronto. As imagens e o disco persistem; não copiar identidade de outro host. O setup reconhece as stacks descartáveis já removidas e cria novas.

```powershell
python -u console/tests/policy_lab.py status
python -u console/tests/policy_acceptance.py setup
# Aplicar deny pelo painel somente no CONSOLE-POLICY-LAB, após o HTTP inicial passar.
python -u console/tests/policy_acceptance.py probe-deny
python -u console/tests/policy_acceptance.py restore
python -u console/tests/policy_acceptance.py authorization
python -u console/tests/policy_acceptance.py cleanup
python -u console/tests/policy_lab.py shutdown
```

As autorizações recebidas nesta sessão cobrem o token privado desse host e readonly temporário de `leitor` nesse environment. Não estender esse escopo a outros usuários, environments ou destinos. Uma reexecução que use outro destino exige escopo próprio. O relatório não cobre vxlan, multi-host, matriz completa de precedência ou edição de regras avançadas.
