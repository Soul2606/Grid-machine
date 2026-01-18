
import type { Item, Machine, Recipe, Extractor } from './types.js'
import { clamp, energyToNumber, getItemFromId, getRecipeInputs, getRecipeOutputs, getRecipesProducing, maxCraftableCount, relu, resolveCraftingCosts, walkJson } from './functions.js'
import { Inventory, ItemInstance } from './classes.js'

type InfoPanelMethods = {
	show: () => void
	hide: () => void
	setText: (text: string) => void
}

type HeldItemIconMethods = {
	show: () => void
	hide: () => void
	setText: (text: string) => void
	setImage: (src: string) => void
}

type MouseOverlayElements = {
	infoPanel: InfoPanelMethods
	heldItemIcon: HeldItemIconMethods
}




let dataIsCompiled = false


// Impure global functions

/**
 * Return weather a object is an item
 */
//Not a pure function. This function is mutated in the compile function 
export function isItem(value:any) {
	if (!items) throw new Error("Do not use isItem before item has been declared");
	return items.includes(value)
}



function createMachine(machine: Machine): {element:HTMLElement, setStack:Function, setProgress:Function, setWarning:Function} {
	const cell = document.createElement('div')
	cell.className = 'inventory-grid-cell machine'
	cell.textContent = machine.name

	const stack = document.createElement('p')
	stack.textContent = String(1)
	
	const setStack = (text:string)=>{
		stack.textContent = text
	}
	
	cell.appendChild(stack)

	const progressBar = document.createElement('div')
	progressBar.className = 'progress-bar'
	cell.appendChild(progressBar)

	const progressBarFill = document.createElement('div')
	progressBarFill.className = 'progress-bar-fill'

	const setProgress = (n: number)=>{
		progressBarFill.style.width = clamp(n, 0, 100) + '%'
		if (n>100) {
			progressBarFill.classList.add('rainbow')
		} else {
			progressBarFill.classList.remove('rainbow')
		}
	}

	progressBar.appendChild(progressBarFill)

	const warning = document.createElement('div')
	warning.className = 'warning-icon'
	const noFuel = document.createElement('img')
	noFuel.src = 'img/Fuel-icon-red.png'
	noFuel.style.display = 'none'
	warning.appendChild(noFuel)
	const setWarning = (string: string)=>{
		switch (string) {
			case 'no_fuel':
				noFuel.style.display = ''
			break;
			default:
				noFuel.style.display = 'none'
			break;
		}
	}
	cell.appendChild(warning)

	return {element:cell, setStack, setProgress, setWarning}
}



//Global Variables

/* These will be assigned after compilation. Should be validated outside the main function*/

var items: readonly Item[]

var machines: readonly Machine[]

var recipes: readonly Recipe[]

var extraction: Extractor[]



const GameStates = (()=>{

	const GameStateLog = []

	const initState = (initial:string)=>{
		let value = initial
		return {
			set:(string:string, optionalContext:string)=>{
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



// Main global inventory
const mainInventory = new Inventory()



/*This is a singleton for managing the elements that follow the mouse*/
const MouseOverlay = new class {
	#element
	elements: MouseOverlayElements
	constructor(){
		this.#element = document.getElementById('mouse-icon')!
		const elements = {} as MouseOverlayElements
		window.addEventListener('mousemove',e=>{
			if (this.#element.style.display === 'none') return
			this.#element.style.top = e.pageY + 'px'
			this.#element.style.left = e.pageX + 'px'
		})

		{// Info panel
			const root = document.createElement('div')
			root.className = 'mouse-info-panel'
			root.style.display = 'none'
			this.#element.appendChild(root)
			const methods = {
				show:()=>{root.style.display = ''},
				hide:()=>{root.style.display = 'none'},
				setText:(text:string)=>{
					root.textContent = text
				}
			} as const
			elements.infoPanel = methods
		}

		{// Held item icon
			const root = document.createElement('div')
			root.className = 'held-item-icon'
			root.style.display = 'none'

			const p = document.createElement('p')
			root.appendChild(p)

			const img = document.createElement('img')
			root.appendChild(img)

			this.#element.appendChild(root)
			const methods = {
				show:()=>{root.style.display = ''},
				hide:()=>{root.style.display = 'none'},
				setText:(text: string)=>{
					p.textContent = text
				},
				setImage:(src: string)=>{
					img.src = src
				},
			} as const
			elements.heldItemIcon = methods 
		}

		this.elements = elements
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
	let _machine: null|Machine = null;
	let _itemRefund: readonly ItemInstance[] = [];
	let _placeCallback: null|Function = null;
	let _inventory: null|Inventory = null;// inventory to refund to
	function clear(){
		_machine = null;
		_itemRefund = [];
		_placeCallback = null;
		_inventory = null;
	};
	const properties = {
		set(machine: Machine, itemRefund: readonly ItemInstance[], placeCallback: Function, inventory: Inventory){
			if (!(inventory instanceof Inventory)) throw new Error("inventory is not an Inventory");
			if (itemRefund.some(instance=>!(instance instanceof ItemInstance))) throw new Error(`itemRefund has non ItemInstance values, itemRefund:${JSON.stringify(itemRefund)}`);
			_machine = machine;
			_itemRefund = itemRefund;
			_placeCallback = placeCallback;
			_inventory = inventory;
			return properties;
		},

		place(success: boolean):void{
			const results = _placeCallback ? _placeCallback(success) : null
			if (properties.isEmpty()) return results
			if (!success) {
				// Refund
				if (_inventory) {
					_itemRefund.forEach(entry=>(_inventory as Inventory).addItem(entry))
				}
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
	} as const;
	return properties
})();



/* This variable is used to store the context for transferring items and functions to be called upon transfer.
How do i even type this? */
const ItemTransferContext: {
	itemInstance: ItemInstance | null
	transfer: ((success: boolean) => void) | null
} = {
	itemInstance:null,
	transfer:null // function (success)=>{}
}



const itemQuantitySlider = (()=>{// Item amount slider
	const root = document.getElementById('item-amount-slider')!
	
	const slider = document.getElementById('item-amount-slider-slider') as HTMLInputElement
	slider.type = 'range'

	let endCallbackFunction:Function|null = ()=>{}
	let inputCallbackFunction:Function|null = ()=>{}
	let sliderDisabled = true
	// Make it follow the mouse without pressing
	document.addEventListener('mousemove', e => {
		if (root.style.display === 'none') return
		const rect = slider.getBoundingClientRect();

		// Map mouse X position to slider range
		const percent = (e.clientX - rect.left) / rect.width;
		const clamped = Math.min(Math.max(percent, 0), 1);

		slider.value = String(Math.round(
			Number(slider.min) * 1 + (Number(slider.max) - Number(slider.min)) * clamped
		));
		if (inputCallbackFunction) inputCallbackFunction(Number(slider.value))
	});

	document.addEventListener('mouseup', ()=>{
		if (sliderDisabled) return
		sliderDisabled = true
		root.style.display = 'none'
		if (endCallbackFunction) endCallbackFunction(Number(slider.value))
	})

	const setText = (text: string)=>{
		if (typeof text !== 'string') throw new Error("text is not a string");
		document.getElementById('item-amount-slider-text')!.textContent = text
	}

	const methods = {
		show: (x: number, y: number, text: string, length=15) => {
			// position is relative to the window, not the page
			if (typeof length !== 'number' || Number.isNaN(length) || (!Number.isFinite(length))) throw new Error("length is not a valid number");
			slider.max = String(length)
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
		setEndCallback:(func: Function|null)=>{
			endCallbackFunction = func
		},
		setInputCallback:(func: Function|null)=>{
			inputCallbackFunction = func
		},
		setText
	} as const
	return methods
})();



/* Used to decide what is shown in the machines tab */
const machinesUnlocked = new Set(['stone_furnace'])



const pubSubTick = new Set<(deltaMS:number)=>void>()
{
	let now = Date.now()
	setInterval(()=>{
		//Milliseconds
		const deltaMS = Date.now() - now
		now = Date.now()
		pubSubTick.forEach((f:Function)=>{f(deltaMS)})
	},50)
}






document.getElementById('side-menu-width-button')!.addEventListener('mousedown',e=>{
	const minWidth = 300//px
	const originalMouseX = e.clientX
	const originalInventoryWidth = Number(document.getElementById('side-menu')!.getBoundingClientRect().width)
	const up = ()=>{
		window.removeEventListener('mouseup',up)
		window.removeEventListener('mousemove',move)
	}
	const move = (e:MouseEvent)=>{
		e.clientX
		const newWidth = Math.max(originalInventoryWidth + e.clientX - originalMouseX, minWidth)
		document.getElementById('side-menu-container')!.style.width = newWidth + 20 + 'px'
		document.getElementById('side-menu')!.style.width = newWidth + 'px'
	}
	window.addEventListener('mousemove',move);
	window.addEventListener('mouseup',up)
});




document.getElementById('main-window-button')!.addEventListener('click',()=>{
	document.getElementById('main-window')!.style.display = 'none'
})




;(async () => {
async function fetchJSON(url: string) {
	return fetch(url).then(response=>{
		if (!response.ok) {
			throw new Error("Network response was not ok" + response.statusText);
			
		}
		return response.json()
	})
}
function compile(items:unknown, machines:unknown, recipes:unknown, extraction:unknown) {

	if (!Array.isArray(items)) throw new Error("error");
	if (!Array.isArray(machines)) throw new Error("error");
	if (!Array.isArray(recipes)) throw new Error("error");
	if (!Array.isArray(extraction)) throw new Error("error");
	

	const limitKeysTo = (obj:any, keys:string[])=>{
		if (Object.keys(obj).some(key=>!keys.includes(key))) throw new Error(`${obj.id} has invalid keys, object can only have these keys:${keys}`);	
	}

	const includeKeys = (obj:any, keys:string[])=>{
		if (keys.some(key=>!Object.keys(obj).includes(key))) throw new Error(`${obj.id} has invalid keys, object must include these keys:${keys}`);	
	}

	items.forEach(item => {
		includeKeys(item,['id', 'name', 'tags'])
	})

	machines.forEach(item => {
		includeKeys(item,['id', 'name', 'capabilities', 'tier', 'requiresConfiguration'])
	})
	machines.forEach(item => {
		limitKeysTo(item,['id', 'name', 'capabilities', 'tier', 'requiresConfiguration', 'energyNeeds', 'fuelNeeds'])
	})

	recipes.forEach(item => {
		limitKeysTo(item,['id', 'inputs', 'outputs', 'requiredProcess', 'requiredTier', 'processTimeSeconds'])
	})
	
	const checkType = (obj:object, type:string)=>{
		if (type === 'array'){
			if (!Array.isArray(obj)) throw new Error(`${obj} is not of an array`);
		}
		else if (typeof obj !== type) throw new Error(`${obj} is not of type ${type}`);
	}

	for (const item of items) {
		checkType(item.id,'string')
		checkType(item.name,'string')
		checkType(item.tags,'array')
		item.tags.forEach((tag:any)=>checkType(tag,'string'))
	}
	
	for (const machine of machines) {
		checkType(machine.id,'string')
		checkType(machine.name,'string')
		checkType(machine.tier,'number')
		checkType(machine.requiresConfiguration,'boolean')
		checkType(machine.capabilities,'array')
		machine.capabilities.forEach((item:any)=>checkType(item,'string'))
		if (machine.fuelNeeds) {
			checkType(machine.fuelNeeds.tags, 'array')
			machine.fuelNeeds.tags.forEach((v:any)=>checkType(v,'string'))
			checkType(machine.fuelNeeds.energy,'string')
		}
		if (machine.energyNeeds) {
			checkType(machine.energyNeeds.voltageTier, 'number')
			checkType(machine.energyNeeds.energy,'string')
		}
	}

	for (const recipe of recipes) {
		checkType(recipe.id,'string')
		checkType(recipe.requiredProcess,'string')
		checkType(recipe.requiredTier,'number')
		checkType(recipe.processTimeSeconds,'number')
		checkType(recipe.inputs,'array')
		recipe.inputs.forEach((input:any)=>{
			limitKeysTo(input,['id','tag','amount'])
			if (input.id) checkType(input.id,'string')
			if (input.tag) checkType(input.tag,'string')
			checkType(input.amount,'number')
		})
		checkType(recipe.outputs,'array')
		recipe.outputs.forEach((output:any)=>{
			limitKeysTo(output,['id','tag','amount'])
			if (output.id) checkType(output.id,'string')
			if (output.tag) checkType(output.tag,'string')
			checkType(output.amount,'number')
		})
	}
	

	const hasDuplicateIds = (array:any[])=>{
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
	const isSubset = (setA:any, setB:any) => [...setA].every(x => setB.has(x));

	for (const machine of machines) {
		if (machine.requiresConfiguration) continue
		const relevantRecipes = recipes.filter(recipe=>machine.capabilities.includes(recipe.requiredProcess) && recipe.requiredTier <= machine.tier)
		const inputIdsSets = relevantRecipes.map(recipe=>new Set(recipe.inputs.map((input:any)=>input.itemId)))
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

	
	dataIsCompiled = true
	return {items, machines, recipes, extraction}
}
const items = await fetchJSON('src/game-data/items.json')
const machines = await fetchJSON('src/game-data/machines.json')
const recipes = await fetchJSON('src/game-data/recipes.json')
const extraction = await fetchJSON('src/game-data/extraction.json')
return compile(items, machines, recipes, extraction)
})().then(main)

function main(response:{items:Item[], machines:Machine[], recipes:Recipe[], extraction:Extractor[]}) {

	items = response.items
	machines = response.machines
	recipes = response.recipes

	extraction  = response.extraction



	// Data utility functions / Post compiled functions

	/**
	 * When this function is called it will show the slider and set up events for items transfer of a specified item from the provided inventory into the transfer context
	 * from there you can resolve the transfer from anywhere in the script since transfer context is a global variable. 
	 * @param {Event} event event listener event 
	 * @param {Inventory} inventory inventory class to transfer from
	 * @param {Item} item the item "class" to transfer
	 * @param {Function()} initiateTransferCall optional functions to add extra events upon transfer to transfer context
	 * @param {Function(success:Boolean)} resolveTransferCall optional functions to add extra events upon transfer context resolution
	 * @returns void
	 */
	function itemTransferEvent(event:MouseEvent, inventory:Inventory, item:Item, initiateTransferCall:Function=()=>{}, resolveTransferCall:Function|((success:boolean)=>void)=()=>{}): void {
		if (!event || !inventory || !item) return
		if (ItemTransferContext.itemInstance !== null) return

		event.preventDefault()
		event.stopPropagation()

		const currentQty = Math.max(0, inventory.getAmount(ItemInstance.fromItem(item)) || 0)
		if (currentQty < 1) return

		const preset = [
			1,5,10,20,30,40,50,100,200,300,400,500,600,700,800,900,1000,
			2000,3000,4000,5000,6000,7000,8000,9000,10000,20000,30000,40000,
			50000,60000,70000,80000,90000,100000,200000,300000,400000,500000,1000000
		]
		const candidates = preset.filter(v => v < currentQty)
		if (candidates[candidates.length - 1] !== currentQty) candidates.push(currentQty)

		const steps = candidates.length
		if (steps === 0) return

		const formatLabel = (idx: number) => `${candidates[idx]}/${currentQty}`

		itemQuantitySlider.show(event.pageX, event.pageY, formatLabel(0), steps)

		const onInput = (step: number) => {
			const index = Math.max(0, Math.min(steps - 1, step - 1))
			itemQuantitySlider.setText(formatLabel(index))
		}

		const onEnd = (step: number) => {
 		   itemQuantitySlider.setInputCallback(null)
 		   itemQuantitySlider.setEndCallback(null)

			const index = Math.max(0, Math.min(steps - 1, step - 1))
			const amount = candidates[index] ? candidates[index] : preset[preset.length-1] as number

			// try to subtract; if subtraction fails, restore UI and exit
			const removed = inventory.subtractItem(ItemInstance.fromItem(item, amount))
			if (!removed) {
			// optionally show a feedback/error in UI here
			return
			}

			// register the pending instance and transfer handler
			ItemTransferContext.itemInstance = new ItemInstance(item, amount)

			MouseOverlay.elements.heldItemIcon.setText(`${ItemTransferContext.itemInstance.item.name}:${ItemTransferContext.itemInstance.amount}`)
			MouseOverlay.elements.heldItemIcon.show()
			MouseOverlay.show()

			initiateTransferCall()

			// transfer is called to resolve ItemTransferContext
			ItemTransferContext.transfer = (success) => {
				ItemTransferContext.itemInstance = null
				ItemTransferContext.transfer = null
				MouseOverlay.elements.heldItemIcon.hide()
				MouseOverlay.hide()
				if (success) {
					return
				}
				// on failure attempt refund 
				if (!inventory.addItem(ItemInstance.fromItem(item, amount))) {
					//If refund fail default to refunding the players inventory
					if (!mainInventory.addItem(ItemInstance.fromItem(item, amount))) throw new Error("could not add items to mainInventory");
				}

				resolveTransferCall(success)
			}
		}

		itemQuantitySlider.setInputCallback(onInput)
		itemQuantitySlider.setEndCallback(onEnd)
	}



	const inventoryCellElements: {element:HTMLDivElement, amountLabel:HTMLParagraphElement, itemPointer:Item}[] = []
	for(const item of items){
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = item.name
		cell.style.display = 'none'

		const number = document.createElement('p')
		number.textContent = '0'
		cell.appendChild(number)

		cell.addEventListener('mousedown', e => {
			itemTransferEvent(e,mainInventory,item)
		})

		document.getElementById('inventory-grid')!.appendChild(cell)
		inventoryCellElements.push({element:cell, amountLabel:number, itemPointer:item})
	}



	mainInventory.setContentChangeCallback((itemInstance: ItemInstance)=>{
		const item = itemInstance.item
		const amount = itemInstance.amount
		for(const cellElement of inventoryCellElements){
			if (cellElement.itemPointer !== item) continue
			cellElement.amountLabel.textContent = String(amount) // Yes this is correct
			if (GameStates.ui.sideMenuSection.get() === 'recipes') continue
			cellElement.element.style.display = ''
		}
	})



	const machineCellElements: {element:HTMLDivElement, machinePointer:Machine}[] = []
	for(const machine of machines){
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = machine.name
		cell.style.display = 'none'
		document.getElementById('machines-grid')!.appendChild(cell)

		cell.addEventListener('mouseenter', ()=>{
			const recipe = getRecipesProducing(machine, recipes)[0]
			if (!recipe) return

			MouseOverlay.show()
			MouseOverlay.elements.infoPanel.show()

			const text = recipe.inputs.map(input=>{
				let item = items.find(item=>item.id === input.id)
				if (!item) item = items.find(item=>input.tag && item.tags.includes(input.tag))
				if (item) {
					return `${item.name}: ${input.amount}, `
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
			const recipe = getRecipesProducing(machine, recipes)[0]
			if (!recipe) throw new Error(`The machine: ${machine.id} is not craftable`);
			const itemsUsed = resolveCraftingCosts(recipe, mainInventory, items)
			if (!itemsUsed) return
			if (!mainInventory.changeItems(itemsUsed.map(item=>new ItemInstance(item.item, -item.amount)))) return
			MachineBeingPlaced.set(machine, itemsUsed, (success:boolean)=>{cell.style.backgroundColor = ''}, mainInventory)
			cell.style.backgroundColor = 'green'
		})

		machineCellElements.push({element:cell, machinePointer:machine})
		}



	{ // Side Menu Header Buttons functionality
	const showGrid = (showInventory: boolean, showMachines: boolean) => {
		document.getElementById('inventory-grid')!.style.display = showInventory ? '' : 'none';
		document.getElementById('machines-grid')!.style.display = showMachines ? '' : 'none';
	};
	
	const repairCells = () => {
		for (const inventoryCell of inventoryCellElements) {
			const entry = mainInventory.getAllItemInstances().find(e => e.item === inventoryCell.itemPointer);
			inventoryCell.element.style.display = entry && entry.amount > 0 ? '' : 'none';
			inventoryCell.amountLabel.style.display = ''
		}
		for (const machineCell of machineCellElements) {
			machineCell.element.style.display = machinesUnlocked.has(machineCell.machinePointer.id) ? '' : 'none';
		}
	};
	
	document.getElementById('side-menu-recipes-button')!
	.addEventListener('click', () => {
		GameStates.ui.sideMenuSection.set('recipes', 'side-menu-recipes-button clicked')
		showGrid(true, true);
		for (const inventoryCell of inventoryCellElements) {
			inventoryCell.element.style.display = '' 
			inventoryCell.amountLabel.style.display = 'none'
		}
		for (const machineCell of machineCellElements) {
			machineCell.element.style.display = ''
		}
	});
	
	document.getElementById('side-menu-inventory-button')!
	.addEventListener('click', () => {
		GameStates.ui.sideMenuSection.set('inventory', 'side-menu-inventory-button clicked')
		showGrid(true, false);
		repairCells();
	});
	
	document.getElementById('side-menu-machines-button')!
	.addEventListener('click', () => {
		GameStates.ui.sideMenuSection.set('machines', 'side-menu-machines-button clicked')
		showGrid(false, true);
		repairCells();
	});
	}



	document.getElementById('extract-starter')!.addEventListener('click',()=>{
		
		const starterMine = extraction.find(item=>item.id==='starter')
		if (!starterMine) throw new Error("Could not find the starter extractor");
		const totalWeight = starterMine.yields.map(val=>val.weight).reduce((prev,val)=>prev+val,0)
		for (let i = 0; i < starterMine.manualPower; i++) {
			const randomNumber = Math.floor(Math.random()*totalWeight)
			let resultId: string|null = null
			let cumulative = 0
			for (const value of starterMine.yields) {
				cumulative += value.weight
				if (randomNumber < cumulative) {
					resultId = value.itemId
					break
				}
			}
			if (resultId === null) continue
			mainInventory.changeItem(ItemInstance.fromItem(getItemFromId(resultId, items), 1))
		}
	})



	document.getElementById('machine-line-cell-button')!.addEventListener('click',()=>{
		if (MachineBeingPlaced.isEmpty())return
		
		const machineObject = MachineBeingPlaced.getState().machine
		if (!machineObject) return
		const {element:machineCell, setStack, setProgress, setWarning} = createMachine(machineObject)
		setWarning('no_fuel')
		let stack = 1
		let idle = false
		const capableRecipes = recipes.filter(recipe=>machineObject.capabilities.includes(recipe.requiredProcess))

		const inputInventory = new Inventory(()=>{idle = false}, Infinity, capableRecipes.map(recipe=>getRecipeInputs(recipe, items)).flat().flatMap(v=>v.items))
		const outputInventory = mainInventory

		let energy = 0

		machineCell.addEventListener('click',()=>{
			if (!MachineBeingPlaced.isEmpty()) {
				stack++
				setStack(stack)
				MachineBeingPlaced.place(true)
				return
			}
			const incomingItem = ItemTransferContext.itemInstance 
			console.log('incomingItem', incomingItem)
			if (incomingItem === null) return
			let success = false
			if (machineObject.fuelNeeds) success = machineObject.fuelNeeds.tags.some(tag=>incomingItem.item.tags.includes(tag))
			console.log('success', success)
			if (success) {
				energy += energyToNumber(incomingItem.item.energy??'') * incomingItem.amount
				setWarning('')
				idle = false;
			} else {
				success = inputInventory.addItem(incomingItem)
			}
			if (ItemTransferContext.transfer) ItemTransferContext.transfer(success)
			ItemTransferContext.itemInstance  = null
		})
		document.getElementById('machine-line')!.appendChild(machineCell)
		
		MachineBeingPlaced.place(true)

		let work = 0
		let workingOn: Recipe[] = []

		const craft = (amount: number, recipe: Recipe)=>{
			const maxCraftable = maxCraftableCount(getRecipeInputs(recipe, items), inputInventory)
			const multiplier = Math.min(amount, maxCraftable)
			const itemsUsed = resolveCraftingCosts(recipe, inputInventory, items, {multiply:multiplier})
			if (!itemsUsed || !inputInventory.subtractItems(itemsUsed)) {
				throw new Error("Failed to subtract items from input inventory");
			}
			if (!outputInventory.changeItems(getRecipeOutputs(recipe, items).map(itemInst=>{itemInst.amount *= multiplier; return itemInst}))) {
				throw new Error("Failed to add items to output inventory");
			}
			return multiplier
		}

		// Declare setInterval machine logic
		pubSubTick.add(deltaMS=>{
			
			//Idle is set to false when anything is added to the inputInventory
			if (idle) return
			workingOn = capableRecipes.filter(recipe=>Boolean(resolveCraftingCosts(recipe, inputInventory, items)))
			if (workingOn.length === 0) {
				idle = true
				return
			}
		
			const energyPerWork: number = (()=>{
				return machineObject.fuelNeeds ?
				energyToNumber(machineObject.fuelNeeds.energy) :
				machineObject.energyNeeds ?
				energyToNumber(machineObject.energyNeeds.energy) * machineObject.energyNeeds.voltageTier :
				0
			})()

			const maxWorkAdded = Math.min(deltaMS/1000 * stack, energy/energyPerWork)
			let workUsed = 0
			let workDemand = 0 // total demand, used and unfulfilled
			let lowestSeconds = Infinity
			
			for (const recipe of workingOn) {
				const workAvailable = maxWorkAdded + work - workUsed
				const seconds = recipe.processTimeSeconds
				const amountOfCrafts = Math.floor(workAvailable / seconds)
				const amountCrafted = craft(amountOfCrafts, recipe)
				const maxCraftable = maxCraftableCount(getRecipeInputs(recipe, items), inputInventory)
				
				workDemand += maxCraftable * seconds
				workUsed += seconds * amountCrafted
				
				if (seconds < lowestSeconds) {
					lowestSeconds = seconds
					setProgress(workAvailable / seconds * 100)
				}
			}
			
			const workAdded = Math.min(relu(workDemand - work), maxWorkAdded)
			const energyNeeded = workAdded * energyPerWork
			if (energy < workDemand) {
				setWarning('no_fuel')
			} else {
				setWarning('')
			}
			energy -= energyNeeded
			work += workAdded - workUsed
		})
	})

}



