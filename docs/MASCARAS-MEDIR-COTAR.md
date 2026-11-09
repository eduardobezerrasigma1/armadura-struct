# Medir e cotar geometria de máscaras

**Máscaras → Ferramentas** distingue **Medir distância** (consulta) de **Cota ortogonal** e **Cota alinhada** (anotação persistente). Os acessos de Desenho e os atalhos existentes continuam usando o mesmo comando/editor. O seletor **Ferramentas CAD da máscara ativa** mantém os três acessos com Ribbon recolhido ou Foco. Atalhos: `MEDIR` / `DIST`, `DIM` / `DIMENSION` / `COTA` (ortogonal) e `ALINHADA`.

## Consulta

Indique P1 e P2 por clique/snaps ou coordenadas em mm no Comando CAD, com entradas absolutas ou relativas existentes. Durante o movimento aparece a prévia; o painel mostra distância real, ΔX/ΔY, unidade mm/cm/m e 0–6 casas decimais. P2 fixa o resultado e permite outro par. Concluir, Esc ou Enter sem par pendente encerra. A consulta não cria objetos, transações nem modifica o estado de salvo/autosave, geometria, RA ou CSV. O arredondamento é apenas do texto; os pontos e o resultado interno conservam precisão de ponto flutuante.

## Inserir cota

1. Escolha ortogonal ou alinhada. O painel permite mudar o modo antes de lançar; a mudança reinicia os pontos.
2. Indique P1 e P2. Com máscara ativa, snaps em suas entidades capturáveis registram referências para **verificação**, sem editar a máscara. Pontos livres continuam permitidos e identificados como estáticos.
3. Escolha a posição da linha/texto no terceiro ponto. A prévia usa a mesma anotação/renderização existente. Na ortogonal, posição acima/abaixo do centro escolhe projeção horizontal; nas laterais escolhe vertical. Alinhada mede a diagonal real.
4. O terceiro clique/coordenada confirma um lote de uma anotação. Esc antes disso descarta a preparação. Enter/cliques repetidos não criam duplicatas. Undo/Redo trata a anotação inteira; seleção/pontos/prévia não entram no histórico.

Exemplo: P1=(0,0), P2=(3000,4000) → consulta 5000 mm, ΔX=3000 e ΔY=4000. Cota alinhada mostra 5000 mm; posições ortogonais (1500,6000) e (6000,2000) mostram 3000 mm e 4000 mm. Unidade só muda apresentação.

A cota conserva `Annotation`: três pontos, altura, layer, estilo, texto automático/manual e editor por propriedades. Altura/estilo novos usam `annotationCadDefaults` e a aparência de cotas já existente. Unidade/precisão podem ser ajustadas antes do lançamento e em **Apresentação da cota** no inspector. Texto manual é override explícito; deixe vazio para o valor calculado. Posição continua no terceiro ponto e no editor de pontos existente. A barra selecionada anteriormente não é aproveitada no contexto Máscaras. Em Desenho, o vínculo de armadura previamente escolhido conserva o contrato existente.

## Referência estática e diagnóstico

Estas cotas **não são associativas/paramétricas**: não seguem automaticamente mover, escalar, aparar ou apagar a máscara. Referências de pontos capturados na máscara ativa guardam ID/índice da entidade, ponto local e assinatura geométrica; não geram vínculos físicos com aço. Uma edição que altera a geometria/escala, move a referência, remove a entidade/máscara ou muda o detalhamento produz aviso persistente e prefixo **[REFERÊNCIA ALTERADA]** no texto compartilhado por canvas, prancha, PDF e DXF. O valor antigo fica explicitamente sinalizado. Undo que restaura a referência restaura o diagnóstico válido. Estilos/cores não invalidam geometria.

A verificação usa tolerância diagnóstica de 0,0001 mm e assinatura não criptográfica de geometria. Ela é conservadora; não equivale a um solver de restrições. Uma referência sem ID usa índice e assinatura, sem se religar silenciosamente a outra identidade. Pontos sem referência capturada permanecem cotas livres estáticas, explicitamente indicadas. Após editar a referência, recrie/revise os pontos da cota; **Remover verificação de máscara** é uma decisão explícita para mantê-la como cota livre estática. Cotas antigas não recebem associações inventadas.

Cópia conjunta máscara+cota e inserção/substituição de pacote remapeiam os IDs de referência. Cópia/movimento da cota sozinha pode sinalizar divergência; não move a referência. Edição local de referência importada nunca escreve no DXF/DWG original. Cotas não mudam aço, posições, quantidades, peso, RA ou CSV.

## Contexto, persistência e limites

As sessões capturam projeto/desenho/detalhamento, isolamento e máscara ativa. Troca de contexto, máscara, perda de alvo ou alteração concorrente do projeto cancela a preparação. Pontos finitos em ±1e9 mm são obrigatórios. Criação é revalidada pelo histórico e pelas proteções existentes de layer/visibilidade/isolamento. Consultar uma referência bloqueada mas capturável é permitido; criar cota em layer protegido é recusado. Snaps respeitam visibilidade/captura, inclusive layers implícitos. Nenhum comando aciona Seguir fôrma.

A interação é no desenho/modelo. Em uma folha, abra o desenho pela vista para medir/cotar; não se interpreta mm de papel como comprimento físico. Nas vistas 1:50 e 1:100, o valor da anotação é o do modelo, com posição e tamanho tratados pelo pipeline de prancha existente. Não há nova medição por pixels de PDF/folha.

Projeto **armadurastruct/24** migra 1–23; pacote **openstruct.detail/15** lê 1–14. Os novos campos opcionais de unidade/precisão e verificação estática são validados e preservados por `decodeProject`, salvar/reabrir, recuperação e intercâmbio mm/cm/m. Projetos antigos conservam a apresentação anterior (cm/uma casa, sem sufixo quando não havia override), sem referências novas. Dados novos em versão antiga são recusados explicitamente. Uma referência órfã é carregada com diagnóstico, não descartada. O DXF usa as entidades de texto/linhas já existentes e não anuncia vínculos associativos DXF; o projeto/intercâmbio guardam a verificação. Limites atuais de curvas normalizadas/segmentadas continuam sendo os de importação e exportação.

As tarefas AS-27/28/29 permanecem separadas: não se adicionam estilos em lote, pés, múltiplos de arredondamento, offsets de cotas automáticas de barras ou outro editor. O formatador de apresentação é único para a consulta e o texto de anotação, pronto para reutilização por essas tarefas. A altura/estilo e a posição usam os contratos atuais.

## Validação

`tests/maskDimensions.test.ts` cobre 3–4–5, projeções, precisão, pontos inválidos, máscara transformada, diagnóstico de escala/movimento/corte/exclusão, estilo, persistência, migração, clonagem, intercâmbio/remapeamento, vistas 1:50/1:100 e saída PDF/DXF/CSV. `tests/e2e/maskDimensions.spec.ts` cobre consulta sem histórico/estado de salvo, prévia, unidades, repetição/zoom, terceira posição, cancelamento, histórico, recuperação, referência apagada, CSV/DXF, proteções/contexto e Foco em 900×650. A suíte existente foi atualizada somente nas expectativas da versão de saída.

Comandos: `npm run check`, `npm run build`, `npm run format:check`, `npm run test:e2e`. Capturas sintéticas são publicadas no artefato **mask-dimensions-evidence** da CI: consulta, posição, referência alterada e Foco. O Chromium local sofre restrição de sockets; navegador é executado no GitHub em Chromium/Linux. Builds Linux/Windows usam a CI existente; aplicativo instalado não é testado interativamente. Sem release, novas dependências, serviços, permissões amplas ou telemetria.
