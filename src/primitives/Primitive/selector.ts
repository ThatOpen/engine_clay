export class Selector {
  data = new Set<number>();

  /**
   * Select or unselects the given faces.
   * @param active Whether to select or unselect.
   * @param ids List of faces IDs to select or unselect. If not
   * defined, all faces will be selected or deselected.
   * @param allItems all the existing items.
   */
  select(active: boolean, ids: Iterable<number>, allItems: number[]) {
    const all = new Set<number>(allItems);
    const idsToUpdate: number[] = [];
    for (const id of ids) {
      const exists = all.has(id);
      if (!exists) continue;

      const isAlreadySelected = this.data.has(id);
      if (active) {
        if (isAlreadySelected) continue;
        this.data.add(id);
        idsToUpdate.push(id);
      } else {
        if (!isAlreadySelected) continue;
        this.data.delete(id);
        idsToUpdate.push(id);
      }
    }
    return idsToUpdate;
  }

  getUnselected(ids: number[]) {
    const notSelectedIDs: number[] = [];
    for (const id of ids) {
      if (!this.data.has(id)) {
        notSelectedIDs.push(id);
      }
    }
    return notSelectedIDs;
  }
}
