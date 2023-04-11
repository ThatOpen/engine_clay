/**
 * An object to keep track of entities and its position in a geometric buffer.
 */
export class IdIndexMap {
  private _idGenerator = 0;
  private _ids: number[] = [];
  private _indices: (number | null)[] = [];

  /**
   * The number of items stored in this map
   */
  get size() {
    return this._ids.length;
  }

  /**
   * The list of IDs inside this map. IDs are generated as increasing natural
   * numbers starting from zero. The position of the ID in the array is
   * the index of that entity in the geometric buffer.
   * For instance, the ids of a map with 5 items would look like this:
   *
   * - [0, 1, 2, 3, 4]
   *
   * If the item with ID = 1 is deleted, the last item will replace the deleted
   * one to keep the continuity of the geometric buffer, resulting in this:
   *
   * - [0, 4, 2, 3]
   */
  get ids() {
    return this._ids;
  }

  /**
   * The list of indices of the geometric buffer. The position of the index in
   * the array is the ID of that entity. For instance, the ids of a map with 5
   * items would look like this:
   *
   * - [0, 1, 2, 3, 4]
   *
   * If the item with ID = 1 is deleted, the last item will replace the
   * deleted one to keep the continuity of the geometric buffer. The deleted
   * item will remain as null inside the array:
   *
   * - [0, null, 2, 3, 1]
   */
  get indices() {
    return this._indices;
  }

  /**
   * Adds a new item to the map, creating and assigning a new ID and a new index
   * to it. New items are assumed to be created at the end of the geometric
   * buffer.
   */
  add() {
    this._ids.push(this._idGenerator++);
    const index = this._ids.length - 1;
    this._indices.push(index);
    return index;
  }

  /**
   * Removes the specified item from the map and rearrange the indices to
   * keep the continuity of the geometric buffer.
   */
  remove(id: number) {
    const index = this.getIndex(id);
    if (index === null || index === undefined) return;
    const lastID = this._ids.pop();
    if (lastID === undefined) {
      throw new Error(`Error while removing item: ${id}`);
    }
    this._indices[id] = null;
    if (id === lastID) return;
    this._ids[index] = lastID;
    this._indices[lastID] = index;
  }

  /**
   * Resets this instance to the initial state.
   */
  reset() {
    this._idGenerator = 0;
    this._ids = [];
    this._indices = [];
  }

  /**
   * Gets the ID for the given index.
   * @param index index of the entity whose ID to find out.
   */
  getId(index: number) {
    return this._ids[index];
  }

  /**
   * Gets the index for the given ID.
   * @param id ID of the entity whose index to find out.
   */
  getIndex(id: number) {
    return this._indices[id];
  }

  /**
   * Gets the last index of the geometry buffer.
   */
  getLastIndex() {
    return this.size - 1;
  }

  /**
   * Gets the last ID in the geometry buffer.
   */
  getLastID() {
    return this._ids[this._ids.length - 1];
  }
}
