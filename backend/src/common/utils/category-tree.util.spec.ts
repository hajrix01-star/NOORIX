import { expandCategoryTreeIds } from './category-tree.util';

describe('expandCategoryTreeIds', () => {
  it('expands every descendant once and tolerates cycles', () => {
    const ids = expandCategoryTreeIds(
      ['root'],
      [
        { id: 'root', parentId: null },
        { id: 'child', parentId: 'root' },
        { id: 'grandchild', parentId: 'child' },
        { id: 'cycle-a', parentId: 'cycle-b' },
        { id: 'cycle-b', parentId: 'cycle-a' },
      ],
    );

    expect([...ids].sort()).toEqual(['child', 'grandchild', 'root']);
  });

  it('combines multiple roots without duplicates', () => {
    const ids = expandCategoryTreeIds(
      ['root', 'child'],
      [
        { id: 'root', parentId: null },
        { id: 'child', parentId: 'root' },
      ],
    );

    expect([...ids].sort()).toEqual(['child', 'root']);
  });
});
