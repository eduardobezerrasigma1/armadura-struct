# Histórico de versões

## Em desenvolvimento · 2026-11-09

- Novo projeto: escolha explícita de pasta, arquivo nativo inicial validado antes da troca, vínculo local, filas de salvamento/recuperação, conflitos e retomada segura. Desktop com acesso restrito ao diretório selecionado; web com File System Access ou modo compatível identificado. Exportadores preservam seus diálogos. [Contrato e uso](docs/PASTA-PROJETO.md).

- Máscaras → Ferramentas: Medir distância e Inserir cota ortogonal/alinhada usam os comandos existentes de Desenho. Consulta com prévia, ΔX/ΔY, unidades e precisão; cota estática com verificação da referência e aviso em canvas/PDF/DXF após alteração/perda. Projeto `armadurastruct/24` e pacote `openstruct.detail/15`, com migração compatível. [Uso e limites](docs/MASCARAS-MEDIR-COTAR.md).
- Máscaras → Manipular → Espelhar: seleção compartilhada, dois pontos do eixo com prévia infinita e confirmação de manter/substituir originais, com histórico atômico. Preserva raio/arco, texto legível, IDs/vínculos na substituição e aço/RA/CSV. [Uso e limites](docs/MASCARAS-ESPELHAR.md).
- Copiar propriedades gráficas entre entidades CAD, com escolha de atributos, ByLayer/overrides ou aparência resolvida, prévia e aplicação em lote sem alterar geometria ou quantitativos. [Uso e limites](docs/COPIAR-PROPRIEDADES.md).
- Máscaras → Ferramentas → Offset: paralelas por distância com unidade ou dois pontos, seleção de entidade e lado físico, prévia cancelável e repetições com histórico por aplicação. Círculos, arcos e retângulos mantêm dados analíticos; contornos fechados podem se dividir em remanescentes. Preserva original, aço, RA/CSV, estilos e origem. [Uso, precisão e limites](docs/MASCARAS-OFFSET.md).
- Máscaras → Manipular: Copiar e Apagar com seleção acumulada, pré-seleção, ponto base e destinos sucessivos, prévia cancelável, IDs independentes e transações atômicas. Preserva máscara vazia, aço, RA/CSV e cotas estáticas com orientação explícita. [Uso e contratos](docs/MASCARAS-COPIAR-APAGAR.md).
- Máscaras: Ajustar (Aparar / Trim) e Estender (Extend), com limites finitos, prévia, seleção por clique/ID, operações sucessivas e histórico por corte/prolongamento. Referências de outras máscaras podem limitar; somente o alvo editável é alterado, sem aço adicional.
- Arcos analíticos para remanescentes de círculos e prolongamentos circulares, IDs/linhagem dos fragmentos e edição local de referências importadas. Projeto `armadurastruct/23` (migração 1–22) e pacote `openstruct.detail/14` (leitura 1–13). [Uso e validação](docs/MASCARAS-AJUSTAR-ESTENDER.md).

## 0.3.0 · 2026-11-07

- AS-20: perfis de layers independentes por desenho e vista, com Exibir/Capturar/Editar, presets Conferência/Armaduras/Fôrma e perfis personalizados. Seleção, encaixes, alças e transações respeitam a proteção; o PDF segue a visibilidade de cada vista sem alterar o quadro de aço.
- AS-19: layers nativos com IDs estáveis, estilos ByLayer e overrides, edição/reassociação em lote e importação/exportação DXF 2007 com RGB, tipos de linha e penas. CAD, papel, PDF e DXF compartilham a resolução dos estilos.
- AS-53: cópia completa das armaduras com novos IDs e marcas, remapeamento de inserções, chamadas e auxiliares, prévia e políticas explícitas para vínculos compartilhados e posições equivalentes; uma transação de desfazer/refazer.
- Exemplo inicial executável de vigas e pilares, com duas pranchas, 64 posições, 1.181 peças e conferência da relação de aço de referência. Projetos recuperados mantêm prioridade e Novo projeto continua vazio.
- Formato nativo atual `armadurastruct/15`, com leitura e migração dos formatos 1–14; pacote de detalhamento `openstruct.detail/8`, com leitura v1–v7. Os marcos de formato abaixo documentam a evolução dos recursos desta versão. Aplicativos anteriores não abrem projetos salvos no novo formato; mantenha cópias dos originais.

- AS-52: representações independentes por ID, origem/rotação/escala gráfica, política de identificação e descrição principal explícita; seleção, edição e exclusão por inserção. Transformações comuns para CAD, snaps, enquadramento e PDF/DXF, sem aço adicional. Formato nativo 11 e pacote v5, com migração dos rebatimentos legados.

- AS-55: renumeração espacial determinística por posição de fabricação, prévia antes/depois, prefixo/início, quatro sentidos, escopos, marcas reservadas/preservadas e política comum da próxima marca livre. Formato nativo 10, migração 1–9, IDs e quantitativos preservados.

- AS-56: base por grupo, multiplicador inteiro por armadura e quantidade efetiva, compostos com a repetição do detalhe uma única vez. Origem manual ou faixa com quantidade fixa/espaçamento registrado; base controlada é recalculada e protegida de edição ambígua.
- Observação, indicação/opção de texto por nervura e referência textual ao lance nas propriedades, consultas, chamadas, rebatimentos e saídas; preferência gráfica por quantidade fatorada ou total, sem alterar o aço.
- Formato nativo 9 (migração 1–8), pacote `openstruct.detail/4` (leitura v1/v2/v3), contribuições de fabricação e snapshots com fatores/metadados, API comum, exemplo executável e testes AS-56.

- AS-54: entidades de posição de fabricação separadas das ocorrências, assinatura canônica por forma/aço/bitola/mandril/gancho/terminações/variante, percurso reverso explícito e reflexão conservadora.
- Prévia de equivalências com representante, pesquisa, seleção de contribuições, agrupar/desagrupar e uma operação de histórico. Editar uma peça separa somente sua ocorrência; marcas compartilhadas conservam os IDs das chamadas.
- Quadro/CSV/DXF/PDF consolidados com somas reais por ocorrência, rastreabilidade, repetições independentes e snapshot de fabricação na RA. Campos compactos de especificação de pontas/luvas/variantes.
- Formato nativo 8 (migração 1–7), pacote `openstruct.detail/3` (leitura v1/v2), associação preservada na importação seletiva e operações atômicas `fabrication.group`/`fabrication.ungroup` na API 1.0. Exemplo executável, contrato, documentação e testes AS-54.

- AS-03: repetição inteira por detalhamento, lista de elementos vinculados/nomes livres, título automático e levantamento com quantidade base, fator e quantidade efetiva. Vistas/rebatimentos adicionais não acrescentam aço.
- Reunião assistida de detalhes com posições físicas idênticas, escolha do representante, retirada controlada das definições duplicadas, redirecionamento de desenhos/vistas e reassociação de vínculos externos; comparação e uma etapa de desfazer/refazer.
- Formato 7, migração dos formatos 1–6, contexto congelado da RA e pacote `openstruct.detail/2` para transportar a repetição. Leitura de pacotes v1 permanece disponível sem multiplicador.
- Títulos, CAD, RA/resumo, CSV, DXF e PDF consideram a repetição. Agrupar e transferir posições preserva ou exige um fator compatível; origens reunidas são protegidas contra reimportação duplicada.

- AS-51: fachada TypeScript `src/api.ts`, versão 1.0, com famílias discriminadas, capacidades, unidades em mm e erros estruturados por operação/objeto/campo. Lotes rejeitados conservam integralmente o projeto original.
- Criação/edição/exclusão, cópia/movimentação/transformação, divisão/união/renumeração e associação de rebatimentos/faixas compartilhadas pela interface e geradores; validação de geometria, referências, marcas/IDs e contexto isolado antes de confirmar.
- Exemplo executável de barra, estribo e conjunto distribuído por `npm run example:rebar`; integração ao histórico em uma operação por lote, com políticas explícitas para referências e RA bloqueada.

- AS-09: pacote aberto `openstruct.detail/1`, exportação de um detalhamento, importação pela comparação da AS-08, conversão mm/cm/m, origem transitiva, metadados e tratamento explícito de dependências externas.
- Reconhecimento de uma origem já presente propõe atualização, preservando IDs locais, vistas e uma única definição física; colisões são tratadas pelo mapeamento existente.
- Interpretação assistida de contornos/textos de máscaras DXF/DWG, propriedades físicas explícitas, confirmação de unidade e preservação integral das primitivas normalizadas como referência. Criação transacional com desfazer/refazer e invalidação da RA bloqueada.
- JSON Schema, exemplos em mm/cm e produtor Python utilizável por outros apps OpenStruct; o formato de projeto permanece 6, com metadados opcionais aditivos na origem.

- AS-08: Inserir detalhamento e Atualizar detalhamento a partir de outro JSON, com seleção da origem/destino, comparação de posições, pesos, objetos e prévias antes/depois, sem trocar o projeto aberto.
- Reconhecimento por identidade de projeto/pavimento/elemento/detalhamento e origem dos objetos; homônimos não são associados pelo nome. Posições preservadas mantêm IDs e marcas locais; novas marcas são resolvidas sem colidir com as existentes.
- Reassociação explícita de chamadas/rebatimentos, importação controlada de dependências e bloqueio de aplicação com vínculos pendentes. Cancelar não altera o modelo/histórico; a aplicação é uma única transação reversível.
- Preservação de desenhos/vistas e de posição/escala/rotação; centralização opcional do conteúdo e avisos de enquadramento. Dados físicos/da RA alterados desbloqueiam e recalculam a RA; alterações somente gráficas preservam seu bloqueio.
- Formato 6 com proveniência por detalhamento/objeto, migração dos formatos 1–5 e validação de referências. Abertura normal continua estrita; a leitura seletiva permite resolver referências de origem sem definição antes de aplicar.

- AS-05: composição vetorial em mm de papel com vistas em escalas independentes, origens no modelo e rotação; PDF com uma página por folha, no formato/orientação definidos e com escala declarada por vista.
- Formatos A0–A4 e personalizado (50–5.000 mm por lado), margens editáveis, reserva de selo inferior direita e campos básicos de projeto/folha/revisão/notas.
- Mesmas primitivas de papel na tela e no PDF; textos/cotas com altura mínima de 2 mm, padrão de 2,5 mm. A escala não modifica comprimentos nem pesos do modelo.
- Sinalização de conteúdo fora do quadro/área útil ou sobre o selo e bloqueio de PDF antes da gravação. Redimensionar papel/quadro mantém as escalas; centralizar mantém a escala e ajustar escala é um comando explícito.
- Formato 5 com migração de projetos 1/2/3/4; preservação de objetos físicos, IDs, vínculos e posições de folha. As prévias antigas recebem escala fixa; o valor antigo é guardado em `legacyScale`.

- AS-04: gerenciador compacto de pranchas; folhas vazias A0–A4 com orientação, revisão/notas, renomeação, ordenação, duplicação de layout e exclusão sem remover armaduras.
- Vistas com IDs próprios e referências aos desenhos existentes; posição, rotação e quadro de prévia em mm de papel, arraste, duplicação/retirada e lista de desenhos não colocados.
- Abas por folha e desenho preservam câmera, seleção e comando em andamento; edição de desenhos reaproveita a proteção da AS-02 e atualiza todas as vistas. Fechar uma aba preserva sua sessão durante o uso; câmeras e abas abertas são preferências locais.
- Formato 4 com migração determinística de projetos 1/2/3, preservando os dados físicos e posicionamentos existentes. Histórico e reabertura incluem nomes, ordem, propriedades e vínculos das folhas.
- Prévia vetorial compartilha as primitivas do exportador, sem carregar jsPDF na edição. A impressão dos novos layouts em escala e carimbos personalizados fica para a etapa de composição de pranchas; PDF/DXF atuais permanecem globais.

- AS-02: agrupamento visual por detalhamento, seleção do conjunto, duplo clique no CAD/árvore, edição isolada com caminho de navegação e Concluir edição.
- Proteção de objetos externos em seleção, comandos, histórico e gravações assíncronas; desagrupar preserva dados físicos, IDs, vínculos e quantitativos. O deslocamento de um conjunto inclui suas chamadas, rebatimentos e demais geometrias associadas.
- AS-01: pavimentos, elementos e detalhamentos compostos com identidades estáveis; criação, edição, movimentação, exclusão de nós vazios e pesquisa no navegador compacto.
- Migração determinística dos formatos 1/2 para 3 sem transformar os objetos físicos ou rebatimentos nem alterar quantitativos; validação das referências ao reabrir.
- Objetos novos pertencem ao detalhamento ativo; transferência de barras inclui seus rebatimentos e chamadas. Desenhos lógicos e posicionamentos de folha ficam separados da geometria física.
- Hierarquia integrada ao salvamento, recuperação e desfazer/refazer; preferências de expansão da árvore persistem por projeto no dispositivo.

## 0.2.0 · 2026-11-06

- Ambiente de desenho com faixa compacta, painel lateral único com abas, recolhimento persistente e modo Foco no CAD.
- Parâmetros de criação acessíveis no topo: quantidade, bitola e espaçamento máximo.
- Polilinhas CAD e conversão de contornos próprios/importados em armaduras.
- Repetição de estribos e faixas ortogonais com quantitativo vinculado.
- Cotas ortogonais/alinhadas, chamadas e cortes gráficos retos/em arco; identificação vinculada às posições e exportação DXF/PDF.
- Divisão em trecho reto com traspasse manual contabilizado nas duas peças; união geométrica de poligonais compatíveis.
- Bloqueio/atualização da relação de aço, aviso de alterações pendentes e proteção contra exportação de quantitativos desatualizados.
- Renumeração mantendo vínculos, edição da posição dos rebatimentos, pavimento/revisão e PDF A3 em escala.
- Migração de projetos 0.1 para o formato 2, preservando barras e máscaras.
- Testes de geometria, quantitativos, persistência e fluxos CAD; importação DXF/DWG mantida.

Os comprimentos de traspasse são informados pelo projetista. Esta versão não dimensiona emendas, ancoragens ou elementos estruturais.

## 0.1.1

- Identidade própria de Hefesto, ícones nativos e primeira distribuição assinada pelo Struct Launcher para Windows e Linux.

## 0.1.0

- CAD inicial, barras e estribos, rebatimentos, máscaras DXF/DWG, quadro de aço e exportações.
