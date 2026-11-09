# Offset de entidades de máscaras

**Máscaras → Ferramentas → Offset** cria paralelas gráficas na máscara ativa. Também há acesso no Controle de máscaras e no seletor Ferramentas CAD, disponível em Foco e com a faixa recolhida. Os comandos são `OFFSET` e `PARALELA`.

## Uso

1. Confirme uma distância positiva **com unidade explícita**: `100 mm`, `10 cm` ou `0,1 m`. O último valor aparece como sugestão editável. A interpretação reutiliza as medidas do Comando CAD, aceita decimal pt-BR e não aceita separador de milhar.
2. Alternativamente, escolha **Distância por dois pontos** e capture P1/P2 por clique, snaps ou coordenadas absolutas/relativas/polares. A distância euclidiana física é adotada sem arredondamento. Os pontos não criam objetos.
3. Selecione uma entidade da máscara ativa no canvas ou na lista pesquisável por nome/ID. Aço, máscara inteira e outras máscaras não entram no comando. Uma seleção residual anterior é descartada com aviso.
4. Mova o cursor para conferir original, lado e prévia. Clique no lado desejado para criar a cópia. O lado é calculado no ponto físico: inverter os vértices da origem não troca o resultado para o lado oposto. A escolha do lado usa o cursor sem projetá-lo por snap/ortogonal sobre a própria entidade.
5. Selecione outras entidades para repetir com a mesma distância. **Enter/Esc encerra**, abandonando somente a preparação/prévia pendente. No formulário de distância, Enter confirma o valor. Alterar distância ou escolher outra entidade abandona a prévia anterior sem aplicá-la.

Cada clique confirmado corresponde a **uma transação de Desfazer/Refazer**. Quando há mais de um remanescente, a prévia informa a quantidade e todos são criados juntos. Duplo clique/repetição não confirma o mesmo resultado duas vezes. Desfazer durante uma preparação sem operações apenas a cancela; após uma cópia confirmada, encerra o comando e desfaz a última operação.

## Geometria e topologia

| Origem e distância física                                 | Lado                  | Resultado                                                             |
| --------------------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Linha (0,0)–(1000,0), 100 mm                              | Superior              | Linha (0,100)–(1000,100), inclusive com origem invertida              |
| Círculo R=500, 100 mm                                     | Externo / interno     | Mesmo centro, R=600 / R=400 analíticos                                |
| Retângulo 1000×500, 100 mm                                | Interno / externo     | 800×300 / 1200×700, mantendo retângulo analítico                      |
| L e U abertos                                             | Lado físico escolhido | Interseções das linhas paralelas, cantos retos e extremidades abertas |
| Contorno côncavo fechado                                  | Interno / externo     | Contornos regularizados e todos os remanescentes válidos              |
| Duas áreas 1000×1000 unidas por gargalo de 200 mm, 150 mm | Interno               | Dois remanescentes 700×700 independentes, sem ligação inventada       |

Linhas, círculos, retângulos e arcos analíticos usam coordenadas de dupla precisão. Círculos/arcos mantêm centro, abertura e raio; arcos exigem escolher o lado diante do trecho curvo, afastado das pontas. Linhas/polilinhas abertas usam a interseção miter compartilhada com `offsetChain`, sem importar cobrimento, Ø/2, mandril ou comportamento de armadura.

Para contornos fechados, a regularização de topologia usa `clipper-lib` **6.4.2**, com origem transladada e grade geométrica de **0,000001 mm**, independente da formatação dos textos. Os contornos retornados conservam o sentido da origem. Junções são retas (**miter**). Cantos cuja interseção exceda **20×d**, retornos de 180°, pontos degenerados, autointerseções/sobreposições na origem e contatos não adjacentes são recusados. Não há chanfro, redução da distância ou simplificação para fazer caber.

Offset interno que colapsa completamente um contorno/retângulo/círculo é recusado. Em contornos fechados com estreitamentos, as regiões sobreviventes podem se separar: a quantidade aparece na prévia, sem cópias parciais. Polilinhas abertas cujo offset cruze ou inverta um trecho são recusadas integralmente. **Resultados que criariam furos são recusados**, pois o contrato atual não agrupa contorno externo e furos com preenchimento. A ferramenta não transforma um furo em uma região preenchida independente.

Clique sobre a entidade ou num prolongamento/região com lados opostos igualmente próximos pede correção. A tolerância geométrica é 0,000001 mm; na captura pelo mouse, uma faixa de 3 pixels é convertida ao modelo para recusar cliques visualmente sobre a linha. Zoom afeta essa captura, sem alterar a distância calculada.

## Integridade e persistência

- Original, ID da máscara, transformação, origem, associação ao detalhamento e arquivo externo permanecem. Cada resultado recebe ID próprio, layer/estilo/overrides herdados e proveniência `sourceEntityId`. A proveniência é histórica, sem vínculo vivo que regenere aço ou a geometria original.
- Operações usam mm do modelo e convertem para coordenadas locais considerando rotação, translação e escala da máscara. Não mudam escala da vista nem zoom.
- Camadas ocultas, sem captura ou bloqueadas, visibilidade por objeto, isolamento e desenho ativo são revalidados antes de confirmar. Não há edição no espaço de papel. Troca de projeto/desenho/máscara/aba/isolamento ou alteração concorrente invalida a preparação.
- Aço, posições, quantidades, peso, relação de aço bloqueada e CSV permanecem iguais. Cotas existentes continuam estáticas e independentes; Offset não as remapeia para a nova geometria.
- DXF/DWG normalizado pode conter curvas já amostradas pelo importador. A prévia avisa que o Offset usa esses segmentos e sua aproximação disponível, sem reconstrução analítica ou nova discretização escondida. Tipos não suportados, como texto, são recusados antes de alterar dados.
- Canvas, prancha, PDF e DXF usam a geometria compartilhada de primitivas. A saída atual amostra círculos/arcos com erro radial máximo de 0,05 mm locais (0,05×scale no modelo) e exporta LWPOLYLINE; os dados analíticos permanecem no projeto/intercâmbio. Não há exportação DWG nova.
- Salvar/reabrir, recuperação automática e intercâmbio transportam os resultados confirmados. Não foram acrescentados campos persistidos: continuam `armadurastruct/23` e `openstruct.detail/14`, sem migração adicional.
- Limites: distância entre 0,000001 e 1 bilhão de mm; coordenadas dentro de ±1 bilhão de mm; 100 mil entidades por máscara; 500 vértices por resultado nativo; orçamento de 250 mil comparações de segmentos. Referências normalizadas maiores são recusadas quando excedem o orçamento, sem cortar vértices silenciosamente. A lista mostra até 200 resultados por pesquisa.
- Não há modo Through implícito. Apenas distância explícita ou distância medida por dois pontos.

## Arquivos e validação

`src/domain/maskOffset.ts` contém planos puros, lado físico, validação, regularização e aplicação atômica. Reutiliza `maskManipSelection`, `maskCurve`, interseções e a matemática miter compartilhada em `geometry.ts`. `MaskOffsetPanel.tsx`, `App.tsx`, `CadCanvas.tsx`, Ribbon, Controle e destino ativo integram o fluxo ao histórico e à captura existentes.

`tests/maskOffset.test.ts` confere os casos dimensionais, concavidade, múltiplos remanescentes, sentido inverso, medidas/unidades, erros, máscaras transformadas, proteção, limite, persistência/intercâmbio, RA/CSV e coordenadas nas saídas DXF e nas vistas 1:50/1:100. `tests/e2e/maskOffset.spec.ts` cobre etapas, cancelamento, repetição, histórico, recuperação, exportação, troca de contexto, teclado e Foco.

Comandos de validação: `npm run check`, `npm run build`, `npm run format:check`, `npm run test:e2e`. O navegador local deste ambiente não inicia por restrição de sockets; os fluxos E2E são executados na CI GitHub em Chromium/Linux. A interface Tauri instalada Linux/Windows não é executada interativamente neste ambiente.

As capturas dos projetos sintéticos são geradas em `docs/mask-offset-distance.png`, `mask-offset-preview.png`, `mask-offset-result.png`, `mask-offset-split.png` e `mask-offset-compact.png`. A CI publica o artefato **mask-offset-evidence**, sujeito à retenção do GitHub; reexecutar os testes gera novas capturas. Não são arquivos de projeto reais do usuário.

Referência da dependência: [Clipper — offset de contornos e junções](https://github.com/junmer/clipper-lib/blob/master/Documentation.md), licença Boost Software License 1.0. Sua grade é usada somente na regularização poligonal; os casos analíticos citados acima não passam por essa quantização.
