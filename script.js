
class GridItem {
	#element
	constructor(element) {
		if (!(element instanceof HTMLElement)) throw new Error("invalid element");
		this.#element = element
	}

	getElement(){
		return this.#element
	}

	getGridArea() {
		return this.#parseGridArea(this.#element)
	}

	isOverlapping(...otherItem) {
		console.log(otherItem)
		if (!(otherItem instanceof GridItem || Array.isArray(otherItem))) throw new Error("Argument must be a GridItem or an Array");
		if (Array.isArray(otherItem) && otherItem.some(item => !(item instanceof GridItem))) throw new Error("Array contains non GridItem");

		const array = Array.isArray(otherItem)? otherItem: [otherItem];
		const a = this.getGridArea();

		return array.some(item=>{
			const b = item.getGridArea();

			const colsOverlap = a.colStart < b.colEnd && a.colEnd > b.colStart;
			const rowsOverlap = a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;

			return colsOverlap && rowsOverlap;
		})
	}

	#parseGridArea(element) {
		const area = getComputedStyle(element).getPropertyValue('grid-area').trim();
		// Example area = "1 / 2 / 4 / 5"
		const [rowStart, colStart, rowEnd, colEnd] = area
			.split('/')
			.map(s => parseInt(s, 10) || 0);
		return { rowStart, rowEnd, colStart, colEnd };
	}
}


const gridCells = Array.from(document.getElementsByClassName('grid-cell')).map(item => new GridItem(item))
gridCells[0].isOverlapping([gridCells[1], gridCells[2], gridCells[3]])

