# Lançar estribos pela seção e pela faixa

Em **Armaduras**, **Critérios do estribo** fica junto de **Estribo**. O atalho **E** inicia o lançamento. No primeiro uso do projeto abre os critérios; depois reutiliza os últimos valores. Os valores iniciais são sugestões editáveis, sem verificação normativa. Cada gancho, mandril e cobrimento é responsabilidade do projetista.

## Critérios

- **Forma**: retangular, circular ou livre; contorno aberto/fechado, bitola, aço, mandril interno, rotação e dois ganchos independentes. O trecho reto de cada gancho pode ser informado em **mm** ou **× bitola**. O arco da dobra também entra no comprimento de corte.
- **Referência**: medidas no eixo ou seção de concreto com cobrimento medido até a face externa do aço. Neste último caso, o envelope do eixo é a seção menos duas vezes `(cobrimento + bitola/2)`. Circular usa o diâmetro informado; livre usa pontos no eixo, sem deduzir cobrimento de uma máscara.
- **Distribuição**: somente seção com quantidade manual, ou seção mais faixa longitudinal. Informe espaçamento máximo/fixo e afastamentos das duas faces. No modo máximo o passo é ajustado para alcançar ambos os extremos; no fixo o passo permanece e a sobra fica junto à segunda face. A faixa exige ao menos duas peças.
- **Representação**: exibir cotas, identificação e ganchos. Ocultar ganchos afeta apenas a apresentação: comprimento, RA/CSV e peso continuam considerando a peça completa. Layers, cores e alturas de texto seguem os padrões CAD existentes.

**Desenhar forma livre no CAD** suspende a janela. Clique os vértices com os snaps ou digite coordenadas no comando CAD. Enter conclui e retorna à prévia dos critérios. Não repita o primeiro ponto: o fechamento é automático. São aceitos de 2 a 100 vértices (mínimo 3 para fechado), com dobras analíticas; cruzamentos, retornos de 180° e trechos insuficientes são recusados. **Voltar etapa** remove o último ponto durante a captura.

O contorno retangular aberto tem três lados em U. O circular aberto usa a abertura angular informada; fechado percorre 360°. Contornos fechados encontram suas pontas no meio do primeiro trecho (retangular/livre) ou no ponto inicial circular. Os ganchos são acrescentados nas duas pontas; não há solda, transpasse extra ou verificação de colisão/ancoragem presumidos. Confira sentidos e fechamento na prévia. Ramos múltiplos, grampos S/C, abas de laje e séries variáveis não são modelados nesta entrega.

## Lançamento

1. Ajuste os critérios e clique **Usar critérios e lançar**.
2. Posicione a seção: canto inferior esquerdo da referência escolhida para retângulo, centro para círculo ou primeiro vértice para forma livre. A rotação definida nos critérios é respeitada.
3. Com distribuição habilitada, indique primeira e segunda face/início/fim do trecho. Os pontos são estáticos, em mm do modelo: não se vinculam automaticamente aos pilares ou à máscara.
4. Escolha a posição da linha de distribuição e da identificação, deslocando-a perpendicularmente ao trecho. Esse deslocamento é gráfico e não altera a extensão, o passo nem a quantidade física.
5. Confira quantidade, passo efetivo e primeira/última posição no painel; clique **Confirmar lançamento** ou pressione Enter no comando CAD. **Voltar etapa** permite corrigir os pontos antes de confirmar. Esc cancela o rascunho completo em qualquer etapa.

A faixa mostra quantidade, posição, bitola e espaçamento efetivo em cm. A seção desenhada representa essa mesma posição: não acrescenta uma unidade à faixa. Por exemplo, vão de 1.100 mm, afastamentos 50/75 mm e passo máximo 200 mm resultam em **6 peças, passo 195 mm**. Com passo fixo 200 mm são **5 peças**, com sobra junto à segunda face. Inclinação, zoom e escala da vista não mudam esses cálculos.

A confirmação gera uma única operação atômica. Desfazer remove seção e faixa; Refazer recupera os mesmos IDs e parâmetros. Repetir Enter não confirma outro lançamento. Troca de projeto, desenho, detalhamento, isolamento, máscara ativa ou alteração do projeto durante a prévia cancela o comando; reinicie no contexto correto. A operação revalida os layers e a possibilidade de criar no destino antes de confirmar.

**Critérios do estribo** configura os próximos lançamentos e mantém valores em memória durante a sessão. Os critérios são persistidos no projeto junto da confirmação do lançamento; abrir/fechar a janela ou preparar uma forma não altera histórico nem arquivo. Para mudar uma posição existente, selecione-a e use **Editar critérios desta posição** nas propriedades. Essa ação preserva ID, faixa, multiplicadores e quantidade; as representações e a RA usam a geometria atualizada. Alterar os critérios gerais não muda peças existentes.

Estribos antigos preservam seus vértices, ganchos e comprimentos originais. Aplicar explicitamente os novos critérios a uma posição legada converte sua seção e mostra aviso e prévia antes da aplicação. Os controles legados de largura/altura/gancho continuam disponíveis para essas peças.

## Persistência, intercâmbio e exportação

O formato nativo passa a **armadurastruct/25** e o pacote de detalhamento a **openstruct.detail/16**. Não há caminhos externos ou novos arquivos obrigatórios. `decodeProject` preserva perfil, aparência, faixa e critérios; versões anteriores continuam abrindo e não recebem perfis automaticamente. Campos novos em versões antigas são rejeitados. O intercâmbio converte comprimentos de perfis/ganchos/faixas em mm/cm/m e mantém fatores × bitola sem escalá-los.

Círculos e dobras são arcos analíticos para comprimento e assinatura de fabricação. O DXF emite entidades ARC para esses novos perfis, incluindo representações rotacionadas/escaladas/espelhadas. Canvas usa arcos SVG. A cadeia gráfica compartilhada de PDF/prancha aproxima arcos com erro radial máximo de **0,05 mm do modelo**; essa aproximação nunca participa de comprimento, quantidade ou peso. Exportações existentes, máscara externa e barras de outras posições não são modificadas pelo lançamento.

## Verificação

- Domínio: seção/eixo/cobrimento, ganchos mm/×bitola, circular aberto/fechado, forma livre côncava, erros geométricos, passo fixo/máximo, afastamentos, deslocamento gráfico, lote atômico, legado, persistência, pacotes mm/cm/m, reflexos, fabricação, PDF/DXF e integridade da RA/CSV anterior.
- Navegador: critérios, posicionamento, prévia sem escrita, confirmação única, histórico, salvar/reabrir/autorecuperação, Esc por etapa, faixa inválida, mudança de contexto, edição explícita, circular/livre e janela baixa. Capturas são produzidas em `docs/stirrup-*.png` pelo E2E e publicadas no artefato **stirrup-launch-evidence** do CI.
- Checks de entrega: `npm run check`, `npm run build`, `npm run format:check` e Playwright. O CI também compila instaladores Linux/Windows; isso não substitui teste de interação no desktop nativo. Uso com toque e execução nativa interativa devem ser conferidos nas plataformas disponíveis antes de declarar cobertura.
