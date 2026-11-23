# 80 — Inventário de dependências e licenças por artefato

Plano REL04 antes da implementação. Gerar inventário reproduzível das duas imagens locais e do lockfile de build da console, sem iniciar a aplicação nem montar socket Docker no scanner. Não é aceite jurídico de licenças, scanner de vulnerabilidades ou certificação de toda a distribuição.

## Contrato

- Scanner oficial Syft1.56.0, [release](https://github.com/anchore/syft/releases/tag/v1.56.0), imagem anchore/syft por digest sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313, conferido no registry. Fonte/API de build anterior continua pinada separadamente.
- Plan somente leitura: resolver IDs locais imutáveis, tamanhos/estimativa de espaço e scanner disponível; sem pull, save, diretório ou alterações nos containers.
- Scan explícito, diretório novo, export de cada imagem pelo ID e leitura de docker-archive. Scanner sem rede, socket, capabilities ou acesso ao workspace; apenas archive/lockfile readonly e scratch próprio, com limites de CPU/memória. Nenhum stop/restart de serviços.
- Projeção pública por allowlist sobre CycloneDX1.6 nativo: dependências/versões/hashes/licenças e referências dos componentes. Descartar configuração de imagem, environment, arquivos, headers, nomes de máquina, logs e metadados desconhecidos. Resultado não é publicado automaticamente; nomes de pacotes podem ser privados em imagens de terceiros.
- Relatório diferencia imagem runtime de lockfile de desenvolvimento. Bibliotecas JS incorporadas pelo bundler e Go antigo sem módulos podem não aparecer na imagem; não inferir ausência nem cobertura completa. Dependências desconhecidas/licenças ausentes viram revisão pendente, nunca aprovação automática.
- Archives e dados brutos ficam em staging próprio temporário ignorado, removido com ownership/path checks. Falha gera somente etapa/tipo de erro sanitizados; não imprime config/JSON bruto. Sem prune/global cleanup.

## Aceite planejado

Contratos de projeção que provem exclusão de sentinelas privadas, formato/referências/counts, falha fechada de formato/versão, destino novo e plano sem mutação. Scan real das imagens locais e lockfile, IDs preservados e ausência de mounts/sockets/egress. Registrar contagens e lacunas com hashes dos resultados. Só concluir o recorte depois dessas verificações; REL04 total continua exigindo os demais gates48.

## Implementado e validado — 05/11/2026

`python scripts/artifact_inventory.py plan` consulta somente IDs/tamanhos escalares das imagens locais e hashes dos manifests; não cria diretórios, faz pull ou reinicia aplicações. Scanner precisa estar previamente disponível pelo digest acima. Para executar:

```powershell
docker pull anchore/syft:v1.56.0@sha256:697ae864af1299cfa43c54b161cea3dd65c6d54de82e3dba66ea3dccb3acc313
python scripts/artifact_inventory.py plan
New-Item -ItemType Directory -Path migration-runs -Force
python scripts/artifact_inventory.py scan --output migration-runs/artifact-inventory-local
```

O destino deve ser novo. Flags `--backend-image` e `--console-image` selecionam imagens **já locais**; o export usa o ID resolvido, não uma tag mutável. A capacidade é estimada em4 vezes a soma dos tamanhos+1GiB; não reserva espaço nem garante capacidade de outras operações concorrentes. Manifests são copiados para staging próprio, conferidos por hash e consistência package/lock antes de qualquer export. O SBOM de fonte liga os hashes dos dois arquivos, com dependências dev explicitamente incluídas, e não deve ser confundido com pacotes runtime.

Três CycloneDX1.6 projetados por allowlist e summary.json são gerados. Componentes de arquivos e seus caminhos são excluídos, arestas correspondentes podadas e referências restantes resolvidas; componentes de pacote mantêm nomes/versões/purl sem qualifiers/subpaths, hashes e licenças sem URLs/textos adicionais. Environment/configuração de imagem, metadados desconhecidos, localização de arquivos e serviços não são exportados. Nomes de pacotes de imagens privadas ainda podem exigir revisão antes de publicação. Não há publicação automática.

Scanner roda com2CPU/2GiB, rede none, rootfs readonly, cap-dropALL, no-new-privileges, update/enriquecimento remoto desligados e sem socket. Apenas archive/manifest readonly e scratch descartável são montados. Container tem nome/label próprios; timeout só pode removê-lo após conferir ownership. Staging tem marcador e verificação de caminho antes de remoção recursiva. Logs/erros públicos contêm etapa/tipo, nunca stderr bruto nem configuração.

Dez contratos passaram: exclusão de sentinelas privadas/arquivos/qualifiers, grafo determinístico, licenças desconhecidas, formato/referências ambíguas ou pendentes, plano sem mutação, destino existente, drift do lockfile com cleanup, fronteira de execução, timeout e recusa de ownership diferente. Scan real repetido com projeção final passou; fonte/aplicações/guest mantiveram os mesmos IDs e nenhum staging/scanner permaneceu. Primeira inspeção incluía arquivos como componentes; isso foi corrigido e não equivale à contagem final de pacotes.

| Artefato analisado | Componentes de pacote | Licença não identificada |
|---|---:|---:|
| Backend customizado do recorte79 | 486 | 145 |
| Console runtime do build608/71 | 73 | 1 |
| Lockfile frontend, incluindo dev | 209 | 0 |

A declaração Apache-2.0 da console foi alinhada ao LICENSE do projeto nos dois manifests. Grafos das imagens repetidos tiveram hashes idênticos; os arquivos temporários foram removidos. Não inferir conformidade jurídica a partir da ausência de lacunas do lockfile. Os145/1 itens sem licença detectada exigem investigação de origem/textos, não atribuição automática por nome do pacote. Go antigo sem módulos e JavaScript incorporado pelo bundler têm lacunas de detecção; o trash.conf upstream declara13 dependências Go diretas por commit/ref, sem provar todo o conteúdo transitivo do binário. Licenças Go/upstream/vendor já são copiadas para a imagem pelo Dockerfile79. A projeção usa o formato CycloneDX emitido pelo Syft e contratos de estrutura/grafo; validação independente integral por schema e inventário completo ainda são gates de release.

**REL04 continua parcial.** Ferramenta é inventário, não análise de CVEs, assinatura/atestado de procedência, auditoria completa de dependências ou aceite de distribuição. Resultados locais são ignorados pelo Git; manter evidências revisadas por artefato quando preparar uma release.
