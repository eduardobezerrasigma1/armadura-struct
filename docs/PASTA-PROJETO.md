# Pasta do projeto

**Novo projeto** (tela inicial, Arquivo ou acesso rápido) usa o mesmo assistente. Preencha o nome, escolha **Pasta do projeto**, confira o arquivo principal mostrado e confirme **Criar projeto**. A pasta selecionada é a raiz: não se acrescenta uma subpasta com o nome da obra. Para criar uma raiz nova, use a ação de nova pasta do seletor do sistema, quando disponível, e confira a localização final. Essa ação do seletor pertence ao sistema; pode criar a pasta vazia mesmo se o assistente for cancelado.

Selecionar/trocar a pasta só prepara o rascunho. Cancelar o seletor conserva a escolha anterior; Cancelar/Esc/×/clique fora do assistente preservam projeto aberto, histórico, recuperação e arquivos. Ao confirmar, o arquivo inicial é validado, escrito e relido **antes** de substituir o documento aberto. Falhas mantêm o assistente e o rascunho. Durante essa etapa os campos ficam inativos, cliques repetidos são ignorados e o fechamento do assistente aguarda o resultado. A área central rola; as ações ficam no rodapé.

A confirmação de substituição e **Salvar cópia do projeto atual** continuam no assistente. A cópia é um arquivo independente do documento anterior, escolhido pelo fluxo normal de arquivo/download. Nunca usa automaticamente a pasta do novo projeto.

## Contrato mínimo, versão 1

| Caminho relativo à raiz escolhida                                      | Contrato                                                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `save-v1/projeto.armstruct.json`                                       | Documento nativo completo e portável; seu `id` identifica o projeto proprietário. `save-v1` identifica a versão do contrato de organização. |
| `save-v1/.projeto.previous`                                            | Desktop: última versão anterior íntegra; proteção técnica, não revisão formal.                                                              |
| `save-v1/.projeto.lock`, `save-v1/.projeto-<processo>-<sequência>.tmp` | Desktop: trava exclusiva e temporários da escrita. Não remover enquanto outra instância estiver gravando.                                   |
| `exportacoes/desenhos/`                                                | Reservado para exportação futura por ação explícita. Não é criado nesta entrega.                                                            |
| `exportacoes/configuracoes/`                                           | Reservado para configurações exportadas futuramente. Não é criado nesta entrega.                                                            |

Sem manifesto paralelo: o próprio Project conserva IDs, hierarquia, máscaras incorporadas e configurações. Não há novos campos documentais nem migração de schema por causa da pasta. Não são copiados arquivos externos de origem.

Os nomes administrados são constantes ASCII, sem parâmetros vindos do nome da obra ou do arquivo importado. Nomes exibidos com acentos, `CON`, separadores, pontos finais ou extensão não se tornam caminhos. Não há editor de tokens nem extensão repetida. Aliases por caixa Unicode ou pontos/espaços finais nos nomes administrados são recusados, inclusive no Linux. Limites de caminho e permissões são os reais do sistema; erro não provoca mudança de destino. A raiz vem exclusivamente do seletor, nunca de texto/pasta incluídos em JSON.

Adote uma raiz por projeto. Uma pasta com outros arquivos pode ser usada se os nomes administrados estiverem livres. Nenhum arquivo alheio é movido, renomeado ou limpo. Um `save-v1` ocupado sem documento reconhecível é recusado; arquivo vazio/inválido também não autoriza sobrescrita. Quando houver documento, **Abrir projeto existente nesta pasta** usa o mesmo leitor nativo e a confirmação de substituição. Outro ID/conteúdo nunca é mesclado automaticamente.

## Salvar, recuperar e reassociar

Com vínculo ativo, **Salvar projeto** e o automático (debounce de 500 ms) gravam o arquivo principal sem novo diálogo. Cada vínculo mantém uma fila de snapshots e comparação com o último texto confirmado no disco. A recuperação IndexedDB tem sua própria fila. Uma gravação de A conserva seu adaptador de A durante a abertura de B. Desfazer/refazer restaura o vínculo da sessão junto ao snapshot correspondente; não apaga arquivos/pastas nem cria novas permissões. Desfazer edição e aguardar o automático também salva esse estado desfeito, como qualquer edição.

**Arquivos do projeto**, na barra de estado, abre as ações de pasta e cópia em painel compacto sem reduzir a área do CAD. **Salvar cópia independente** continua usando o seletor de arquivo/download, sem mudar o destino principal. PDF/DXF/CSV e pacotes de detalhamento mantêm os destinos e exportadores anteriores; criar/salvar não os exporta.

Estados: **Gravando na pasta**, **Salvo na pasta do projeto**, **Apenas recuperável localmente**, falha de recuperação e **Acesso perdido/falha na pasta**. Só a conclusão da API com releitura coerente permite declarar gravação na pasta. Um download solicitado não confirma existência do arquivo no disco. Em falhas, alterações permanecem em memória e a recuperação local é tentada independentemente; use Salvar novamente, **Localizar/associar pasta** ou **Salvar cópia independente**.

A associação é local e vale somente na sessão autorizada. Handles/tokens/caminhos não entram no Project nem em exportações. Um lembrete local de localização (ID + impressão do snapshot + rótulo, sem autorização) pode acompanhar a recuperação. Não basta o `projectId` para reatribuir acesso: importar um arquivo, mesmo com o mesmo ID, desvincula essa cópia. Durante a sessão, **Localizar/associar pasta** permite manter edições pendentes se o arquivo escolhido ainda corresponde exatamente ao último snapshot de disco observado pelo vínculo. Após reiniciar/recarregar, exige novo gesto e compara o arquivo inteiro normalizado ao projeto aberto. Recuperação local divergente do disco exige cópia em outra raiz ou abertura explícita do existente; não restaura autorização a partir de um ID ou lembrete. Se divergir, abra o existente pelo assistente ou grave uma cópia noutra pasta; não há fusão automática. Pasta vazia pode ser associada explicitamente, criando ali o arquivo. A fonte original permanece intacta.

## Desktop Linux/Windows

O seletor nativo entrega um token interno por sessão; os comandos aceitam apenas esse token, conteúdo e versão esperada, nunca um caminho arbitrário. O backend usa diretório por capability (`cap-std`), identidade do diretório selecionado (`same-file`), nomes fixos e rejeição de links nos nomes administrados. Caminhos relativos e links que escapem da raiz não concedem escrita. Não se ampliam escopos globais de leitura/escrita, privilégios ou permissões do sistema.

A escrita cria temporário exclusivo, grava, sincroniza e verifica conflitos. A versão principal é preservada como `.projeto.previous` antes da instalação do novo principal. Não se trunca o único arquivo válido. A trava exclusiva impede escritores cooperantes de duas instâncias; comparação antes da substituição detecta modificações externas. Não existe compare-and-swap universal contra editores externos que ignorem a trava: uma corrida após a última verificação ainda depende do sistema de arquivos. Não é uma revisão imutável ou garantia contra falha física do dispositivo/cache; sincronização de diretório e corte de energia não foram simulados.

Se uma interrupção ocorrer entre os renames, o leitor admite `.projeto.previous` quando falta o principal. Um bloqueio abandonado não é removido automaticamente: feche todas as instâncias, preserve uma cópia de `save-v1`, abra o principal ou `.projeto.previous` como arquivo independente, confira a recuperação e salve numa **nova raiz vazia**. Essa é também a recuperação segura para temporário órfão, disco cheio ou pasta desconectada; não há limpeza recursiva nem restauração automática de temporários. O aviso informa os nomes que podem ter sido produzidos.

Fechar a janela desktop durante escrita pendente é impedido com orientação para aguardar. A capability da janela `main` acrescenta apenas `core:window:allow-destroy`, necessária para o fechamento normal após `onCloseRequested`; não acrescenta escopos de sistema de arquivos. Encerrar o processo/sistema à força pode interromper a operação; os arquivos produzidos permanecem para recuperação. Pasta movida/substituída/removida perde o vínculo: localize-a novamente e valide seu conteúdo antes de salvar.

## Navegador

Quando `showDirectoryPicker` e Web Locks estão disponíveis, **Escolher pasta** solicita leitura/escrita por gesto do usuário. A interface mostra o nome acessível do diretório; browsers não necessariamente revelam caminho absoluto. A permissão é consultada a cada leitura/escrita e no retorno de foco. Revogação exige localizar/reautorizar. Handles não são persistidos nem reativados automaticamente.

`createWritable` prepara a nova versão e só a instala no `close`; falha/abort preserva conteúdo anterior conforme a API do navegador. Web Locks serializa todos os escritores cooperantes da mesma origem, inclusive criações com IDs diferentes. Solicita-se também `createWritable({mode: "exclusive"})`; a escrita gerenciada exige Web Locks. A comparação do texto evita sobrescrita externa conhecida; as mesmas limitações de corrida final contra outros aplicativos se aplicam. Criação inicial interrompida pode deixar arquivo vazio/estrutura criada; isso é informado e recusado na próxima criação. Escolha outra raiz, preservando os artefatos para inspeção. O aviso padrão de saída do navegador é solicitado enquanto há gravação; o próprio navegador pode limitar sua apresentação.

Sem API de escrita de diretório ou Web Locks, o modo compatível é identificado no assistente: permite criar/editar com recuperação IndexedDB e download manual. Um input de diretório não é usado para simular autorização. O editor continua funcional, sem alegar que salvou numa pasta. Nenhuma nuvem, conta, sincronização ou telemetria de caminhos é acrescentada.

## Validação e limites de cobertura

A suíte de serviço cobre nomes fixos, colisões, fila, vínculos/histórico, cópia do mesmo ID, falhas, permissões e modo compatível. E2E Chromium usa adaptador de diretório simulado com escrita por fechamento para os fluxos do assistente/status; capturas são artefatos de CI. A suíte Rust usa diretórios temporários controlados para criação, backup, retomada, travas, conflitos, arquivos alheios e, no Unix, symlink/raiz substituída. CI compila e testa o backend em Linux e Windows.

**Não executado interativamente:** seletor/permissão/reabertura em desktop real, File System Access em disco real, armazenamento removível, disco realmente cheio, corte de energia, navegadores Safari/Firefox e NTFS com configurações especiais. Mocks, testes de diretório e builds não substituem essa cobertura. Para homologar: criar em diretório temporário escolhido, editar/salvar, fechar/reabrir/reautorizar, revogar acesso e repetir em cada plataforma. Nenhuma plataforma é declarada homologada apenas pelo build.
