
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
		const gridArea = this.#parseGridArea(element);
		if (!gridArea) throw new Error("Element has an invalid grid area");
		return new GridItem(gridArea.rowStart, gridArea.rowEnd, gridArea.colStart, gridArea.colEnd);
	}

	static #parseGridArea(element) {
		const area = getComputedStyle(element).getPropertyValue('grid-area').trim().split('/');
		if (area.length !== 4) return null
		if (area.includes('auto')) return null
		// Example area = "1 / 2 / 4 / 5"
		const [rowStart, colStart, rowEnd, colEnd] = area.map(s => parseInt(s, 10) || 0);
		return { rowStart, rowEnd, colStart, colEnd };
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
	
	//JS GridItem class
	isEdge(){
		return this.#rowStart === this.#rowEnd || this.#colStart === this.#colEnd
	}

	isPoint(){
		return this.#rowStart === this.#rowEnd && this.#colStart === this.#colEnd 
	}

	getEdgeTop(){
		return new GridItem(this.#rowStart, this.#rowStart, this.#colStart, this.#colEnd)
	}

	getEdgeRight() {
		return new GridItem(this.#rowStart, this.#rowEnd, this.#colEnd, this.#colEnd);
	}

	getEdgeBottom() {
		return new GridItem(this.#rowEnd, this.#rowEnd, this.#colStart, this.#colEnd);
	}

	getEdgeLeft() {
		return new GridItem(this.#rowStart, this.#rowEnd, this.#colStart, this.#colStart);
	}


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








class Machine {
	#element
	#stack
	constructor(element, id){
		if (!(element instanceof HTMLElement)) throw new Error("element is not an HTMLElement");
		this.#element = element
		this.#stack = 1
		this.id = id
	}

	static createMachine(width, height, centerElement){
		const root = document.createElement('div')
		root.className = 'machine'
		root.style.gridRow = `span ${height}`
		root.style.gridColumn = `span ${width}`
		const repeatString = (n, str)=>{
			let string = ''
			for(let i=0; i<n; i++){
				string += str
			}
			return string
		}
		root.style.gridTemplateRows = `auto ${repeatString(height, '1fr ')}auto`
		root.style.gridTemplateColumns = `auto ${repeatString(width, '1fr ')}auto`
		
		const center = document.createElement('div')
		center.style.gridArea = `${2}/${2}/${2+height}/${2+width}`
		if (centerElement) center.appendChild(centerElement)
		root.appendChild(center)

		//left
		for (let i = 0; i < height; i++) {	
			const edge = document.createElement('button')
			edge.style.gridColumn = `${1}/${2}`
			edge.style.gridRow = `${2+i}/${3+i}`
			edge.style.width = '15px'
			root.appendChild(edge)
		}
		
		//right
		for (let i = 0; i < height; i++) {	
			const edge = document.createElement('button')
			edge.style.gridColumn = `${width+2}/${width+3}`
			edge.style.gridRow = `${2+i}/${3+i}`
			edge.style.width = '15px'
			root.appendChild(edge)
		}

		//top
		for (let i = 0; i < width; i++) {	
			const edge = document.createElement('button')
			edge.style.gridColumn = `${2+i}/${3+i}`
			edge.style.gridRow = `${1}/${2}`
			edge.style.height = '15px'
			root.appendChild(edge)
		}

		//bottom
		for (let i = 0; i < width; i++) {	
			const edge = document.createElement('button')
			edge.style.gridColumn = `${2+i}/${3+i}`
			edge.style.gridRow = `${height+2}/${height+3}`
			edge.style.height = '15px'
			root.appendChild(edge)
		}

		return root
	}

	setStack(value){
		if (!Number.isInteger(value)) throw new Error("value is not an integer");
		this.#stack = value
		return this
	}

	getStack(){
		//Stack is primitive
		return this.#stack
	}
}

const element = document.createElement('div')
element.style.backgroundColor = 'white'
element.style.width = '100%'
element.style.height = '100%'
document.getElementById('grid').appendChild(Machine.createMachine(3,3,element))




