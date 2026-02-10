
import type { Item, Machine, Recipe, Extractor, CraftingOptions } from './types.js'
import { clamp, fetchData, getItemFromId, getRecipeInputs, getRecipeOutputs, getRecipesProducing, maxCraftableCount, resolveCraftingCosts, tryCraft } from './functions.js'
import { Inventory, ItemEntry, ItemInstance, MachineInstance, ResolvedRecipe, Signal } from './classes.js'

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




// Global functions



function updateWorkers() {
	document.getElementById("resources-workers")!.textContent = String(workers)
}



function stepExponential(n: number){
	const preset = [
		1,5,10,20,30,40,50,100,200,300,400,500,600,700,800,900,1000,
		2000,3000,4000,5000,6000,7000,8000,9000,10000,20000,30000,40000,
		50000,60000,70000,80000,90000,100000,200000,300000,400000,500000,1000000
	]
	const candidates = preset.filter(v => v < n)
	if (candidates[candidates.length - 1] !== n) candidates.push(n)
	return {candidates, preset}
}



function createItemCell(resource: Item) {
	
	const cell = document.createElement('div')
	cell.className = 'inventory-grid-cell'
	if (resource.img) cell.style.backgroundImage = `url(${resource.img})`
	
	const number = document.createElement('p')
	number.textContent = '0'
	cell.appendChild(number)
		
	return {element:cell, amountLabel:number, itemPointer:resource}
}



function createMachine(machine: Machine) {
	const cell = document.createElement('div')
	cell.className = 'machine'
	cell.textContent = machine.name
	if (machine.img) cell.style.backgroundImage = `url(${machine.img})`

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
		progressBarFill.style.width = String(clamp(n, 0, 100)) + '%'
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
	const setWarning = (string: "" | "no_fuel")=>{
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



function createMachineUI(recipes: readonly Recipe[], items: readonly Item[]) {
	// What currently owns this ui element. Updated when refresh is called
	let context: null | {
		owner: MachineInstance
		inv: Inventory
		callback: (()=>void)
	} = null
	

	const root = document.createElement("div")

	const header = document.createElement("div")
	root.append(header)
	const pe = document.createElement("p")
	header.append(pe)
	const pw = document.createElement("p")
	header.append(pw)
	const stackUp = document.createElement("button")
	stackUp.textContent = "Stack up"
	stackUp.addEventListener("click", e => {
		e.stopPropagation()
		console.log("Clicked stack up");
		if (context === null) return
		const r = getRecipesProducing(context.owner.machine, recipes)[0]
		if (r === undefined) return
		const resolve = tryCraft(r, context.inv, items)
		console.log("tried a craft: ", resolve)
		if (!resolve) return
		context.owner.setStack(context.owner.getStack() + 1)
		context.callback()
	})
	header.append(stackUp)

	const grid = document.createElement("div")
	root.append(grid)

	let subscribers: (()=>number)[] = []
	pubSubTick.subscribe(()=>{
		subscribers.forEach(f=>f())
	})

	const refresh = (machine: MachineInstance, availableResources: Inventory, mutatedMachine: ()=>void)=>{
		refreshText(machine)
		context = {
			owner:machine,
			inv:availableResources,
			callback: mutatedMachine
		}

		grid.innerHTML = ""
		console.log(machine.capableRecipes)
		subscribers = []
		machine.capableRecipes.forEach(cr => {
			const options:CraftingOptions = {maximize:true}

			const out = getRecipeOutputs(cr, machine.items)
			console.log(cr)
			console.log("out: ", out)
			if (out.type !== "item") return

			const outFirst = out.items[0]
			if (outFirst === undefined) throw new Error("Recipe produces nothing. id: " + cr.id);
			
			const cell = createItemCell(outFirst.item)

			const getCount = ()=>{
				const count =  maxCraftableCount(getRecipeInputs(cr, machine.items), availableResources, options)
				cell.amountLabel.textContent = String(count)
				return count
			}
			getCount()

			cell.element.addEventListener("click", e => {
				const resolve = resolveCraftingCosts(cr, availableResources, items, options)
				if (!resolve) return
				if (!availableResources.subtractItems(resolve.flatMap(res => res.inputs))) throw new Error("Invariant broke");
				machine.addWorkingOn(resolve)
			})
			grid.append(cell.element)
			
			subscribers.push(getCount)
		});
	}

	const refreshText = (machine: MachineInstance) => {
		pe.textContent = `Energy: ${machine.getEnergy()}`
		if (machine.machine.workerNeeds) {
			pw.style.display = ""
			pw.textContent = `Workers: ${machine.getWorkers()}/${machine.machine.workerNeeds.maximum}`
		} else {
			pw.style.display = "none"
		}
	}

	return {element: root, refresh, refreshText}
}




/**
 * When this function is called it will show the slider and set up events for items transfer of a specified item from the provided inventory into the transfer context
 * from there you can resolve the transfer from anywhere in the script since transfer context is a global variable. 
 * @param position slider spawn position
 * @param inventory inventory class to transfer from
 * @param item the item to transfer
 * @returns void
 */
function itemTransferEvent(position:{x:number, y:number}, inventory:Inventory, item:ItemInstance): void {
	console.log("doing item transfer. Context;", transferContext)
	if (transferContext.kind !== "empty") return

	const currentQty = Math.max(0, inventory.getAmount(item) || 0)
	if (currentQty < 1) return

	const {candidates, preset} = stepExponential(currentQty)

	const steps = candidates.length
	if (steps === 0) return

	const formatLabel = (idx: number) => `${candidates[idx]}/${currentQty}`

	quantitySlider.show(position.x, position.y, formatLabel(0), steps)

	const onInput = (step: number) => {
		const index = Math.max(0, Math.min(steps - 1, step - 1))
		quantitySlider.setText(formatLabel(index))
	}

	const onEnd = (step: number) => {
		quantitySlider.setInputCallback(null)
		quantitySlider.setEndCallback(null)

		const index = Math.max(0, Math.min(steps - 1, step - 1))
		const amount = candidates[index] ? candidates[index] : preset[preset.length-1] as number

		// try to subtract; if subtraction fails, restore UI and exit
		const removed = inventory.subtractItem(item, amount)
		if (!removed) {
		// optionally show a feedback/error in UI here
		return
		}

		// register the pending instance and transfer handler
		const value = ItemEntry.fromInst(item, amount)

		MouseOverlay.elements.heldItemIcon.setText(`${value.item.name}:${value.amount}`)
		MouseOverlay.elements.heldItemIcon.show()
		MouseOverlay.show()

		// transfer is called to resolve ItemTransferContext
		const transfer = (success: boolean) => {
			transferContext = {kind: "empty"}
			MouseOverlay.elements.heldItemIcon.hide()
			MouseOverlay.hide()
			if (success) return
			// on failure attempt refund 
			if (!inventory.addItem(item, amount)) {
				//If refund fail default to refunding the players inventory
				if (!mainInventory.addItem(item, amount)) throw new Error("could not add items to mainInventory");
			}
		}

		transferContext = {
			kind: "item",
			value,
			transfer
		}
	}

	quantitySlider.setInputCallback(onInput)
	quantitySlider.setEndCallback(onEnd)
}



//Global Variables

let dataIsCompiled = false

var workers = 3

/* These will be assigned after compilation. Should be validated outside the main function*/

var items: readonly Item[]

var machines: readonly Machine[]

var recipes: readonly Recipe[]

var extraction: readonly Extractor[]



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




type TransferContext = {
	kind: "empty"
}
| {
	kind: "item"
	value: ItemEntry
	transfer: (success:boolean) => void
}
| {
	kind: "machine"
	value: Machine
	transfer: (success:boolean) => void
}

/**
 * Stores context for an in-progress transfer.
 *
 * - kind:
 *   Describes what is being transferred, or "empty" if no transfer is active.
 *
 * - value:
 *   Present only when kind !== "empty".
 *   The thing being transferred.
 *
 * - transfer:
 *   Created by the sender of the transfer.
 *   Called by the recipient with a success status.
 *
 *   IMPORTANT:
 *   Always assume on both sides that transferContext has been mutated after transfer is called.
 *   The transfer function is responsible for refunding the sender
 *   if the transfer fails.
 *
 *   !!! REFUNDS MUST BE HANDLED BY THE SENDER, NOT THE RECIPIENT !!!
 */

let transferContext: TransferContext = {
	kind: "empty"
}

window.addEventListener("keydown", e => {
	console.log("keydown: ", e.key)
	if (e.key !== "Escape") return
	if (transferContext.kind === "empty") return
	transferContext.transfer(false)
	transferContext = {kind: "empty"}
})




const quantitySlider = (()=>{// Item amount slider
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



const pubSubTick = (()=>{
	const signal = new Signal<number>()
	let now = 0
	const loop = ()=>{
		const t = Date.now()
		const deltaMS = t - now
		now = t
		signal.send(deltaMS)
		setTimeout(loop, 100) // Reduced lag
	}
	now = Date.now()
	loop()
	return signal.createInterface(false)
})()






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




document.getElementById('machine-window-button')!.addEventListener('click',()=>{
	document.getElementById('machine-window')!.style.display = 'none'
})




fetchData().then(main)

function main(response:{items:Item[], machines:Machine[], recipes:Recipe[], extraction:Extractor[]}) {
	dataIsCompiled = true

	items = response.items
	machines = response.machines
	recipes = response.recipes

	extraction  = response.extraction

	document.body.classList.remove('loading')

	updateWorkers()

	const invItemCells = items.map(r => {
		const v = createItemCell(r)
		v.element.style.display = "none"
		v.element.addEventListener('mousedown', e => {
			e.preventDefault()
			e.stopPropagation()
			itemTransferEvent({x:e.clientX, y:e.clientY}, mainInventory, ItemInstance.fromItem(v.itemPointer))
		})
		document.getElementById('inventory-grid')!.appendChild(v.element)
		return v
	})



	mainInventory.signal.subscribe((itemInstance)=>{
		const item = itemInstance.item
		const amount = itemInstance.amount
		for(const cellElement of invItemCells){
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
		if (machine.img) cell.style.backgroundImage = `url(${machine.img})`
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
			if (transferContext.kind !== "empty") {
				transferContext.transfer(false)
				return
			}
			console.log("Clicked machine cell");
			const recipe = getRecipesProducing(machine, recipes)[0]
			if (!recipe) throw new Error(`The machine: ${machine.id} is not craftable`);
			const resolved = resolveCraftingCosts(recipe, mainInventory, items)
			console.log("Resolved recipes", resolved);
			if (!resolved) return
			if (!mainInventory.subtractItems(resolved.flatMap(res => res.inputs))) return
			transferContext = {
				kind: "machine",
				value: machine,
				transfer: (success)=>{
					transferContext = {kind: "empty"}
					cell.style.backgroundColor = ''
					if (success) return
					mainInventory.addItems(resolved.flatMap(res => res.inputs))
				}
			}
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
		for (const inventoryCell of invItemCells) {
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
		for (const inventoryCell of invItemCells) {
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
			mainInventory.changeItem(ItemInstance.fromItem(getItemFromId(resultId, items)), 1)
		}
	})



	const machineUI = {...createMachineUI(recipes, items), owner: null as null | MachineInstance}
	document.getElementById("machine-window")!.append(machineUI.element)



	document.getElementById('machine-line-cell-button')!.addEventListener('click',()=>{
		if (transferContext.kind !== "machine")return
		
		const machineObject = transferContext.value
		if (!machineObject) return
		const {element:machineCell, setStack, setProgress, setWarning} = createMachine(machineObject)
		setWarning('no_fuel')

		const machineInst = new MachineInstance(machineObject, items, recipes)

		machineCell.addEventListener('click',()=>{
			if (transferContext.kind === "empty") {
				machineUI.owner = machineInst
				machineUI.refresh(machineInst, mainInventory, ()=>setStack(String(machineInst.getStack())))
				document.getElementById("machine-window")!.style.display = ""
			} else if (transferContext.kind === "machine") {
				if (transferContext.value.id === machineInst.machine.id) {
					machineInst.setStack(1 + machineInst.getStack())
					setStack(String(machineInst.getStack()))
					transferContext.transfer(true)
				} else {
					transferContext.transfer(false)
				}
			} else {
				const incoming = transferContext.value 
				console.log('incomingItem', incoming)
				if (incoming === null) return
				let success = false
				if (machineInst.addFuel(incoming) === "success") {
					success = true
					setWarning('')
				}
				if (!success) {
					console.log("incoming item:", incoming)
					const ri = machineInst.capableRecipes.map(r=>{ // Find a recipes that has 1 input and that input has at least 1 matching item
						return {
							recipe:r,
							inputs:getRecipeInputs(r, items)
						}
					}).filter(obj=>
						obj.inputs.length === 1
					).map(obj=>{
						const slot = obj.inputs[0]!
						const input = slot.items.find(i=>i.isEqual(incoming) && slot.amount <= incoming.amount)
						if (input === undefined) return null
						return{
							recipe: obj.recipe,
							input: ItemEntry.fromInst(input, slot.amount)
						} as const
					}).find(ri => ri !== null)
					console.log("found ri: ", ri)
					if (ri) {
						const cost1 = ri.input.amount
						const batches = Math.floor(incoming.amount / cost1)
						console.log("baches: ", batches)
						if (batches > 0) {						
							success = true // success so the main inventory does not get it back
							machineInst.addWorkingOn(
								Array(batches).fill(new ResolvedRecipe(
									ri.recipe.id,
									[ri.input],
									getRecipeOutputs(ri.recipe, items)
								))
							)
							mainInventory.addItem(incoming, incoming.amount - cost1 * batches) // Give back leftovers
						}
					}
				}
				console.log("success: ", success)
				transferContext.transfer(success)
			}
			transferContext = {kind: "empty"}
		})



		document.getElementById('machine-line')!.appendChild(machineCell)
		transferContext.transfer(true)
		transferContext = {kind: "empty"}
		
		
		// Declare setTimeout machine logic
		const unsubscribe = pubSubTick.subscribe(deltaMS => {
			const status = machineInst.tick(deltaMS)
			if (machineUI.owner === machineInst) {
				machineUI.refreshText(machineInst)
			}
			if (status === "idle") return
			if (status.lowEnergy) {
				setWarning("no_fuel")
			} else {
				setWarning("")
			}
			if (status.progress) {
				setProgress(status.progress * 100)
			} else {
				setProgress(100)
			}
			mainInventory.addItems(status.crafted)
		})
	})

}



setTimeout(()=>{
	if (dataIsCompiled) return
	document.getElementById('loading-screen')!.innerHTML = `
	<p>ERROR: could not get game data.</p>
	<p>You can download them manually from <a href="YOUR_LINK_HERE" target="_blank">this page</a> and import the JSON files into the document.</p>`
}, 10000)

