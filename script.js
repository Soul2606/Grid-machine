
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





document.getElementById('side-menu-width-button').addEventListener('mousedown',e=>{
	const minWidth = 300//px
	const originalMouseX = e.clientX
	const originalInventoryWidth = Number(document.getElementById('side-menu').getBoundingClientRect().width)
	const up = ()=>{
		window.removeEventListener('mouseup',up)
		window.removeEventListener('mousemove',move)
	}
	const move = e=>{
		e.clientX
		const newWidth = Math.max(originalInventoryWidth + e.clientX - originalMouseX, minWidth)
		document.getElementById('side-menu-container').style.width = newWidth + 20 + 'px'
		document.getElementById('side-menu').style.width = newWidth + 'px'
	}
	window.addEventListener('mousemove',move);
	window.addEventListener('mouseup',up)
});




document.getElementById('side-menu-inventory-button').addEventListener('click',()=>{
	document.getElementById('inventory-grid').style.display = ''
	document.getElementById('machines-grid').style.display = 'none'
});

document.getElementById('side-menu-machines-button').addEventListener('click',()=>{
	document.getElementById('inventory-grid').style.display = 'none'
	document.getElementById('machines-grid').style.display = ''
});




const MouseIcon = new class {
	#element
	constructor(){
		this.#element = document.getElementById('mouse-icon')
		window.addEventListener('mousemove',e=>{
			if (this.#element.style.display === 'none') return
			this.#element.style.top = e.pageY + 'px'
			this.#element.style.left = e.pageX + 'px'
		})
	}

	show(){
		this.#element.style.display = ''
	}

	hide(){
		this.#element.style.display = 'none'
	}

	setText(text){
		this.#element.textContent = text
	}
}




;(async () => {
async function fetchJSON(url) {
	return fetch(url).then(response=>{
		if (!response.ok) {
			throw new Error("Network response was not ok" + response.statusText);
			
		}
		return response.json()
	})
}
function compile(items, machines, recipes, extraction) {

	const limitKeysTo = (obj,keys)=>{
		if (Object.keys(obj).some(key=>!keys.includes(key))) throw new Error(`${obj} has invalid keys, valid keys:${keys}`);	
	}

	items.forEach(item => {
		limitKeysTo(item,['id', 'name', 'tags'])
	})
	machines.forEach(item => {
		limitKeysTo(item,['id', 'name', 'capabilities', 'tier', 'requiresConfiguration'])
	})
	recipes.forEach(item => {
		limitKeysTo(item,['id', 'inputs', 'outputs', 'requiredProcess', 'requiredTier', 'processTimeSeconds'])
	})
	
	const checkType = (obj,type)=>{
		if (type === 'array'){
			if (!Array.isArray(obj)) throw new Error(`${obj} is not of an array`);
		}
		else if (typeof obj !== type) throw new Error(`${obj} is not of type ${type}`);
	}

	for (const item of items) {
		checkType(item.id,'string')
		checkType(item.name,'string')
		checkType(item.tags,'array')
		item.tags.forEach(tag=>checkType(tag,'string'))
	}
	
	for (const machine of machines) {
		checkType(machine.id,'string')
		checkType(machine.name,'string')
		checkType(machine.tier,'number')
		checkType(machine.requiresConfiguration,'boolean')
		checkType(machine.capabilities,'array')
		machine.capabilities.forEach(item=>checkType(item,'string'))
	}

	for (const recipe of recipes) {
		checkType(recipe.id,'string')
		checkType(recipe.requiredProcess,'string')
		checkType(recipe.requiredTier,'number')
		checkType(recipe.processTimeSeconds,'number')
		checkType(recipe.inputs,'array')
		recipe.inputs.forEach(input=>{
			limitKeysTo(input,['id','tag','quantity'])
			if (input.id) checkType(input.id,'string')
			if (input.tag) checkType(input.tag,'string')
			checkType(input.quantity,'number')
		})
		checkType(recipe.outputs,'array')
		recipe.outputs.forEach(output=>{
			limitKeysTo(output,['id','tag','quantity'])
			if (output.id) checkType(output.id,'string')
			if (output.tag) checkType(output.tag,'string')
			checkType(output.quantity,'number')
		})
	}
	

	const hasDuplicateIds = (array)=>{
		const previousIds = new Set()
		const duplicates = new Set()
		for (const item of array) {
			if (previousIds.has(item.id)) duplicates.add(item.id)
			previousIds.add(item.id)
		}
		return duplicates.size===0? false : duplicates
	}
	{
		const result = hasDuplicateIds(items.concat(machines))
		if(result) throw new Error(`Machines and Items has duplicate IDs, ${result}`)
	}
	{
		const result = hasDuplicateIds(recipes)
		if (result) throw new Error(`Recipes has duplicate IDs, ${result}`);
	}

	/*Some machines do not need to have their recipe set. All recipes used by those machines must me check to make sure they don't conflict.
	Recipes conflict if they take the same ingredient and produce different things: (a,b,c)→(a) and (a,b,c)→(b). They also conflict if one is a subset of another: (a)→(c) and (a,b)→(d).
	The outputs do not matter, only the input, even if they produce the exact same thing as long as the input conflict the entire recipe conflict. Conflict: (a)→(b) and (a)→(b). Don't conflict: (a)→(b) and (b)→(b).*/
	//Check if setA is a subset of setB
	const isSubset = (setA, setB) => [...setA].every(x => setB.has(x));

	for (const machine of machines) {
		if (machine.requiresConfiguration) continue
		const relevantRecipes = recipes.filter(recipe=>machine.capabilities.includes(recipe.requiredProcess) && recipe.requiredTier <= machine.tier)
		const inputIdsSets = relevantRecipes.map(recipe=>new Set(recipe.inputs.map(input=>input.itemId)))
		for (let i = 0; i < inputIdsSets.length; i++) {
			for (let j = i + 1; j < inputIdsSets.length; j++) {
				const setA = inputIdsSets[i];
				const setB = inputIdsSets[j];
				if (i === j) continue
				if (isSubset(setB, setA) || isSubset(setA, setB)) {
					throw new Error(`Conflicting recipes detected for machine ${machine.name}. Recipe ${relevantRecipes[i].id} and ${relevantRecipes[j].id} have subset/superset inputs`);
				}
			}
		}
	}

	return {items, machines, recipes, extraction}
}
const items = await fetchJSON('items.json')
const machines = await fetchJSON('machines.json')
const recipes = await fetchJSON('recipes.json')
const extraction = await fetchJSON('extraction.json')
return compile(items, machines, recipes, extraction)
})().then(main)


function main(response) {
	const items = response.items
	const machines = response.machines
	const recipes  = response.recipes
	const extraction  = response.extraction

	const inventory = items.map(item=>{return{id:item.id,quantity:0}})
	for(const inventoryItem of inventory){
		const item = items.find(item=>item.id === inventoryItem.id)
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = item.name + '\n' + inventoryItem.quantity
		cell.style.display = 'none'
		document.getElementById('inventory-grid').appendChild(cell)
	}

	for(const machine of machines){
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = machine.name
		cell.style.display = 'none'
		document.getElementById('machines-grid').appendChild(cell)
	}

	document.getElementById('extract-starter').addEventListener('click',()=>{
		
		const starterMine = extraction.find(item=>item.id==='starter')
		const totalWeight = starterMine.yields.map(val=>val.weight).reduce((prev,val)=>prev+val,0)
		for (let i = 0; i < starterMine.manualPower; i++) {
			const randomNumber = Math.floor(Math.random()*totalWeight)
			let result
			let cumulative = 0
			for (const value of starterMine.yields) {
				cumulative += value.weight
				if (randomNumber < cumulative) {
					result = value.itemId
					break
				}
			}
			inventory.find(item=>item.id === result).quantity += 1
		}
		console.log(inventory)
	})

}



