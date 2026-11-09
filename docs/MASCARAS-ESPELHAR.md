# Espelhar entidades de máscaras

Em **Máscaras → Manipular → Espelhar**, selecione entidades da máscara ativa por clique ou pela lista; outro clique retira. A pré-seleção do Controle de máscaras é aceita. Aço e seleção de máscara inteira não são reaproveitados. Enter confirma o conjunto.

1. Escolha o primeiro ponto do eixo por clique/snap ou coordenadas no Comando CAD.
2. Escolha o segundo ponto. O eixo infinito e a prévia acompanham o cursor. Coordenadas absolutas, `@dx,dy` e `@distância<ângulo` reutilizam as entradas existentes, em mm do modelo. Encaixes e ortogonal são os existentes no CAD.
3. Responda **Apagar objetos de origem?**. **Não** é o padrão explícito: mantém os originais e cria novos IDs. **Sim** substitui somente as entidades escolhidas, preservando seus IDs/linhagem. A máscara inteira permanece.
4. Clique **Confirmar espelhamento** ou Enter. Uma operação no histórico contém o lote inteiro. Enter/cliques repetidos não repetem a operação. Esc em qualquer etapa cancela a preparação; a prévia nunca modifica o arquivo salvo ou autosave. Para outro conjunto, reinicie o comando.

Também disponível em **Ferramentas CAD da máscara ativa**, no Controle de máscaras e por `MIRROR` / `ESPELHARMASCARA`. `ESPELHAR` usa este fluxo na aba Máscaras e conserva a transformação de Elementos nas demais abas. O grupo Manipular existente mantém a ordem Mover, Espelhar, Rotacionar, Copiar, Apagar; os comandos ainda não implementados continuam desabilitados.

A transformação reutiliza `transformPoint`/validação de `transforms.ts`, composta modelo → máscara local. Não usa caixa envolvente nem pixels. Eixo com comprimento inferior a 0,01 mm, coordenadas não finitas/fora de ±1e9 mm, resultado inviável, entidades removidas, layers ocultos/sem captura/bloqueados e contexto incompatível são recusados antes do commit. Trocar projeto, desenho, máscara, detalhamento/isolamento ou alterar o snapshot cancela a sessão. Layers implícitos usam o mesmo fallback da renderização. Não escreve no DXF/DWG original.

## Geometria, texto e vínculos

- Linhas/polilinhas refletem todos os vértices, fechamento e orientação. Círculo conserva raio; arco reflete centro/início e inverte a abertura analítica. Cache gráfico é recomposto pelo contrato existente.
- Retângulos conservam o contrato de dois cantos quando ele representa exatamente os vértices refletidos. Nos demais eixos, ficam como polilinha fechada de **quatro vértices exatos**, preservando forma/orientação sem amostrar a borda. A política é informada no painel antes de aplicar.
- Texto importado tem âncora refletida e direção da linha base refletida, normalizada em −90° a 90° no modelo; o alinhamento é compensado quando a linha base se inverte. Caracteres não recebem escala negativa. Conteúdo e altura permanecem. Uma orientação inicialmente invertida pode ser normalizada por essa política.
- Cotas externas à máscara usam pontos estáticos e ficam intactas; o painel pede revisão explícita. Cotas importadas são suas primitivas normalizadas: selecione os segmentos e textos pretendidos. Não são criados vínculos paramétricos inexistentes. `sourceEntityId` é linhagem/proveniência: remapeada entre as cópias do lote e preservada na substituição. Armaduras lançadas sobre referências não são regeneradas nem alteradas.
- IDs, layers, estilos, origem, unidade, escala, rotação da máscara, aço, marcas, quantitativos, RA e CSV permanecem fora do alcance da operação, exceto novos IDs explícitos no modo Não. Outras máscaras e entidades não selecionadas permanecem intactas.

## Persistência, saída e validação

Não há novo schema/migração: salvar/reabrir, recuperação e intercâmbio reutilizam os contratos de primitivas existentes. Canvas, pranchas, PDF e DXF usam a representação compartilhada. **Círculos/arcos são amostrados na saída existente com erro radial máximo de 0,05 × escala da máscara mm no modelo; DXF escreve LWPOLYLINE, não ARC/CIRCLE.** Os dados analíticos permanecem no projeto/intercâmbio. Referências já amostradas pelo importador mantêm a aproximação disponível, sem reconstrução analítica nem nova discretização escondida. Não há nova exportação DWG.

`tests/maskMirror.test.ts` cobre eixos arbitrários/invertidos, duplo reflexo, máscara transformada/importada, arco/círculo/retângulo, legibilidade de texto, limites/proteções/contexto, pureza da prévia, IDs/linhagem, round-trip/intercâmbio, PDF/DXF e RA/CSV. `tests/e2e/maskMirror.spec.ts` cobre seleção acumulada/retirada, pré-seleção, pontos por coordenadas/clique, prévia/eixo, Sim/Não, repetição, cancelamento, histórico, recuperação, troca de projeto, texto transformado e Foco em 900 × 650. A regressão inclui Copiar/Apagar e os demais comandos existentes.

Execute `npm run check`, `npm run build`, `npm run format:check` e `npm run test:e2e`. As capturas sintéticas de eixo, confirmação e Foco são geradas pelos E2E e publicadas no artefato **mask-mirror-evidence** da CI. O Chromium local tem restrição de sockets neste ambiente; navegador é validado na CI em Chromium/Linux. Builds desktop usam a CI existente; aplicativo instalado Linux/Windows não é testado interativamente. Sem release, dependências, serviços ou telemetria novos.
