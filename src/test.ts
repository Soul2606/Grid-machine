import { getData } from "./game-data.js"
import { stepExponential } from "./functions.js"

const data = getData()

console.log(stepExponential(1)) // expect [1]
console.log(stepExponential(2)) // expect [1,2]
console.log(stepExponential(3)) // expect [1,2,3]
console.log(stepExponential(4)) // expect [1,2,3,4]
console.log(stepExponential(5)) // expect [1,2,3,4,5]
console.log(stepExponential(6)) // expect [1,2,3,4,5,6]
console.log(stepExponential(7)) // expect [1,2,3,4,5,6,7]
console.log(stepExponential(8)) // expect [1,2,3,4,5,6,7,8]
console.log(stepExponential(9)) // expect [1,2,3,4,5,6,7,8,9]
console.log(stepExponential(10)) //       [1,2,3,4,5,6,7,8,9,10]
console.log(stepExponential(100)) //      [1,5,10,15,20,25,30,40,50,60,70,80,90,100]
console.log(stepExponential(1000))
console.log(stepExponential(10000))
console.log(stepExponential(100000))


