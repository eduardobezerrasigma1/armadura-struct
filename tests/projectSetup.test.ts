import { describe, it, expect } from 'vitest';
import {
  newProjectSetup,
  prepareProjectSetup,
  projectSetupIssues,
  addProjectSetupNode,
  editProjectSetupNode,
  projectSetupRemoval,
  removeProjectSetupNode,
  hasProjectSetupToReplace,
  PROJECT_SETUP_LIMITS,
} from '../src/domain/projectSetup';
import {
  emptyProject,
  newBar,
  decodeProject,
  schedule,
} from '../src/domain/model';
import { validateHierarchy, completeOwnership } from '../src/domain/hierarchy';
import { executeRebarBatch } from '../src/domain/rebarApi';
function fixture() {
  let d = newProjectSetup();
  const first = d.project.hierarchy;
  d = editProjectSetupNode(d, 'floor', first.floors[0].id, 'Térreo');
  d = editProjectSetupNode(
    d,
    'element',
    first.elements[0].id,
    'V01',
    first.floors[0].id,
  );
  const p01 = addProjectSetupNode(d, 'element', first.floors[0].id);
  d = editProjectSetupNode(
    p01.draft,
    'element',
    p01.id,
    'P01',
    first.floors[0].id,
  );
  const floor = addProjectSetupNode(d, 'floor');
  d = editProjectSetupNode(floor.draft, 'floor', floor.id, 'Cobertura');
  const v02 = addProjectSetupNode(d, 'element', floor.id);
  d = editProjectSetupNode(v02.draft, 'element', v02.id, 'V02', floor.id);
  const detail = d.project.hierarchy.details.find(
    (n) => n.elementId === v02.id,
  )!;
  return { ...d, activeDetailId: detail.id };
}
describe('Novo projeto · rascunho nativo e preparação atômica', () => {
  it('nome apenas produz estrutura mínima visível, folha vazia e nenhum aço ou demonstração', () => {
    const d = newProjectSetup();
    d.project.name = '  Projeto simples  ';
    const r = prepareProjectSetup(d);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('Falhou');
    expect(r.project.name).toBe('Projeto simples');
    expect(d.project.name).toBe('  Projeto simples  ');
    const h = r.project.hierarchy;
    expect(h.floors).toHaveLength(1);
    expect(h.elements).toHaveLength(1);
    expect(h.details).toHaveLength(1);
    expect(h.drawings).toHaveLength(1);
    expect(h.floors[0].name).toBe('Térreo');
    expect(h.elements[0].name).toBe('Vigas');
    expect(h.details[0].name).toBe('V1');
    expect(h.drawings[0].name).toBe('Desenho principal');
    expect(r.project.bars).toEqual([]);
    expect(r.project.details).toEqual([]);
    expect(r.project.masks).toEqual([]);
    expect(h.placements).toEqual([]);
    expect(schedule(r.project)).toEqual([]);
    expect(r.project.sheets).toHaveLength(1);
    expect(r.project.schema).toBe('armadurastruct/24');
  });
  it('prévia personalizada corresponde ao resultado e preserva IDs sem acrescentar padrões', () => {
    const d = fixture(),
      before = JSON.stringify(d),
      r = prepareProjectSetup(d);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('Falhou');
    expect(r.project.hierarchy).toEqual(d.project.hierarchy);
    expect(r.project.id).toBe(d.project.id);
    expect(r.activeDetailId).toBe(d.activeDetailId);
    expect(r.project.hierarchy.elements).toHaveLength(3);
    for (const [floor, names] of [
      ['Térreo', ['V01', 'P01']],
      ['Cobertura', ['V02']],
    ] as const) {
      const f = r.project.hierarchy.floors.find((f) => f.name === floor)!;
      expect(
        r.project.hierarchy.elements
          .filter((e) => e.floorId === f.id)
          .map((e) => e.name),
      ).toEqual(names);
    }
    expect(r.project.hierarchy.elements.some((e) => e.name === 'Geral')).toBe(
      false,
    );
    expect(JSON.stringify(d)).toBe(before);
    expect(decodeProject(JSON.stringify(r.project))).toEqual(r.project);
  });
  it('acrescentar, renomear, mover e remover só afetam o rascunho; IDs homônimos têm pais distintos', () => {
    let d = fixture();
    const original = d,
      before = JSON.stringify(d),
      h = d.project.hierarchy,
      e = h.elements.find((e) => e.name === 'V02')!,
      floor = h.floors[0].id;
    d = editProjectSetupNode(d, 'element', e.id, 'V01', e.floorId);
    expect(
      d.project.hierarchy.elements.filter((e) => e.name === 'V01'),
    ).toHaveLength(2);
    d = editProjectSetupNode(d, 'element', e.id, 'V03', floor);
    expect(
      d.project.hierarchy.elements.find((n) => n.id === e.id)?.floorId,
    ).toBe(floor);
    expect(
      d.project.hierarchy.details.find((n) => n.elementId === e.id)?.id,
    ).toBe(original.activeDetailId);
    expect(JSON.stringify(original)).toBe(before);
    const extra = addProjectSetupNode(d, 'detail', e.id);
    expect(extra.draft.project.hierarchy.drawings).toHaveLength(
      d.project.hierarchy.drawings.length + 1,
    );
    expect(d.project.hierarchy.drawings).toHaveLength(3);
  });
  it('remoção de pai enumera filhos, exige confirmação e não deixa desenhos/vínculos órfãos', () => {
    const d = fixture(),
      floor = d.project.hierarchy.floors.find((f) => f.name === 'Cobertura')!,
      impact = projectSetupRemoval(d, 'floor', floor.id),
      before = JSON.stringify(d);
    expect(impact.blocked).toBe(false);
    expect(impact.elements.map((e) => e.name)).toEqual(['V02']);
    expect(impact.details).toHaveLength(1);
    expect(impact.drawings).toHaveLength(1);
    expect(() => removeProjectSetupNode(d, 'floor', floor.id)).toThrow(
      /Confirme/,
    );
    expect(JSON.stringify(d)).toBe(before);
    const q = removeProjectSetupNode(d, 'floor', floor.id, true);
    expect(q.project.hierarchy.floors).toHaveLength(1);
    expect(q.project.hierarchy.elements).toHaveLength(2);
    expect(q.project.hierarchy.drawings).toHaveLength(2);
    expect(
      q.project.hierarchy.details.some((n) => n.id === q.activeDetailId),
    ).toBe(true);
    expect(() => validateHierarchy(q.project)).not.toThrow();
    const simple = newProjectSetup();
    expect(
      projectSetupRemoval(
        simple,
        'floor',
        simple.project.hierarchy.floors[0].id,
      ).blocked,
    ).toBe(true);
    expect(() =>
      removeProjectSetupNode(simple, 'detail', simple.activeDetailId, true),
    ).toThrow(/Mantenha/);
  });
  it('validação útil por campo/objeto recusa nomes, limites, IDs duplicados, órfãos e destino inválido', () => {
    const d = fixture();
    d.project.name = ' ';
    d.project.author = 'a'.repeat(151);
    d.project.hierarchy.elements[0].name = ' ';
    d.project.hierarchy.elements[0].floorId = 'missing';
    d.activeDetailId = 'missing';
    expect(projectSetupIssues(d)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'author' }),
        expect.objectContaining({
          field: 'parent',
          objectId: d.project.hierarchy.elements[0].id,
        }),
        expect.objectContaining({ field: 'activeDetailId' }),
      ]),
    );
    expect(prepareProjectSetup(d).ok).toBe(false);
    const tooMany = newProjectSetup();
    tooMany.project.hierarchy.floors = Array.from(
      { length: PROJECT_SETUP_LIMITS.floors + 1 },
      (_, i) => ({ id: `floor${i}`, name: 'P' }),
    );
    expect(prepareProjectSetup(tooMany).ok).toBe(false);
    expect(() => addProjectSetupNode(tooMany, 'floor')).toThrow(/Limite/);
    const duplicate = fixture();
    duplicate.project.hierarchy.elements[1].id =
      duplicate.project.hierarchy.elements[0].id;
    expect(prepareProjectSetup(duplicate).ok).toBe(false);
    expect(() => addProjectSetupNode(fixture(), 'element', 'missing')).toThrow(
      /Pavimento/,
    );
    expect(() =>
      editProjectSetupNode(fixture(), 'floor', 'missing', 'Nome'),
    ).toThrow(/inexistente/);
    const long = newProjectSetup();
    long.project.hierarchy.floors[0].name = 'x'.repeat(101);
    expect(prepareProjectSetup(long).ok).toBe(false);
  });
  it('rascunho não aceita conteúdo físico; o projeto atual e seus quantitativos permanecem independentes', () => {
    const open = completeOwnership({
        ...emptyProject(),
        bars: [{ ...newBar('N1'), quantity: 8 }],
      }),
      before = JSON.stringify(open),
      d = fixture();
    expect(prepareProjectSetup(d).ok).toBe(true);
    expect(JSON.stringify(open)).toBe(before);
    expect(schedule(open)[0].quantity).toBe(8);
    expect(
      prepareProjectSetup({
        project: open,
        activeDetailId: open.hierarchy.details[0].id,
      }).ok,
    ).toBe(false);
  });
  it('novos objetos entram no detalhamento escolhido e a hierarquia segue persistindo em v19', () => {
    const d = fixture(),
      r = prepareProjectSetup(d);
    if (!r.ok) throw new Error('Falhou');
    const result = executeRebarBatch(
      r.project,
      [
        {
          type: 'bar.create',
          id: 'new-bar',
          detailId: r.activeDetailId,
          definition: {
            kind: 'free',
            mark: 'N1',
            diameter: 8,
            mandrel: 40,
            steel: 'CA-50',
            quantity: 4,
            points: [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
            ],
          },
        },
      ],
      { units: 'mm' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.hierarchy.objectDetails['new-bar']).toBe(
        r.activeDetailId,
      );
      expect(schedule(result.project)[0].quantity).toBe(4);
      expect(decodeProject(JSON.stringify(result.project))).toEqual(
        result.project,
      );
    }
  });
  it('reabrir o assistente inicia outro rascunho mínimo e a confirmação considera projeto configurado', () => {
    const a = fixture(),
      b = newProjectSetup();
    expect(a.project.id).not.toBe(b.project.id);
    expect(b.project.hierarchy.floors).toHaveLength(1);
    expect(hasProjectSetupToReplace(b.project)).toBe(false);
    expect(hasProjectSetupToReplace(a.project)).toBe(true);
    const renamed = { ...b.project, name: 'Minha obra' };
    expect(hasProjectSetupToReplace(renamed)).toBe(true);
    const styled = structuredClone(b.project);
    styled.layers[0].color = '#aabbcc';
    expect(hasProjectSetupToReplace(styled)).toBe(true);
  });
});
