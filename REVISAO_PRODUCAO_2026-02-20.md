# Revisão de Prontidão para Produção (Manual)

Data: 2026-02-20  
Escopo: revisão manual de código/configuração (sem CI, sem GitHub, sem execução de testes automatizados neste documento).

## Contexto e decisões do debate

- Limite diário de custo: **não é de interesse**, pode ser removido.
- Backup de terceiros: **não é cenário-alvo**; uso esperado é no próprio PC do usuário.
- Criptografia em repouso: **ainda sem decisão final**, manter como tópico de arquitetura para fechamento posterior.

## Parecer executivo

No estado atual, o projeto ainda tem riscos relevantes para produção em contexto jurídico, principalmente em:

1. Integridade/segurança de caminhos de arquivo importados.
2. Exposição de segredos (API keys) e dados sensíveis em texto puro.
3. Hardening de build/permissões Tauri.

## Achados (ordenados por severidade)

## Crítico

1. Exclusão potencial de arquivos fora da área do app por `file_path` não validado.
- Evidências:
  - `src/lib/documentStorage.ts:77`
  - `src/pages/Assistant.tsx:549`
  - `src/lib/db.ts:1194`
  - `src/lib/db.ts:1231`
- Risco:
  - Se `file_path` vier adulterado no banco/backup, fluxos de remoção podem apagar arquivo indevido no sistema.

## Alto

1. API keys e configurações sensíveis em texto puro (DB e backup).
- Evidências:
  - `src/lib/db.ts:176`
  - `src/pages/Settings.tsx:307`
  - `src/lib/db.ts:930`
  - `src/lib/autoBackup.ts:304`
- Risco:
  - Vazamento de credenciais e dados sensíveis via acesso a DB/backup.

2. Backups não criptografados com recomendação de uso em pastas sincronizadas.
- Evidências:
  - `src/lib/autoBackup.ts:304`
  - `src/components/settings/BackupSettings.tsx:271`
- Risco:
  - Exposição de dados processuais e chaves se backup vazar.

3. Feature `devtools` habilitada na dependência Tauri principal.
- Evidência:
  - `src-tauri/Cargo.toml:22`
- Risco:
  - Superfície de ataque maior em release e hardening abaixo do ideal.

## Médio

1. Limite diário existe na UI, mas não é aplicado no fluxo de envio.
- Evidências:
  - `src/pages/Settings.tsx:1199`
  - `src/lib/costTracker.ts:328`
  - `src/stores/chatStore.ts:348`
- Observação:
  - Como já decidido, o ideal é remover totalmente esse conceito para evitar inconsistência.

2. Custos GPT-5/Gemini não persistidos no `ai_usage_logs`.
- Evidências:
  - `src/stores/chatStore.ts:513`
  - `src/stores/chatStore.ts:516`
- Risco:
  - Métricas/custos históricos incompletos.

3. Possível inconsistência do índice FTS após import completo.
- Evidências:
  - `src/lib/db.ts:1080`
  - `src/stores/documentStore.ts:392`
  - `src/lib/globalSearch.ts:114`
- Risco:
  - Busca pode perder resultados até reindexação adequada.

4. Teste de conexão Gemini envia API key em query string.
- Evidência:
  - `src/lib/ai.ts:858`
- Risco:
  - Maior chance de exposição da chave em logs intermediários.

5. Salvamento de configurações em lote sem transação.
- Evidências:
  - `src/pages/Settings.tsx:307`
  - `src/stores/settingsStore.ts:99`
- Risco:
  - Estado parcialmente salvo em caso de erro no meio do fluxo.

6. Ordem de deleção de sessão pode causar perda de arquivo em falha parcial.
- Evidência:
  - `src/pages/Assistant.tsx:494`
- Risco:
  - Arquivo removido antes da confirmação de deleção da sessão/registro.

## Baixo/Médio

1. Permissões de FS amplas além do necessário (Desktop/Download e escopo amplo).
- Evidência:
  - `src-tauri/capabilities/default.json:17`
- Risco:
  - Menor aderência ao princípio de menor privilégio.

## Recomendações objetivas

## Prioridade P0 (antes de produção)

1. Validar/canonicalizar `file_path` antes de qualquer `remove/read/write`.
- Aceitar apenas caminhos dentro de diretórios controlados (`$APPDATA/...` do app).
- Rejeitar/neutralizar paths inválidos importados de backup.

2. Migrar API keys para armazenamento seguro do sistema (keychain/credential manager).
- Manter no `settings` apenas referências, nunca o segredo em texto puro.
- Excluir segredos de `exportDatabase` e backups automáticos.

3. Hardening de release Tauri.
- Remover `devtools` de release.
- Revisar permissões FS para mínimo necessário por feature.

## Prioridade P1

1. Remover completamente o recurso de limite diário.
- Remover campos de UI em `Settings`.
- Remover settings relacionados (`*_daily_limit_usd`) e helpers não utilizados.
- Atualizar textos para não prometer controle inexistente.

2. Persistir custos para todos os provedores.
- Registrar `gpt5_usage` e `gemini_usage` no histórico de custos.

3. Garantir rebuild/sincronização do FTS após import/restore.

4. Trocar teste Gemini para header `x-goog-api-key` no lugar de query string.

5. Tornar `handleSave` de configurações transacional.

6. Inverter ordem de deleção de sessão/anexos.
- Primeiro deletar sessão/linhas; depois remover arquivos em best-effort seguro.

## Criptografia em repouso: feedback para decisão

## Pontos práticos

1. LGPD não impõe “criptografar tudo” de forma literal em qualquer cenário, mas exige medidas técnicas adequadas ao risco.
2. Para software jurídico, criptografia em repouso é fortemente recomendada pelo impacto de vazamento.
3. Criptografia em repouso protege bem contra perda/furto de máquina e vazamento de backup.
4. Não protege contra malware com usuário autenticado/sessão ativa.

## Caminho pragmático sugerido

1. Nível mínimo recomendado:
- Keychain para API keys.
- Segredos fora do backup.
- Validação estrita de paths.

2. Nível elevado:
- Backup criptografado por senha (AES-GCM).
- Banco criptografado (ex.: SQLCipher) apenas se o custo operacional compensar.

## Matriz rápida de decisão

1. Uso individual local, baixo risco:
- Adotar Nível mínimo recomendado.

2. Máquina compartilhada, sync em nuvem, risco regulatório maior:
- Nível mínimo + backup criptografado.

3. Requisito contratual forte de segurança:
- Nível mínimo + backup criptografado + banco criptografado.

## Observações finais

1. Este documento consolida revisão manual; não substitui validação de testes, build e smoke test de release.
2. Se quiser, o próximo passo pode ser converter este relatório em um plano de execução com checklists P0/P1 e PRs pequenos por tema.
