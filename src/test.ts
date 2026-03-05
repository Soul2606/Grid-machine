import { ItemEntry, ResolvedRecipe } from "./classes.js"
import { fetchData } from "./functions.js"
import { createProcessingLine, createRecipeCard } from "./ui-components.js"

const data = await fetchData()

const el = createRecipeCard()
// Its a mystery what item 0 and 1 is.
el.setResolvedRecipe(
	new ResolvedRecipe(
		"none", 
		[
			ItemEntry.fromItem(data.items[1]!, 1),
			ItemEntry.fromItem(data.items[2]!, 1),
			ItemEntry.fromItem(data.items[3]!, 1),
			ItemEntry.fromItem(data.items[4]!, 1),
			ItemEntry.fromItem(data.items[5]!, 1),
			ItemEntry.fromItem(data.items[6]!, 1),
			ItemEntry.fromItem(data.items[7]!, 1),
			ItemEntry.fromItem(data.items[8]!, 1),
			ItemEntry.fromItem(data.items[10]!, 1),
			ItemEntry.fromItem(data.items[11]!, 1),
			ItemEntry.fromItem(data.items[12]!, 1),
			ItemEntry.fromItem(data.items[13]!, 1),
			ItemEntry.fromItem(data.items[14]!, 1),
		], 
		[
			ItemEntry.fromItem(data.items[0]!, 2),
		]
	)
)
document.body.append(el.element)



