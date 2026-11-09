# Copiar e Apagar entidades de máscaras

Na aba **Máscaras**, o grupo **Manipular** fica imediatamente depois de Ferramentas, na ordem Mover, Espelhar, Rotacionar, Copiar e Apagar. Esta entrega habilita **Copiar** e **Apagar**; os três primeiros espaços ficam desabilitados até suas tarefas próprias, usando o mesmo grupo.

## Seleção e alcance

Ative a máscara de destino e abra seu desenho/detalhamento. Inicie o comando e clique nas entidades: cada clique acrescenta ou retira um alvo. O painel informa nome da máscara e quantidade, realça o conjunto e permite pesquisar/selecionar por nome ou ID. **Enter** conclui a seleção, inclusive quando o foco está num checkbox ou na pesquisa. **Esc** descarta a seleção/prévia.

A seleção é exclusivamente de entidades da máscara ativa. Aço, máscaras inteiras e referências de outras máscaras não entram no conjunto. Uma seleção anterior de armadura é descartada com aviso; clicar em outro alvo durante o comando informa o alcance permitido. Layers ocultos, sem captura ou bloqueados, máscara oculta e isolamento são respeitados e revalidados antes de cada aplicação. No papel é necessário abrir o desenho antes de editar.

O Controle de máscaras reaproveita a entidade nativa previamente escolhida. **Copiar entidade** abre o mesmo fluxo com essa entidade marcada; **Excluir entidade** executa Apagar sobre essa pré-seleção válida, informando o alvo e a quantidade. O controle e o painel avisam que as cotas têm pontos estáticos.

![Seleção acumulada para Apagar](mask-erase-selection.png)

## Apagar

Sem pré-seleção, selecione o conjunto e pressione **Enter** ou **Apagar seleção**. Uma única transação remove somente essas entidades. Apagar a última deixa a máscara vazia e disponível para desenhar. Enter repetido não seleciona outro conjunto. **Desfazer** restaura geometria, IDs e estilos exatos; **Refazer** reaplica a exclusão.

**Excluir máscara** continua sendo uma operação separada no Controle de máscaras, com confirmação que identifica o nome e o alcance. Ela preserva as barras. A cópia de uma máscara inteira é a operação explícita de associação/cópia documentada em [Importação e associação](MASCARAS-LOTE.md); os comandos desta página sempre atuam nas entidades.

## Copiar

1. Selecione entidades e confirme com **Enter**.
2. Escolha o **ponto base** por clique/snap ou coordenadas no Comando CAD.
3. Escolha um destino. A prévia mostra a geometria antes de aplicar; o clique ou a entrada de coordenadas confirma uma cópia.
4. Escolha novos destinos usando o mesmo conjunto original e a mesma base. **Enter/Esc encerra**, descartando apenas a prévia ainda não confirmada. Cada destino confirmado corresponde a uma transação independente de Desfazer/Refazer.

Exemplo em mm: linha e círculo, base `0,0`, destinos `@1000,0` e `@0,1000`. Surgem dois conjuntos novos, além do original. Coordenadas absolutas e polares (`@1000<0`), snaps e ortogonal reutilizam o Comando CAD existente. Vetores relativos partem sempre da base, não da cópia anterior. Um deslocamento inferior a 0,000001 mm é neutro e não cria histórico.

![Prévia da cópia](mask-copy-preview.png)

![Cópia confirmada e próxima prévia descartável](mask-copy-result.png)

Cada cópia recebe IDs novos, com geometria e estilos independentes. Círculos, arcos, retângulos, polilinhas e textos preservam os dados analíticos disponíveis, fechamento, layers, overrides, altura, alinhamento e rotação. Não duplica máscara, metadados de associação ou aço. O destino é a própria máscara ativa declarada; para outro detalhamento use a associação explícita existente.

## Contratos e limites

- As conversões modelo/local consideram translação, rotação e escala da máscara, uma única vez, em mm. Formatação de texto não arredonda coordenadas. A cópia rejeita resultados fora de ±1 bilhão de mm e mais de 100 mil entidades na máscara, antes de alterar o documento; não aplica conjuntos parcialmente.
- Cotas existentes armazenam pontos estáticos e não possuem vínculos persistidos com vértices de máscara. Elas permanecem e exigem revisão explícita após a edição da referência. Armaduras lançadas pela fôrma são independentes e permanecem com geometria, quantidades, posições e peso anteriores. Não há exclusão em cascata.
- `sourceEntityId` é proveniência histórica, não dependência viva. Na cópia do conjunto, IDs internos de proveniência são remapeados para as novas entidades; proveniência externa permanece. Apagar uma origem não invalida seus fragmentos históricos.
- A edição de DXF/DWG é local à referência normalizada, sem escrever ou remover o arquivo externo. Curvas já discretizadas pelo importador conservam essa representação; não há reconstrução analítica silenciosa. Canvas, prancha, PDF e DXF usam a mesma geometria compartilhada. A exportação atual amostra curvas e escreve LWPOLYLINE, com os limites documentados em [Ajustar/Estender](MASCARAS-AJUSTAR-ESTENDER.md).
- Salvar/abrir, recuperação automática e intercâmbio transportam os resultados confirmados. Não há novos campos persistidos nem migração: continuam `armadurastruct/23` e `openstruct.detail/14`.
- Troca de projeto, desenho, máscara, aba ou isolamento, perda do alvo e alteração concorrente invalidam a preparação. Duplo clique no mesmo destino é filtrado por 400 ms; aplicações já confirmadas permanecem no histórico. Desfazer durante uma preparação sem operações apenas cancela essa preparação; após uma cópia, encerra o comando e desfaz a última cópia.
- Lista pesquisável limitada a 200 resultados por consulta; refine a pesquisa para as demais entidades. Seleção acumulada por clique permanece disponível. Pré-seleção pelo Controle é de uma entidade; conjuntos múltiplos são montados no comando.

Os atalhos específicos são **ERASE**, **APAGARMASCARA**, **MCOPY** e **COPIARMASCARA**. Os atalhos gerais de armaduras não são reaproveitados. O seletor Ferramentas CAD da máscara ativa mantém acesso em Foco/faixa recolhida.

![Acesso em Foco e janela estreita](mask-manip-compact.png)

## Implementação e validação

`src/domain/maskManipulation.ts` compartilha resolução de seleção, proteções e planos puros com os contratos CAD existentes. `MaskManipPanel.tsx` e `App.tsx` coordenam etapas, prévia, invalidação e histórico; Ribbon, Controle e destino ativo chamam esse mesmo fluxo.

`tests/maskManipulation.test.ts` cobre geometria, IDs, proveniência, proteções, concorrência, limites, máscara vazia, RA/CSV, cotas estáticas, arquivo/intercâmbio e exportações. `tests/e2e/maskManipulation.spec.ts` cobre seleção direta e por ID, pré-seleção, repetição, Esc/Enter, coordenadas, máscaras transformadas, histórico, recuperação, troca de contexto e Foco. As capturas são produzidas pelo teste em build de produção e disponibilizadas como artefato da validação GitHub.

Comandos: `npm run check`, `npm run build`, `npm run format:check`, `npm run test:e2e`. A execução interativa do aplicativo Tauri instalado em Linux/Windows não é coberta neste ambiente.
