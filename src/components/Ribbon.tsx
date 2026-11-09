import {
  Settings,
  Eye,
  EyeOff,
  Copy,
  Download,
  FilePlus2,
  FileText,
  FlipHorizontal2,
  FolderOpen,
  Grid2X2,
  Hand,
  HelpCircle,
  Layers,
  Maximize2,
  MousePointer2,
  Move,
  PencilRuler,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  ScanLine,
  Shapes,
  SquareDashed,
  Table2,
  Trash2,
  Undo2,
  Scissors,
  Combine,
  Spline,
  ArrowUpRight,
  LockKeyhole,
  RefreshCw,
  ListOrdered,
  PanelRight,
  ChevronUp,
  ChevronDown,
  Focus,
  type LucideIcon,
} from 'lucide-react';
import type { Tool } from '../domain/types';
import type { ReactNode } from 'react';
import { NumberField } from './Panels';
export type Action =
  | Tool
  | 'cad-settings'
  | 'mask-control'
  | 'mask-calibrate'
  | 'mask-offset'
  | 'mask-trim'
  | 'mask-extend'
  | 'mask-copy'
  | 'mask-erase'
  | 'mask-move'
  | 'mask-mirror'
  | 'mask-rotate'
  | 'associate-masks'
  | 'mask-line'
  | 'mask-rectangle'
  | 'mask-circle'
  | 'mask-polyline'
  | 'new'
  | 'open'
  | 'save'
  | 'import'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'rotate'
  | 'mirror'
  | 'fit'
  | 'grid'
  | 'snap'
  | 'ortho'
  | 'dimensions'
  | 'pdf'
  | 'dxf'
  | 'csv'
  | 'insert-sheet-schedule'
  | 'schedule'
  | 'help'
  | 'join'
  | 'split'
  | 'refresh-schedule'
  | 'lock-schedule'
  | 'renumber'
  | 'sidebar'
  | 'focus'
  | 'group'
  | 'ungroup'
  | 'edit-detail'
  | 'finish-detail'
  | 'insert-detail'
  | 'update-detail'
  | 'export-detail'
  | 'interpret-cad'
  | 'detail-repetition'
  | 'fabrication'
  | 'clone-armature'
  | 'layers'
  | 'align-selection'
  | 'insert-vertex'
  | 'extend-vertex'
  | 'remove-vertex'
  | 'edit-segment'
  | 'lengthen-bar'
  | 'plot'
  | 'hide-objects'
  | 'isolate-objects'
  | 'show-all-objects'
  | 'show-hidden-objects'
  | 'end-object-isolation';
// Detail editing uses the hierarchy identity instead of another group model.
type Item = {
  action: Action;
  label: string;
  caption?: string;
  icon: LucideIcon;
  selection?: number;
  disabled?: boolean;
};
const item = (
  action: Action,
  label: string,
  icon: LucideIcon,
  selection = 0,
): Item => ({ action, label, icon, selection });
export type CreationSettings = {
  diameter: number;
  quantity: number;
  spacing: number;
  cover: number;
};
export default function Ribbon({
  tab,
  setTab,
  onAction,
  active,
  selected,
  canUndo,
  canRedo,
  collapsed,
  setCollapsed,
  settings,
  onSettings,
  isolated = false,
  groupSelected = false,
  maskDestination,
}: {
  tab: string;
  setTab: (s: string) => void;
  onAction: (a: Action) => void;
  active: Partial<Record<Action, boolean>>;
  selected: number;
  canUndo: boolean;
  canRedo: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  settings: CreationSettings;
  onSettings: (p: Partial<CreationSettings>) => void;
  isolated?: boolean;
  groupSelected?: boolean;
  maskDestination?: ReactNode;
}) {
  const groups: Record<
    string,
    { name: string; items: Item[]; creation?: boolean }[]
  > = {
    CONFIGURAÇÕES: [
      {
        name: 'Padrões do projeto',
        items: [item('cad-settings', 'Configurações CAD', Settings)],
      },
    ],
    Arquivo: [
      {
        name: 'Projeto',
        items: [
          item('new', 'Novo projeto', FilePlus2),
          item('open', 'Abrir projeto', FolderOpen),
          item('save', 'Salvar projeto', Save),
        ],
      },
      {
        name: 'Referências',
        items: [item('import', 'Máscara DXF / DWG', Layers)],
      },
      {
        name: 'Exportar',
        items: [
          item('plot', 'Estilos de impressão', Layers),
          item('pdf', 'Prancha PDF', FileText),
          item('dxf', 'Desenho DXF', Download),
          item('csv', 'Quadro CSV', Table2),
          item('export-detail', 'Pacote de detalhamento', Download),
        ],
      },
      { name: 'Ajuda', items: [item('help', 'Guia de uso', HelpCircle)] },
    ],
    Máscaras: [
      {
        name: 'Ferramentas',
        items: [
          item('mask-calibrate', 'Ajustar escala', Ruler),
          {
            ...item('mask-offset', 'Offset — Paralelas de máscara', Copy),
            caption: 'Offset',
          },
          {
            ...item(
              'mask-trim',
              'Ajustar — Aparar / Trim de máscara',
              Scissors,
            ),
            caption: 'Ajustar',
          },
          {
            ...item('mask-extend', 'Estender — Extend de máscara', Move),
            caption: 'Estender',
          },
          item('measure', 'Medir', Ruler),
        ],
      },
      {
        name: 'Manipular',
        items: [
          {
            ...item('mask-move', 'Mover entidades da máscara', Move),
            disabled: true,
            caption: 'Mover',
          },
          {
            ...item(
              'mask-mirror',
              'Espelhar entidades da máscara',
              FlipHorizontal2,
            ),
            disabled: true,
            caption: 'Espelhar',
          },
          {
            ...item('mask-rotate', 'Rotacionar entidades da máscara', RotateCw),
            disabled: true,
            caption: 'Rotacionar',
          },
          {
            ...item('mask-copy', 'Copiar entidades da máscara', Copy),
            caption: 'Copiar',
          },
          {
            ...item('mask-erase', 'Apagar entidades da máscara', Trash2),
            caption: 'Apagar',
          },
        ],
      },
      {
        name: 'Desenhar',
        items: [
          item('mask-line', 'Linha', PencilRuler),
          item('mask-rectangle', 'Retângulo', SquareDashed),
          item('mask-circle', 'Círculo', Shapes),
          item('mask-polyline', 'Polilinha', Spline),
        ],
      },
      {
        name: 'Controle de máscaras',
        items: [
          item('mask-control', 'Controle de máscaras', Layers),
          item('import', 'Importar DXF / DWG', FolderOpen),
          item('associate-masks', 'Associar máscaras', Layers),
        ],
      },
      {
        name: 'Navegar',
        items: [
          item('select', 'Selecionar', MousePointer2),
          item('pan', 'Pan', Hand),
          item('fit', 'Enquadrar', Maximize2),
          item('snap', 'Encaixes', ScanLine),
          item('ortho', 'Ortogonal', SquareDashed),
          item('undo', 'Desfazer', Undo2),
          item('redo', 'Refazer', Redo2),
        ],
      },
    ],
    Desenho: [
      { name: 'Layers', items: [item('layers', 'Gerenciar layers', Layers)] },
      {
        name: 'Anotar',
        items: [
          item('dimension-orthogonal', 'Cota ortogonal', Ruler),
          item('dimension-aligned', 'Cota alinhada', Ruler),
          item('leader', 'Chamada', ArrowUpRight),
          item('section-arc', 'Corte em arco', Spline),
          item('section', 'Corte e chamada', ScanLine),
          item('measure', 'Medir', Ruler),
        ],
      },
      {
        name: 'Visualização',
        items: [
          item('fit', 'Enquadrar', Maximize2),
          item('grid', 'Grade', Grid2X2),
          item('snap', 'Encaixes', ScanLine),
          item('ortho', 'Ortogonal', SquareDashed),
          item('dimensions', 'Cotas', Ruler),
        ],
      },
      {
        name: 'Visibilidade',
        items: [
          item('hide-objects', 'Ocultar seleção', EyeOff),
          item('isolate-objects', 'Isolar seleção', Focus),
          item('end-object-isolation', 'Sair do isolamento', Eye),
          item('show-all-objects', 'Exibir todos', Eye),
          item('show-hidden-objects', 'Mostrar ocultos', Eye),
        ],
      },
      {
        name: 'Espaço de trabalho',
        items: [
          item('sidebar', 'Painel lateral', PanelRight),
          item('focus', 'Foco no CAD', Focus),
        ],
      },
    ],
    Elementos: [
      {
        name: 'Intercâmbio',
        items: [item('export-detail', 'Pacote de detalhamento', Download)],
      },
      {
        name: 'Detalhamento',
        items: [
          item('insert-detail', 'Inserir detalhamento', FolderOpen),
          item('update-detail', 'Atualizar detalhamento', RefreshCw),
          item('fabrication', 'Posições de fabricação', Combine),
          item('detail-repetition', 'Repetições do detalhamento', Copy),
          item('group', 'Agrupar em detalhamento', Combine, 1),
          item('edit-detail', 'Editar detalhamento', Shapes),
          item('ungroup', 'Desagrupar seleção', Shapes, 1),
        ],
      },
      {
        name: 'Selecionar',
        items: [
          item('select', 'Selecionar', MousePointer2),
          item('pan', 'Pan', Hand),
        ],
      },
      {
        name: 'Editar',
        items: [
          item('move', 'Mover', Move, 1),
          item('copy', 'Copiar', Copy, 1),
          item('clone-armature', 'Duplicar completa', Copy, 1),
          item('align-selection', 'Alinhar / distribuir…', Move),
          item('rotate', 'Rotacionar…', RotateCw, 1),
          item('mirror', 'Espelhar por eixo…', FlipHorizontal2, 1),
          item('delete', 'Excluir', Trash2, 1),
        ],
      },
      {
        name: 'Vértices',
        items: [
          item('insert-vertex', 'Inserir vértices', PencilRuler, 1),
          item('extend-vertex', 'Continuar pela ponta', Spline, 1),
          item('remove-vertex', 'Remover vértices', Trash2, 1),
        ],
      },
      {
        name: 'Histórico',
        items: [
          item('undo', 'Desfazer', Undo2),
          item('redo', 'Refazer', Redo2),
        ],
      },
      {
        name: 'Acessar',
        items: [
          item('sidebar', 'Painel lateral', PanelRight),
          item('import', 'Importar máscara', FolderOpen),
          item('fit', 'Enquadrar', Maximize2),
        ],
      },
    ],
    Armaduras: [
      {
        name: 'Armaduras',
        creation: true,
        items: [
          item('bar', 'Barra livre', PencilRuler),
          item('stirrup', 'Estribo', SquareDashed),
          item('repeat', 'Repetir estribo', Copy, 1),
          item('detail', 'Rebater armadura', Shapes, 1),
          item('convert', 'Converter polilinha', Spline),
          item('follow', 'Seguir fôrma', ScanLine),
          item('interpret-cad', 'Interpretar CAD em armadura', PencilRuler),
        ],
      },
      {
        name: 'Poligonais / traspasse',
        items: [
          {
            ...item('edit-segment', 'Comprimentos e ângulos', Ruler, 1),
            caption: 'Comprim. e ângulos',
          },
          item('lengthen-bar', 'Estender barra', ArrowUpRight, 1),
          item('join', 'Emendar poligonais', Combine, 2),
          item('split', 'Dividir barra', Scissors, 1),
        ],
      },
      {
        name: 'Faixas de armadura',
        items: [item('range', 'Faixa ortogonal', Layers, 1)],
      },
      {
        name: 'Relação do aço',
        items: [
          item('refresh-schedule', 'Atualizar RA', RefreshCw),
          item('lock-schedule', 'Bloquear RA', LockKeyhole),
          item('schedule', 'Quadro de aço', Table2),
          item('insert-sheet-schedule', 'Inserir quadro na prancha', Table2),
          item('renumber', 'Renumerar', ListOrdered),
        ],
      },
    ],
  };
  return (
    <div className={`ribbon ${collapsed ? 'collapsed' : ''}`}>
      <div className="ribbon-tabs" role="tablist" aria-label="Ferramentas">
        {[
          ...Object.keys(groups).filter((t) => t !== 'CONFIGURAÇÕES'),
          'CONFIGURAÇÕES',
        ].map((t) => (
          <button
            role="tab"
            aria-selected={t === tab}
            key={t}
            className={t === tab ? 'active' : ''}
            onClick={() => {
              setTab(t);
              setCollapsed(false);
            }}
            onDoubleClick={() => setCollapsed(!collapsed)}
          >
            {t}
          </button>
        ))}
        <span className="ribbon-spacer" />
        <button
          className="collapse-ribbon"
          title="Recolher / expandir comandos · Ctrl+F1"
          aria-label={
            collapsed
              ? 'Expandir faixa de comandos'
              : 'Recolher faixa de comandos'
          }
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {tab === 'Máscaras' && maskDestination}
      {!collapsed && (
        <div className="ribbon-content">
          {(groups[tab] ?? groups.Armaduras).map((g) => (
            <div key={g.name} className="ribbon-group">
              <div className="ribbon-group-tools">
                {g.items.map((entry, i) => {
                  const t =
                    entry.action === 'lock-schedule' && active['lock-schedule']
                      ? { ...entry, label: 'Desbloquear RA' }
                      : entry;
                  return (
                    <span className="ribbon-item-slot" key={t.action}>
                      <button
                        className={`ribbon-tool ${active[t.action] ? 'active' : ''}`}
                        onClick={() => onAction(t.action)}
                        title={t.label}
                        aria-label={t.label}
                        aria-pressed={!!active[t.action]}
                        disabled={
                          entry.disabled ||
                          (!!t.selection && selected < t.selection) ||
                          (isolated &&
                            [
                              'detail-repetition',
                              'fabrication',
                              'insert-detail',
                              'update-detail',
                              'new',
                              'open',
                              'renumber',
                              'group',
                              'ungroup',
                              'edit-detail',
                              'lock-schedule',
                              'refresh-schedule',
                              'insert-sheet-schedule',
                            ].includes(t.action)) ||
                          (groupSelected &&
                            [
                              'copy',
                              'rotate',
                              'mirror',
                              'split',
                              'join',
                              'detail',
                              'range',
                              'repeat',
                              'distribute',
                              'edit-segment',
                              'lengthen-bar',
                            ].includes(t.action)) ||
                          (t.action === 'undo' && !canUndo) ||
                          (t.action === 'redo' && !canRedo)
                        }
                      >
                        <t.icon size={23} strokeWidth={1.5} />
                        <span>{t.caption ?? t.label}</span>
                      </button>
                      {g.creation && i === 1 && (
                        <div
                          className="creation-fields"
                          title="Parâmetros das próximas armaduras"
                        >
                          <NumberField
                            label="Quantidade de criação"
                            compactLabel="Qtd."
                            value={settings.quantity}
                            min={1}
                            max={100000}
                            step={1}
                            onChange={(quantity) => onSettings({ quantity })}
                          />
                          <label className="field">
                            <span>Bitola</span>
                            <select
                              aria-label="Bitola de criação"
                              value={settings.diameter}
                              onChange={(e) =>
                                onSettings({ diameter: Number(e.target.value) })
                              }
                            >
                              {![
                                4.2, 5, 6.3, 8, 10, 12.5, 16, 20, 22, 25, 32,
                                40,
                              ].includes(settings.diameter) && (
                                <option value={settings.diameter}>
                                  {settings.diameter}
                                </option>
                              )}
                              {[
                                4.2, 5, 6.3, 8, 10, 12.5, 16, 20, 22, 25, 32,
                                40,
                              ].map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </label>
                          <NumberField
                            label="Espaçamento de criação"
                            compactLabel="Espaç."
                            value={settings.spacing}
                            min={1}
                            onChange={(spacing) => onSettings({ spacing })}
                            suffix="mm"
                          />
                          <NumberField
                            label="Cobrimento padrão de criação"
                            compactLabel="Cobrim."
                            value={settings.cover}
                            min={0}
                            max={10000}
                            onChange={(cover) => onSettings({ cover })}
                            suffix="mm"
                          />
                        </div>
                      )}
                    </span>
                  );
                })}
              </div>
              <span className="ribbon-group-label">{g.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
