
class GridItem {
	#rowStart
	#rowEnd
	#colStart
	#colEnd
	constructor(rowStart, rowEnd, colStart, colEnd) {
		if (![colStart, colEnd, rowStart, rowEnd].every(item=>Number.isFinite(item))) throw new Error("Grid area contains invalid data")
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

	clone(){
		return new GridItem(this.#rowStart, this.#rowEnd, this.#colStart, this.#colEnd)
	}

	getGridArea(){
		return {rowStart:this.#rowStart, rowEnd:this.#rowEnd, colStart:this.#colStart, colEnd:this.#colEnd}
	}

	setGridArea(rowStart, rowEnd, colStart, colEnd){
		if (![colStart, colEnd, rowStart, rowEnd].every(item=>Number.isFinite(item))) throw new Error("Grid area contains invalid data")
		this.#rowStart = rowStart
		this.#rowEnd = rowEnd
		this.#colStart = colStart
		this.#colEnd = colEnd
		return this
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

	isAdjacent(otherItem) {
		if (!(otherItem instanceof GridItem)) throw new Error("otherItem is not a GridItem");

		const a = this.getGridArea();
		const b = otherItem.getGridArea();

		const verticallyAligned = a.colStart < b.colEnd && a.colEnd > b.colStart;
		const horizontallyAligned = a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;

		// Above
		if (a.rowStart === b.rowEnd && verticallyAligned) return true;

		// Below
		if (a.rowEnd === b.rowStart && verticallyAligned) return true;

		// Left
		if (a.colStart === b.colEnd && horizontallyAligned) return true;

		// Right
		if (a.colEnd === b.colStart && horizontallyAligned) return true;

		return false;
	}

	isSubsetOf(otherItem){
		//Checks if this item is fully within the otherItem
		if (!(otherItem instanceof GridItem)) throw new Error("otherItem is not a GridItem");

		const a = this.getGridArea();
		const b = otherItem.getGridArea();

		// Check if `a` is fully inside `b`
		const rowsContained = a.rowStart >= b.rowStart && a.rowEnd <= b.rowEnd;
		const colsContained = a.colStart >= b.colStart && a.colEnd <= b.colEnd;

		return rowsContained && colsContained;
	}

	isEqual(otherItem){
		if (!(otherItem instanceof GridItem)) throw new Error("otherItem is not a GridItem");
		const area1 = this.getGridArea()
		const area2 = otherItem.getGridArea()
		return area1.rowStart === area2.rowStart && area1.rowEnd === area2.rowEnd && area1.colStart === area2.colStart && area1.colEnd === area2.colEnd
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

console.log('adjacency test')
console.log(new GridItem(1,2,1,2).isAdjacent(new GridItem(1,2,2,3)))
console.log('adjacency test, corner')
console.log(new GridItem(1,2,1,2).isAdjacent(new GridItem(2,3,2,3)))
console.log('adjacency test, subset/fully contained')
console.log(new GridItem(1,2,1,2).isAdjacent(new GridItem(1,2,1,2)))

console.log('subset test')
console.log(new GridItem(1,2,1,2).isSubsetOf(new GridItem(1,2,1,2)))
console.log(new GridItem(1,2,1,2).isSubsetOf(new GridItem(1,3,1,3)))
console.log(new GridItem(1,3,1,3).isSubsetOf(new GridItem(1,2,1,2)))

