# Copiar propriedades gráficas

Use **Desenho** ou **Máscaras → Ferramentas → Copiar propriedades**, ou `MATCHPROP` / `COPIARPROPRIEDADES` no Comando CAD.

1. Escolha a fonte por nome/ID. Entidades da máscara ativa também podem ser escolhidas no canvas.
2. Marque somente as propriedades desejadas: layer, cor, tipo/escala/espessura de linha, altura e alinhamento de texto.
3. Escolha destinos na lista pesquisável ou, para entidades da máscara ativa, por clique no canvas. Clique novamente para retirar. A lista mostra até 200 resultados por pesquisa.
4. Confira a prévia no canvas e **Aplicar propriedades**. Todos os destinos são confirmados numa transação. O conjunto é limpo após aplicar, mantendo fonte e opções para novos destinos. Esc encerra; Desfazer/Refazer trata o lote. Antes da primeira aplicação, Desfazer apenas cancela a preparação.

**Vínculos ByLayer e overrides** copia os overrides explícitos; um atributo ByLayer da fonte remove o override correspondente no destino. Se Layer não estiver marcado, o destino continua ligado ao próprio layer. **Aparência resolvida** fixa os valores visíveis da fonte como overrides somente nos atributos escolhidos. O catálogo de layers não é alterado.

Tipos atendidos: polilinhas CAD, anotações, barras/representações (somente atributos gráficos) e primitivas da máscara ativa. Máscaras inteiras não são alvos. As seleções anteriores não são reutilizadas. Fonte e destinos precisam estar no detalhamento/desenho ativo e respeitar isolamento, visibilidade, captura e bloqueios; editar no papel não é permitido. Uma fonte capturável bloqueada pode ser consultada; destinos bloqueados e layers de destino protegidos são recusados.

Altura é copiada em mm físicos, convertendo as escalas das máscaras. Alinhamento é compatível entre textos de máscara; anotações admitem altura, mas não alinhamento independente no contrato atual. Barras/representações não recebem atributos de texto por este comando. Propriedade incompatível impede o lote inteiro e informa o destino; retire essa propriedade antes de confirmar.

Overrides globais da máscara podem prevalecer sobre suas entidades. Quando impedem uma propriedade selecionada, o comando recusa o lote com orientação, preservando o contrato de renderização atual. Não remove automaticamente overrides globais nem altera outras entidades. Overrides de impressão são preservados e podem prevalecer no PDF/DXF, conforme os estilos de impressão existentes. Não copia preenchimento, conteúdo, rotação, posição, geometria, IDs, marcas, quantidades, bitola, aço, mandril, vínculos físicos ou presets de folhas. Fontes tipográficas independentes não existem nesse contrato e não são inventadas.

A prévia usa um projeto temporário somente para renderização. Salvar, autosave, RA e exportações usam o projeto confirmado. Troca de projeto/desenho/máscara/isolamento invalida a preparação; a aplicação revalida o snapshot e a proteção. O alvo temporário não é guardado como seleção de máscara inteira ao alternar documentos. Seleção e consultas não criam histórico nem modificam o estado de salvo.

Os atributos reutilizam `LayerBinding`, estilos e campos de texto existentes. Não há novo schema ou migração; `decodeProject`, recuperação e intercâmbio mantêm os campos. Canvas, PDF e DXF usam os mesmos consumidores de estilo; curvas continuam com a geometria disponível, sem nova discretização. Edição gráfica de referência importada não escreve no arquivo externo.

Implementação: `src/domain/matchProperties.ts`, `src/components/MatchPropertiesPanel.tsx`, integração em `App.tsx`, acessos no Ribbon e estilos do painel. Testes em `tests/matchProperties.test.ts` e `tests/e2e/matchProperties.spec.ts`. Comandos: `npm run check`, `npm run build`, `npm run format:check`, `npm run test:e2e`.

As capturas sintéticas de opções, prévia e Foco são geradas pelos E2E e publicadas no artefato **graphic-properties-evidence** da CI. O Chromium local está limitado por restrições de sockets; os E2E são executados no GitHub em Chromium/Linux. Aplicativo Tauri instalado Linux/Windows não executado interativamente. Não há release nesta entrega, novos serviços, permissões ou dependências.
