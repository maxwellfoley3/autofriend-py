const readline = require('readline');
const fs = require('fs');

const readInterface = readline.createInterface({
	input: fs.createReadStream('milady-tweets-small.jsonl'),
	output: process.stdout,
	console: false
});

var writeInterface = fs.createWriteStream('milady-tweets-small-unsplit.jsonl', {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

readInterface.on('line', processLine);

function processLine(line) {
	const obj = JSON.parse(line);
	writeInterface.write(JSON.stringify({ prompt:"", completion: " " + obj.prompt + obj.completion})+"\n")
}

readInterface.on('close', function() {
	const resultArray = Object.values(res);
	//console.log(resultArray);
});
