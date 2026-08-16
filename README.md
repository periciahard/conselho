# Conselho em Foco — pacote público

Esta é a pasta correta para publicação no GitHub Pages. Ela não contém nomes nem arquivos de fotos dos alunos; os dados são carregados do Supabase somente depois da validação do acesso.

A versão inclui três trimestres independentes, acesso de professores limitado às próprias respostas, relatórios exclusivos da coordenação, fotos privadas, gestão manual de alunos e importação anual por Excel.

## Publicação

1. Envie somente os arquivos desta pasta para o repositório.
2. Em **Settings > Pages**, selecione **Deploy from a branch**.
3. Escolha a branch principal e a pasta raiz (`/root`).
4. Aguarde o endereço do site ficar disponível.

Antes de publicar, conclua as etapas da pasta `CONFIGURACAO-PRIVADA-NAO-PUBLICAR`, que deve permanecer fora do GitHub.

O arquivo `supabase-config.js` usa apenas a chave publicável do projeto. Nunca inclua uma chave `service_role` ou `secret` no repositório.
