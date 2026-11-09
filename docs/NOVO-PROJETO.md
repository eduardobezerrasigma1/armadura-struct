# Novo projeto com organização inicial

O comando **Novo projeto**, na barra de acesso rápido ou na faixa **Arquivo**, abre o mesmo assistente. Ele prepara a estrutura do arquivo antes do desenho. Não gera geometria, armaduras ou quantitativos.

## Criar com nome e pasta

Informe **Nome do projeto**, use **Escolher pasta** e confira o caminho do arquivo principal antes de **Criar projeto**. Em navegadores sem escrita de diretório, o assistente indica o modo compatível com recuperação local e download. [Contrato da pasta, salvamento e recuperação de acesso](PASTA-PROJETO.md). O responsável é opcional. A estrutura mínima aparece no resumo: **Térreo → Vigas → V1**, além de uma **Folha 1** vazia, sem vistas colocadas. Os três níveis são pavimento, grupo de elementos e detalhamento. São renomeáveis; um único pavimento pode representar todo o projeto quando não houver subdivisão por andares. [Exemplos e navegação](ORGANIZACAO-PROJETO.md).

Se houver um projeto em uso, confira o aviso e marque **Confirmar substituição do projeto atual**. **Salvar cópia do projeto atual** permite guardar um arquivo independente antes de criar. A criação é uma única operação do histórico: **Desfazer** recupera o projeto anterior; a recuperação automática passa a guardar o novo projeto. Pontos e comandos ainda não confirmados são cancelados ao criar e não fazem parte da cópia salva; o aviso informa essa condição.

## Preparar a árvore

Abra **Organizar pavimentos, grupos e detalhamentos**. A própria árvore é a prévia editável do que será criado:

- O padrão já mostra **Térreo → Vigas → V1**. Renomeie os itens se necessário.
- Use **+ Detalhamento** em Vigas para preparar V2, V3… Cada item abre diretamente seu desenho.
- Use **+ Grupo** ao lado do pavimento para acrescentar Pilares, Lajes ou outra categoria. O novo grupo recebe seu primeiro detalhamento; Pilares começa com P1.
- Use **Adicionar pavimento** para criar **Cobertura**. Ele começa vazio. Acrescente um grupo Vigas e seus detalhamentos.
- **Alterar pavimento** e **Alterar grupo** permitem mover itens entre pais existentes. O seletor mostra o caminho e a ordem dos itens, inclusive para nomes iguais.
- Escolha o **Detalhamento inicial ativo** pelo caminho completo. Ele será o destino dos próximos objetos.

![Prévia editável da organização inicial](new-project-setup.png)

**Remover** mostra os filhos afetados e informa que os desenhos vinculados acompanham a remoção; exige confirmação. Os filhos são removidos apenas do rascunho, sem transferência implícita. Para preservá-los, cancele a remoção e mude seus pais primeiro. A remoção é impedida se eliminar o último pavimento, grupo ou detalhamento do projeto. Pavimentos e grupos vazios são permitidos, desde que a estrutura global mínima continue válida.

Nomes de pavimentos, elementos, detalhamentos e desenhos têm de 1 a 100 caracteres; o projeto e o responsável aceitam até 150. Espaços nas extremidades são normalizados na confirmação. Campos inválidos mostram mensagens próximas; vínculos e IDs também são validados antes de criar. Os limites seguem a persistência nativa: 1.000 pavimentos e 10.000 elementos, detalhamentos e desenhos.

## Rascunho, teclado e continuidade

Enquanto a gravação inicial está em andamento, aguarde o resultado antes de fechar; os campos e a confirmação ficam bloqueados. Antes de confirmar **Criar projeto**, nenhuma alteração entra no projeto aberto, no histórico ou na recuperação automática. **Cancelar**, **Esc**, o **×** e o clique fora da janela descartam o rascunho. Reabrir começa com novos padrões, sem resíduos. Se o projeto aberto mudar por outro fluxo enquanto o assistente estiver aberto, a criação é bloqueada e é necessário reabrir a janela.

O foco começa no nome. **Tab/Shift+Tab** percorrem os controles dentro da janela; **Esc** fecha sem cancelar um comando CAD pendente no projeto original. **Enter** nos nomes da árvore não cria o projeto acidentalmente. A área central rola em janelas menores e mantém as ações finais acessíveis.

Após criar, a aba lateral **Projeto** é aberta com a hierarquia preparada e um detalhamento válido ativo. Seleções, abas de outros documentos, edição isolada e comandos transitórios são limpos. A árvore lateral continua editando os mesmos IDs e vínculos; não existe cadastro paralelo. Salvar/reabrir preserva essa organização. A seleção do detalhamento ativo é uma preferência local, seguindo a política já existente do aplicativo.

## Contratos e verificação

`src/domain/projectSetup.ts` prepara um `Project` nativo isolado, com validação e operações imutáveis de rascunho. Reutiliza criação/exclusão, nomes e validação de `hierarchy.ts`, e passa pelo `decodeProject` na confirmação. Os auxiliares também são exportados por `src/api.ts`. A aplicação verifica novamente o projeto de origem e confirma o resultado em uma única operação de histórico, protegida contra submissão repetida.

O formato usa **`armadurastruct/20`**, com a migração de máscaras documentada em [Máscaras nativas](MASCARAS-NATIVAS.md). O assistente não exige outra migração ou alteração de projetos antigos, armaduras, pranchas e quantitativos. O assistente não inclui alturas, níveis, cálculo estrutural, templates ou importação.

Verificações automatizadas:

- `tests/projectSetup.test.ts`: padrões, árvore personalizada, IDs, vínculos, nomes/limites, homônimos, remoções, imutabilidade, persistência e destino de uma barra criada pela API.
- `tests/e2e/projectSetup.spec.ts`: Térreo/Cobertura e V01/P01/V02, prévia/final, barra no detalhe ativo, histórico, salvar/reabrir, edição lateral, todas as formas de cancelar, recuperação intacta, comandos pendentes, substituição/cópia, clique duplo, árvore em janela de 600 × 600, teclado/foco e fundos CAD claro/escuro.
- Regressão dos testes existentes, `npm run check`, `npm run build` e `npm run format:check`.

Na revisão da organização por grupos, os testes de domínio/importação e distribuição, build, formatação e os fluxos de navegador do assistente, hierarquia, edição isolada e pranchas foram executados. Consulte também [Organização do projeto](ORGANIZACAO-PROJETO.md).

Os fluxos foram exercitados no navegador Chromium. A interface e o domínio são compartilhados com o desktop Tauri; instaladores Linux/Windows não foram compilados nesta entrega. Os limites máximos do formato são validados, mas a árvore do assistente não é virtualizada para cadastros de milhares de itens.
