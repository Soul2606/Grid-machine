/**
 * @typedef {Object} Item
 * @property {String} id
 * @property {String} name
 * @property {String[]} tags
 */
/**
 * @typedef {Object} Machine
 * @property {String} id
 * @property {String} name
 * @property {Number} tier
 * @property {Boolean} requiresConfiguration
 */
/**
 * @typedef {Object} Recipe
 * @property {String} id
 * @property {Array} inputs
 * @property {Array} outputs
 * @property {String} requiredProcess
 * @property {Number} requiredTier
 * @property {Number} processTimeSeconds
 */
/**
 * @typedef {Object} ItemEntry
 * @property {Item} item
 * @property {Number} quantity
 */


//Pure Classes
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
	constructor(element, machine){
		if (!(element instanceof HTMLElement)) throw new Error("element is not an HTMLElement");
		this.#element = element
		this.#stack = 1
		this.machine = machine
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




class Inventory {
	#itemEntries
	#contentChangeCallback
	
	// Cannot be changed after construction
	#max
	#itemsFilter
	#tagsFilter
	constructor(contentChangeCallback=()=>{}, max=Infinity, itemsFilter=[], tagsFilter=[]) {
		if (typeof max !== 'number') throw new Error("max must be a number");
		if (Number.isNaN(max)) throw new Error("max must be not not a number");
		if (max < 1) throw new Error("max must be a natural number");
		if (!Array.isArray(itemsFilter)) throw new Error("itemsFilter must be an Array");
		if (!Array.isArray(tagsFilter)) throw new Error("tagsFilter must be an Array");
		
		/**
		 * @type {ItemEntry[]}
		 */
		this.#itemEntries = []
		this.#contentChangeCallback = contentChangeCallback
		this.#max = Math.ceil(max)
		this.#itemsFilter = Array.from(itemsFilter)
		this.#tagsFilter = Array.from(tagsFilter)
	}

	getMax(){
		return this.#max
	}

	hasEntry(item){
		const entry = this.#getEntry(item)
		if (entry) {
			return entry.quantity > 0
		}
		return false
	}

	/**
	 * @param {Item} item 
	 * @returns {ItemEntry | null}
	 */
	#getEntry(item){
		return this.#itemEntries.find(entry=>entry.item === item)
	}

	/**
	 * @param {Item} item 
	 * @returns {Number}
	 */
	getQuantity(item){
		const inventoryEntry = this.#getEntry(item)
		if (inventoryEntry) {
			return inventoryEntry.quantity
		} else {
			return 0
		}
	}

	/**
	 * @returns {ItemEntry}
	 */
	getAllItemEntries(){
		return this.#itemEntries.map(entry=>{return{item:entry.item, quantity:entry.quantity}})
	}
	
	/**
	 * @param {Item} item 
	 * @param {Number} amount 
	 * @returns {Boolean} success?
	 */
	changeItem(item, amount){
		if (typeof amount !== 'number' || !isFinite(amount)) return false
		if (amount === 0) return false
		if (this.#itemsFilter.length > 0 && !this.#itemsFilter.includes(item)) return false
		if (this.#tagsFilter.length > 0 && !this.#tagsFilter.some(tag=>item.tags.includes(tag))) return false
		/**
		 * @type {ItemEntry}
		 */
		let inventoryEntry = this.#getEntry(item)
		if (!inventoryEntry) {
			inventoryEntry = {item, quantity:0}
			this.#itemEntries.push(inventoryEntry)
		}
		if (amount > 0 && inventoryEntry.quantity + amount > this.#max) return false
		if (amount < 0 && Math.abs(amount) > inventoryEntry.quantity) return false

		// Item successfully changed
		inventoryEntry.quantity += amount
		if (this.#contentChangeCallback) this.#contentChangeCallback(inventoryEntry.item, inventoryEntry.quantity)
		return true
	}

	/**
	 * @param {Item} item 
	 * @param {Number} amount 
	 * @returns {Boolean} success?
	 */
	addItem(item, amount){
		return this.changeItem(item, amount)
	}

	/**
	 * @param {Item} item 
	 * @param {Number} amount 
	 * @returns {Boolean} success?
	 */
	subtractItem(item, amount){
		return this.changeItem(item, -amount)
	}
}




// Work in progress !!!!--- DO NOT USE ---!!!!
class PhantomInventory extends Inventory {
	/**
	 * @typedef {Object} ChildInventory
	 * @property {Inventory} inventory
	 * @property {Number} priority
	 * @property {Boolean} subtract
	 * @property {Boolean} add
	 */
	#childInventories
	constructor(initialChildInventories) {
		if (!Array.isArray(initialChildInventories)) throw new Error("initialChildInventories is not an Array");
		/**
		 * @type {ChildInventory[]}
		 */
		this.#childInventories = Array.from(initialChildInventories)
	}

	/**
	 * @returns {ItemEntry[]}
	 */
	#partitionInventories(ChildInventories){
		/**
		 * @type {ItemEntry[]}
		 */
		const itemEntries = []
		for (const childInv of ChildInventories) {
			itemEntries.push(childInv.inventory.getAllItemEntries())
		}
		itemEntries.flat()
		return itemEntries
	}

	hasEntry(item){
		return Boolean(this.#getEntry(item))
	}

	/**
	 * @param {Object} item 
	 * @returns {ItemEntry}
	 */
	#getEntry(item){
		return this.#partitionInventories(this.#childInventories).find(entry=>entry.item === item)
	}

	/**
	 * @param {object} item 
	 * @returns {Number}
	 */
	getQuantity(item){
		const itemEntry = this.#partitionInventories(this.#childInventories).find(value=>value.item===item)
		if (itemEntry) {
			return itemEntry.quantity
		} else {
			return 0
		}
	}

	getAllItemEntries(){
		return this.#partitionInventories(this.#childInventories).map(entry=>{return{item:entry.item, quantity:entry.quantity}})
	}
	
	changeItem(item, amount){
		return amount > 0? this.addItem(item, amount): this.subtractItem(item, amount)
	}

	addItem(item, amount){
		const _amount = Math.abs(amount)
		for(const childInv of this.#childInventories.filter(childInv=>childInv.add).sort((a,b)=>a.priority-b.priority)){
			// If item change is successful: return
			if (childInv.inventory.addItem(item, _amount)) return true
		}
		return false
	}

	subtractItem(item, amount){
		const _amount = Math.abs(amount)
		for(const childInv of this.#childInventories.filter(childInv=>childInv.subtract).sort((a,b)=>a.priority-b.priority)){
			// If item change is successful: return
			if (childInv.inventory.addItem(item, _amount)) return true
		}
		return false
	}
}




//Pure Functions

/**
 * @param {Iterable} obj 
 * @param {Function} fnc calls fnc with {key, value, parent, path, set, delete, isLeaf}
 */
function walkJson(obj, fnc) {
	const recurse = (current, parent = null, key = null, path = []) => {
		// Provide a mutator
		const set = (newValue) => {
			if (parent !== null && key !== null) {
				parent[key] = newValue;
			}
		};
		const del = () => {
			if (parent !== null && key !== null) {
				if (Array.isArray(parent)) {
				parent.splice(key, 1);
				} else {
				delete parent[key];
				}
			}
		};

		// Call user function with rich context
		fnc({
			key,
			value: current,
			parent,
			path,
			set,
			delete: del,
			isLeaf: typeof current !== 'object' || current === null
		});

		// Recurse into children if object/array
		if (Array.isArray(current)) {
			current.forEach((val, idx) => recurse(val, current, idx, [...path, idx]));
		} else if (current && typeof current === 'object') {
			for (const k in current) {
				recurse(current[k], current, k, [...path, k]);
			}
		}
	};

	recurse(obj, null, null, []);
}



/**
 * @param {Machine} machine 
 * @returns {HTMLElement}
 */
function createMachine(machine) {
	const cell = document.createElement('div')
	cell.className = 'inventory-grid-cell'
	cell.textContent = machine.name
	return cell
}





//Global Variables
const GameStates = (()=>{

	const GameStateLog = []

	const initState = (initial)=>{
		let value = initial
		return {
			set:(string, optionalContext)=>{
				GameStateLog.push({
					timestamp: new Date().toISOString(),
					oldValue:value,
					newValue:string,
					context:optionalContext
				});
				value = string;
			},
			get: () => value
		}
	} // returns {set:(string, optionalContext)=>{...}, get:()=>{...}}

	//Game States structure
	return {
		ui:{
			sideMenuSection:initState('hidden')
		},
		mouse:{
			action:initState('none')
		}
	}
})();



/*This is a singleton for managing the elements that follow the mouse*/
const MouseOverlay = new class {
	#element
	constructor(){
		this.#element = document.getElementById('mouse-icon')
		this.elements = {}
		window.addEventListener('mousemove',e=>{
			if (this.#element.style.display === 'none') return
			this.#element.style.top = e.pageY + 'px'
			this.#element.style.left = e.pageX + 'px'
		})

		{// Info panel
		const root = document.createElement('div')
		root.className = 'mouse-info-panel'
		//root.style.display = 'none'
		this.#element.appendChild(root)
		const methods = {
			show:()=>{root.style.display = ''},
			hide:()=>{root.style.display = 'none'},
			setText:(text)=>{
				if (typeof text !== 'string') throw new Error("text is not a string");
				root.textContent = text
			}
		}
		Object.freeze(methods)
		this.elements.infoPanel = methods
		}

		Object.freeze(this.elements)
	}

	show(){
		this.#element.style.display = ''
	}

	hide(){
		this.#element.style.display = 'none'
	}
}



/*This variable i here so the machine line and other objects where machines can be placed know what machine and cell is involved
place should only be called when machine placements is canceled or successful, if it is canceled/failed items are automatically refunded*/
;const MachineBeingPlaced = (()=>{
	let _machine = null;
	let _itemRefund = [];
	let _placeCallback = null;
	let _inventory = null;// inventory to refund to
	function clear(){
		_machine = null;
		_itemRefund = [];
		_placeCallback = null;
		_inventory = null;
	};
	const properties = {
		/**
		 * @param {Machine} machine
		 * @param {ItemEntry[]} itemRefund
		 * @param {Function} placeCallback
		 * @param {Inventory} inventory
		 */
		set(machine, itemRefund, placeCallback, inventory){
			if (!(inventory instanceof Inventory)) throw new Error("inventory is not an Inventory");
			_machine = machine;
			_itemRefund = itemRefund;
			_placeCallback = placeCallback;
			_inventory = inventory;
			return properties;
		},
		/**
		 * @param {Boolean} success 
		 */
		place(success){
			const results = _placeCallback(success)
			if (properties.isEmpty()) return results
			if (!success) {
				// Refund
				_itemRefund.forEach(entry=>_inventory.addItem(entry.item, entry.quantity))
			}
			clear()
			return results
		},
		getState(){
			return {machine:_machine, itemRefund:_itemRefund.slice(), placeCallback:_placeCallback}
		},
		isEmpty(){
			return _machine === null || _itemRefund.length === 0 || _placeCallback === null
		}
	};
	return properties
})();



/* This variable is used to store the context for transferring items and functions to be called upon transfer.
I cant be asked to make a factory singleton this time... */
const ItemTransferContext = {
	itemEntry:null,
	transfer:null // function (success)=>{}
}



const itemQuantitySlider = (()=>{// Item quantity slider
	const root = document.getElementById('item-quantity-slider')
	
	const slider = document.getElementById('item-quantity-slider-slider')
	slider.type = 'range'

	let endCallbackFunction = ()=>{}
	let inputCallbackFunction = ()=>{}
	let sliderDisabled = true
	// Make it follow the mouse without pressing
	document.addEventListener('mousemove', e => {
		if (root.style.display === 'none') return
		const rect = slider.getBoundingClientRect();

		// Map mouse X position to slider range
		const percent = (e.clientX - rect.left) / rect.width;
		const clamped = Math.min(Math.max(percent, 0), 1);

		slider.value = Math.round(
			slider.min * 1 + (slider.max - slider.min) * clamped
		);
		inputCallbackFunction(Number(slider.value))
	});

	document.addEventListener('mouseup', ()=>{
		if (sliderDisabled) return
		sliderDisabled = true
		root.style.display = 'none'
		endCallbackFunction(Number(slider.value))
	})

	const setText = (text)=>{
		if (typeof text !== 'string') throw new Error("text is not a string");
		document.getElementById('item-quantity-slider-text').textContent = text
	}

	const methods = {
		show: (x, y, text, length=15) => {
			// position is relative to the window, not the page
			if (typeof length !== 'number' || Number.isNaN(length) || (!Number.isFinite(length))) throw new Error("length is not a valid number");
			slider.max = length
			setText(text)
			sliderDisabled = false
			root.style.display = '';
			// Position near mouse 
			root.style.left = `${x}px`;
			root.style.top = `${y}px`;

			// Prevent clipping off screen
			const rect = root.getBoundingClientRect();
			if (rect.right > window.innerWidth) {
				root.style.left = `${window.innerWidth - rect.width}px`;
			}
			if (rect.bottom > window.innerHeight) {
				root.style.top = `${window.innerHeight - rect.height}px`;
			}
		},
		setEndCallback:(func)=>{
			if (typeof func !== 'function') throw new Error("func is not a function");
			endCallbackFunction = func
		},
		setInputCallback:(func)=>{
			if (typeof func !== 'function') throw new Error("func is not a function");
			inputCallbackFunction = func
		},
		setText
	}
	Object.freeze(methods)
	return methods
})();



/* Used to decide what is shown in the machines tab */
const machinesUnlocked = new Set(['stone_furnace'])






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
		if (Object.keys(obj).some(key=>!keys.includes(key))) throw new Error(`${obj.id} has invalid keys, object can only have these keys:${keys}`);	
	}

	const includeKeys = (obj,keys)=>{
		if (keys.some(key=>!Object.keys(obj).includes(key))) throw new Error(`${obj.id} has invalid keys, object must include these keys:${keys}`);	
	}

	items.forEach(item => {
		includeKeys(item,['id', 'name', 'tags'])
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
	/**
	 * @type {Item[]}
	 */
	const items = response.items

	/**
	 * @type {Machine[]}
	 */
	const machines = response.machines

	/**
	 * @type {Recipe[]}
	 */
	const recipes  = response.recipes

	const extraction  = response.extraction
	{ // Freeze all
		const freeze = ({value:obj})=>{if (typeof obj === 'object') Object.freeze(obj)}
		walkJson(items, freeze)
		walkJson(machines, freeze)
		walkJson(recipes, freeze)
		walkJson(extraction, freeze)
	}
	



	// Data utility functions
	/**
	 * Get all recipes that crafts the provided item
	 * @param {Item} craftable 
	 * @returns {Recipe[]}
	 */
	function getRecipesProducing(craftable) {
		return recipes.filter(recipe=>{
			return recipe.outputs.some(output=>output.id === craftable.id)
		})
	}

	/**
	 * Returns every input with each item that is valid for that input of the recipe. think of it like this (item||item...)&&(item||item...)...
	 * @param {Recipe} recipe 
	 * @returns {Array<Array<Item>>}
	 */
	function getRecipeInputs(recipe) {
		return recipe.inputs.map(input=>{
			const inputItems = new Set()
			items.filter(item=>item.id === input.id).forEach(v=>inputItems.add(v))
			items.filter(item=>item.tags.includes(input.tag)).forEach(v=>inputItems.add(v))
			return {items:Array.from(inputItems), quantity:input.quantity}
		})
	}

	/**
	 * This function is for ease of use
	 * @param {String} id 
	 * @returns {Item|undefined}
	 */
	function getItemFromId(id) {
		return items.find(item=>item.id === id)
	}

	/**
	 * This function is for ease of use
	 * @param {String} tag 
	 * @returns {Item[]}
	 */
	function getItemsFromTag(tag) {
		return items.filter(item=>item.tags.includes(tag))
	}
	
	function getAffordableRecipes(craftable, inventory) {
		if (!(inventory instanceof Inventory)) throw new Error("inventory is not an Inventory");
		const allEntries = inventory.getAllItemEntries()
		const recipes = getRecipesProducing(craftable)
		if (recipes.length === 0) return []

		return recipes.filter(recipe=>{
			return recipe.inputs.every(input => {
				let ingredientItems = []
				if (input.tag) ingredientItems = getItemsFromTag(input.tag)
				if (input.id) ingredientItems.push(getItemFromId(input.id))
				if (ingredientItems.length === 0) throw new Error(`recipe:${recipe.id} has unknown inputs, could not find items for input: ${JSON.stringify(input)}`);
				return ingredientItems.some(item=>{
					const matchingEntries = allEntries.filter(itemEntry=>itemEntry.item===item)
					return matchingEntries.some(matchingEntry=>matchingEntry.quantity >= input.quantity)
				})
			})
		})
	}

	/**
	 * Checks whether at least one valid item for each input in the recipe is affordable from the inventory.
	 * 
	 * ⚠️ This function has significant limitations:
	 * - It does not expose which items were considered or chosen.
	 * - It selects only the first viable item per input, ignoring other valid combinations.
	 * - There is no support for customization, prioritization, or insight into decision logic.
	 * 
	 * This function may be deprecated in the future in favor of a more flexible and transparent alternative.
	 * 
	 * @param {Recipe} recipe 
	 * @param {Inventory} inventory 
	 * @returns {Boolean}
	 */
	function isCraftable(recipe, inventory) {
		if (!(inventory instanceof Inventory)) throw new Error("inventory is not an Inventory");
		const allEntries = inventory.getAllItemEntries()
		return recipe.inputs.every(input => {
			let ingredientItems = []
			if (input.tag) ingredientItems = getItemsFromTag(input.tag)
			if (input.id) ingredientItems.push(getItemFromId(input.id))
			if (ingredientItems.length === 0) throw new Error(`recipe:${recipe.id} has unknown inputs, could not find items for input: ${JSON.stringify(input)}`);
			return ingredientItems.some(item=>{
				const matchingEntries = allEntries.filter(itemEntry=>itemEntry.item===item)
				return matchingEntries.some(matchingEntry=>matchingEntry.quantity >= input.quantity)
			})
		})
	}


	const inventoryCellElements = []
	for(const item of items){
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = item.name
		cell.style.display = 'none'

		const number = document.createElement('p')
		number.textContent = 0
		cell.appendChild(number)

		cell.addEventListener('mousedown', e => {
			console.log('mousedown')
			if (ItemTransferContext.itemEntry !== null) return
			const quantities = [
				1,
				5,
				10,
				20,
				30,
				40,
				50,
				100,
				200,
				300,
				400,
				500,
				600,
				700,
				800,
				900,
				1000,
				2000,
				3000,
				4000,
				5000,
				6000,
				7000,
				8000,
				9000,
				10000,
				20000,
				30000,
				40000,
				50000,
				60000,
				70000,
				80000,
				90000,
				100000,
				200000,
				300000,
				400000,
				500000,
				1000000
			];
			const current = inventory.getQuantity(item)
			if (current < 1) return
			const map = quantities.filter(val=>val<current)
			map.push(current)
			const length = map.length
			itemQuantitySlider.show(e.pageX, e.pageY, `${map[0]}/${current}`, length)
			itemQuantitySlider.setInputCallback(step=>itemQuantitySlider.setText(`${map[step-1]}/${current}`))
			itemQuantitySlider.setEndCallback(step=>{
				const value = map[step-1]
				if (!inventory.subtractItem(item, value)) return // Try to subtract items, if fail end early
				ItemTransferContext.itemEntry = {item, quantity:value}
				ItemTransferContext.transfer = (success)=>{
					if (success) return // If item was successfully transferred: do nothing, otherwise refund the lost items.  
					inventory.addItem(item, value)
				}
			})
		})

		document.getElementById('inventory-grid').appendChild(cell)
		inventoryCellElements.push({element:cell, quantityLabel:number, itemPointer:item})
	}



	const inventory = new Inventory((item, quantity)=>{
		for(const cellElement of inventoryCellElements){
			if (cellElement.itemPointer !== item) continue
			cellElement.quantityLabel.textContent = quantity // Yes this is correct
			if (GameStates.ui.sideMenuSection.get() === 'recipes') continue
			cellElement.element.style.display = ''
		}
	})



	const machineCellElements = []
	for(const machine of machines){
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = machine.name
		cell.style.display = 'none'
		document.getElementById('machines-grid').appendChild(cell)

		cell.addEventListener('mouseenter', ()=>{
			MouseOverlay.show()
			MouseOverlay.elements.infoPanel.show()

			const recipe = getRecipesProducing(machine)[0]

			const text = recipe.inputs.map(input=>{
				let item = items.find(item=>item.id === input.id)
				if (!item) item = items.find(item=>item.tags.includes(input.tag))
				if (item) {
					return `${item.name}: ${input.quantity}, `
				} else {
					return 'unknown'
				}
			}).join(', ')

			MouseOverlay.elements.infoPanel.setText(`Ingredients:${text}`)
		})
		
		cell.addEventListener('mouseleave', ()=>{
			MouseOverlay.elements.infoPanel.hide()
			MouseOverlay.elements.infoPanel.setText('')
		})

		cell.addEventListener('click',()=>{
			if (!MachineBeingPlaced.isEmpty()) {
				MachineBeingPlaced.place(false)
				return
			}
			const recipe = getRecipesProducing(machine)[0]
			if (!recipe) throw new Error(`The machine: ${machine.id} is not craftable`);
			if (!isCraftable(recipe, inventory)) return
			const inputs = getRecipeInputs(recipe)
			/**
			 * @type {ItemEntry}
			 */
			const itemsUsed = inputs.map(input=>{
				const chosen = input.items.find(item=>inventory.getQuantity(item) >= input.quantity)
				if (!chosen) throw new Error(`could not afford any of the items from: ${JSON.stringify(input.items)}`);
				inventory.subtractItem(chosen, input.quantity)
				return {item:chosen, quantity:input.quantity}
			})
			MachineBeingPlaced.set(machine, itemsUsed, (success)=>{cell.style.backgroundColor = ''}, inventory)
			cell.style.backgroundColor = 'green'
		})

		machineCellElements.push({element:cell, machinePointer:machine})
		}



	{ // Side Menu Header Buttons functionality
	const showGrid = (showInventory, showMachines) => {
		document.getElementById('inventory-grid').style.display = showInventory ? '' : 'none';
		document.getElementById('machines-grid').style.display = showMachines ? '' : 'none';
	};
	
	const repairCells = () => {
		for (const inventoryCell of inventoryCellElements) {
			const entry = inventory.getAllItemEntries().find(e => e.item === inventoryCell.itemPointer);
			inventoryCell.element.style.display = entry && entry.quantity > 0 ? '' : 'none';
			inventoryCell.quantityLabel.style.display = ''
		}
		for (const machineCell of machineCellElements) {
			machineCell.element.style.display = machinesUnlocked.has(machineCell.machinePointer.id) ? '' : 'none';
		}
	};
	
	document.getElementById('side-menu-recipes-button')
	.addEventListener('click', () => {
		GameStates.ui.sideMenuSection.set('recipes', 'side-menu-recipes-button clicked')
		showGrid(true, true);
		for (const inventoryCell of inventoryCellElements) {
			inventoryCell.element.style.display = '' 
			inventoryCell.quantityLabel.style.display = 'none'
		}
		for (const machineCell of machineCellElements) {
			machineCell.element.style.display = ''
		}
	});
	
	document.getElementById('side-menu-inventory-button')
	.addEventListener('click', () => {
		GameStates.ui.sideMenuSection.set('inventory', 'side-menu-inventory-button clicked')
		showGrid(true, false);
		repairCells();
	});
	
	document.getElementById('side-menu-machines-button')
	.addEventListener('click', () => {
		GameStates.ui.sideMenuSection.set('machines', 'side-menu-machines-button clicked')
		showGrid(false, true);
		repairCells();
	});
	}



	document.getElementById('extract-starter').addEventListener('click',()=>{
		
		const starterMine = extraction.find(item=>item.id==='starter')
		const totalWeight = starterMine.yields.map(val=>val.weight).reduce((prev,val)=>prev+val,0)
		for (let i = 0; i < starterMine.manualPower; i++) {
			const randomNumber = Math.floor(Math.random()*totalWeight)
			let resultId
			let cumulative = 0
			for (const value of starterMine.yields) {
				cumulative += value.weight
				if (randomNumber < cumulative) {
					resultId = value.itemId
					break
				}
			}
			inventory.changeItem(getItemFromId(resultId), 1)
		}
	})



	document.getElementById('machine-line-cell-button').addEventListener('click',()=>{
		if (MachineBeingPlaced.isEmpty())return
		
		const machineCell = createMachine(MachineBeingPlaced.getState().machine)
		const machine = new Machine(machineCell, MachineBeingPlaced.getState().machine)
		const stack = document.createElement('p')
		stack.textContent = 1
		machineCell.appendChild(stack)
		machineCell.addEventListener('click',()=>{
			if (MachineBeingPlaced.isEmpty())return
			machine.setStack(machine.getStack() + 1)
			stack.textContent = machine.getStack()
			MachineBeingPlaced.place(true)
		})
		document.getElementById('machine-line').appendChild(machineCell)
		
		MachineBeingPlaced.place(true)
	})

}



