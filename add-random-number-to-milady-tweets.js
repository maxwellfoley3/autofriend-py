const readline = require('readline');
const fs = require('fs');

const inFilename = process.argv[2]
const outFilename = process.argv[3]

const readInterface = readline.createInterface({
	input: fs.createReadStream(inFilename),
	console: false
});

const writeInterface = fs.createWriteStream(outFilename, {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

readInterface.on('line', (line) => {
	let obj = JSON.parse(line)
	obj.prompt = `${Math.floor(Math.random() * 1000)}`
	writeInterface.write(JSON.stringify(obj) + '\n')
})