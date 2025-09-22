
class GridItem {
	#rowStart
	#rowEnd
	#colStart
	#colEnd
	constructor(rowStart, rowEnd, colStart, colEnd) {
		if (![colStart, colEnd, rowStart, rowEnd].every(item=>Number.isFinite(item))) throw new Error("Grid data contains invalid data")
		this.#rowStart = rowStart
		this.#rowEnd = rowEnd
		this.#colStart = colStart
		this.#colEnd = colEnd
	}

	static fromElement(element) {
		if (!(element instanceof HTMLElement)) {
			throw new Error("Argument is not an HTMLElement");
		}
		const gridArea = parseGridArea(element);
		if (!gridArea) throw new Error("Element has an invalid grid area");
		return new GridItem(gridArea.rowStart, gridArea.rowEnd, gridArea.colStart, gridArea.colEnd);
	}

	getGridArea(){
		return {rowStart:this.#rowStart, rowEnd:this.#rowEnd, colStart:this.#colStart, colEnd:this.#colEnd}
	}

	applyGrid(element) {
		if (!(element instanceof HTMLElement)) throw new Error("element is not an HTMLElement");
		element.style.gridRowStart = this.#rowStart
		element.style.gridRowEnd = this.#rowEnd
		element.style.gridColumnStart = this.#colStart
		element.style.gridColumnEnd = this.#colEnd
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

	getSurroundingItems(otherItems){
		if (!Array.isArray(otherItems)) throw new Error("otherItems is not an array");
		if (otherItems.some(item => !(item instanceof GridItem))) throw new Error("Array contains non GridItem");
		const { rowStart, rowEnd, colStart, colEnd } = this.getGridArea()

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

	if (![a.rowStart, a.rowEnd, a.colStart, a.colEnd].every(Number.isFinite)) throw new Error("Area1 contains invalid values");
	if (![b.rowStart, b.rowEnd, b.colStart, b.colEnd].every(Number.isFinite)) throw new Error("Area2 contains invalid values");

	const colsOverlap = a.colStart < b.colEnd && a.colEnd > b.colStart;
	const rowsOverlap = a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;

	return colsOverlap && rowsOverlap;
		
}




const gridCells = Array.from(document.getElementsByClassName('grid-cell')).map(item => GridItem.fromElement(item))


console.log(new GridItem(1,2,1,2).getGridArea())
console.log(new GridItem(1,2,1,2).isOverlapping(new GridItem(1,3,1,3)))
console.log(new GridItem(1,2,1,3).isOverlapping(new GridItem(2,3,3,4)))
