# Documentacao JurisDesk

Indice rapido da documentacao organizada em `docs/`.

- `docs/architecture/proposta-sistema-juridico.md`: referencia arquitetural, stack, schema SQLite e fluxos principais.
- `docs/ux/relatorio-interface.md`: diagnostico de interface e backlog de melhorias UX/UI.
- `docs/ux/qa-refino-interface-2026-02-16.md`: checklist de QA da entrega de refino visual (dashboard + base visual).
- `docs/roadmap/versao2.md`: funcionalidades planejadas para a versao 2.

## Atualizacoes recentes (20/02/2026)

Resumo das mudancas tecnicas mais recentes esta no `README.md`, em:

- `README.md#atualizacoes-recentes`
- `README.md#seguranca`
- `README.md#otimizacoes-de-performance`
- `README.md#configuracao-de-ia`

Principais pontos publicados:

- URL do Ollama configuravel ponta a ponta (`settings.ollama_url`) no teste e runtime do assistente.
- Hardening Tauri com remocao de plugin/permissao `shell` nao utilizados.
- CSP com suporte a `localhost/127.0.0.1` em portas dinamicas para IA local.
- Melhorias de busca global (limiar minimo + protecao contra resultados stale).
- Novos indices SQLite e ajustes de consistencia em datas locais.
- Deep-link de resultados para abrir entidade diretamente em Clientes/Documentos/Agenda.
- API keys movidas para keychain do SO (sem persistencia em texto puro no SQLite).
- Export/import de banco exclui configuracoes sensiveis e sanitiza `file_path` importado.
- Auto backup criptografado com senha (AES-GCM + PBKDF2), com compatibilidade para restore legado.
- Escopo de filesystem reduzido para `$APPDATA` nas capabilities do Tauri.

Recomendacao de leitura:
1. `README.md` para setup e operacao do projeto.
2. `docs/architecture/proposta-sistema-juridico.md` para contexto tecnico.
3. `CLAUDE.md` para diretrizes de implementacao.
