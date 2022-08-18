const fs = require('fs');

const outFile = process.argv[2];

var writeInterface = fs.createWriteStream(outFile, {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

for (let i = 0; i < 100; i++) {
	writeInterface.write(`{"prompt":"${Math.floor(Math.random() * 1000)}","completion":" ${Math.floor(Math.random() * 1000)}"}\n`)
}