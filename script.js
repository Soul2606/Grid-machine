
class GridItem {
	#element
	constructor(element) {
		if (!(element instanceof HTMLElement)) throw new Error("invalid element");
		if (this.#parseGridArea(element) === null) throw new Error("element has an invalid grid area");
		this.#element = element
	}

	getElement(){
		return this.#element
	}

	getGridArea() {
		return this.#parseGridArea(this.#element)
	}

	isOverlapping(...otherItem) {
		if (otherItem.some(item => !(item instanceof GridItem))) throw new Error("Array contains non GridItem");

		const array = otherItem
		const a = this.getGridArea();

		return array.some(item=>{
			const b = item.getGridArea();

			const colsOverlap = a.colStart < b.colEnd && a.colEnd > b.colStart;
			const rowsOverlap = a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;

			return colsOverlap && rowsOverlap;
		})
	}

	#parseGridArea(element) {
		const area = getComputedStyle(element).getPropertyValue('grid-area').trim().split('/');
		if (area.length !== 4) return null
		if (area.includes('auto')) return null
		// Example area = "1 / 2 / 4 / 5"
		const [rowStart, colStart, rowEnd, colEnd] = area
			.map(s => parseInt(s, 10) || 0);
		return { rowStart, rowEnd, colStart, colEnd };
	}

	getSurroundingItems(otherItems){
		if (!Array.isArray(otherItems)) throw new Error("otherItems is not an array");
		if (otherItems.some(item => !(item instanceof GridItem))) throw new Error("Array contains non GridItem");
		const { rowStart, rowEnd, colStart, colEnd } = parseGridArea(this.#element)

		return otherItems.filter(item=>{
			const area = item.getGridArea()

			// Above
			if (isOverlapping({ rowStart: rowStart - 1, rowEnd: rowStart, colStart, colEnd }, area)) return true;

			// Below
			if (isOverlapping({ rowStart: rowEnd, rowEnd: rowEnd + 1, colStart, colEnd }, area)) return true;

			// Left
			if (isOverlapping({ rowStart, rowEnd, colStart: colStart - 1, colEnd: colStart }, area)) return true;

			// Right
			if (isOverlapping({ rowStart, rowEnd, colStart: colEnd, colEnd: colEnd + 1 }, area)) return true;

			return false;
		})
	}
}




function parseGridArea(element) {
	const area = getComputedStyle(element).getPropertyValue('grid-area').trim().split('/');
	if (area.length !== 4) return null
	if (area.includes('auto')) return null
	// Example area = "1 / 2 / 4 / 5"
	const [rowStart, colStart, rowEnd, colEnd] = area
		.map(s => parseInt(s, 10) || 0);
	return { rowStart, rowEnd, colStart, colEnd };
}




function isOverlapping(area1, area2) {
	const a = area1
	const b = area2

	if (!('rowStart' in a && 'rowEnd' in a && 'colStart' in a && 'colEnd' in a)) throw new Error("Error");
	if (!('rowStart' in b && 'rowEnd' in b && 'colStart' in b && 'colEnd' in b)) throw new Error("Error");

	const colsOverlap = a.colStart < b.colEnd && a.colEnd > b.colStart;
	const rowsOverlap = a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;

	return colsOverlap && rowsOverlap;
		
}




const gridCells = Array.from(document.getElementsByClassName('grid-cell')).map(item => new GridItem(item))
console.log(gridCells)
gridCells[0].getSurroundingItems([gridCells[1], gridCells[2], gridCells[3]])

