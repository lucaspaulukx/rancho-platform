# Frontend Rancho

[Português (Brasil)](console.md) | [English](../../console/README.md)

Frontend independente React/TypeScript usando APIs/sessão nativas Rancher1.6. Layouts, componentes, schemas, mutações no escopo e temas são descritos em [arquitetura](architecture.md) e [UI](ui-guidelines.md).

## Desenvolvimento

Execute em `console/`:

```sh
npm ci
npm run dev
npm test
npm run build
npm run format:check
```

Vite e console Compose usam porta18090; execute um frontend por vez. Vite encaminha API/OIDC/WebSocket ao backend local. Mantenha callback/origem coerentes; `vite.config.ts` e `nginx.conf` definem o transporte de cada modo.

## Integração

`public/console-config.json` define módulos/temas validados; capacidades do backend continuam impondo autorização e guardas compatíveis. Veja [configuração](configuration.md), [segurança](security-model.md) e [testes](testing.md).

Reuse shell e drawers contextuais. Preserve environment, filtros e rascunhos. Não persista capacidades/credenciais em storage ou evidência bruta. Ember permanece intacto; mudanças backend viram patches pinados.

## Aceite

O Dockerfile instala o lockfile, testa o frontend e faz build TypeScript/Vite para nginx. Retenção de assets suporta abas antigas; rollback final/compatibilidade clássica continuam gates. Unitários/componentes ficam em `src/test/`; harnesses nativos/browser em `tests/` exigem sandbox dedicado documentado.

Siga [contribuição](contributing.md) e mantenha os dois idiomas. Dependências, dist, estado de fixtures e relatórios são dados gerados/ignorados, não fontes entregáveis.
