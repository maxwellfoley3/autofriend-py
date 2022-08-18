const inFile = process.argv[2];
const outFile = process.argv[3];

const readline = require('readline');
const fs = require('fs');
const axios = require('axios');
const randomWords = require('random-words');
const config = require('./config.js');

const readInterface = readline.createInterface({
	input: fs.createReadStream(inFile),
	output: process.stdout,
	console: false
});

const writeInterface = fs.createWriteStream(outFile, {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

readInterface.on('line', processLine);

async function processLine(line) {
	let obj = {};
	obj.prompt = line;

	axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'text-davinci-002', 
			prompt: `Write a creative 500 word paragraph about "${randomWords()}"`, 
			temperature: 1, 
			max_tokens: 512,
		}
	}).then((res)=>{
		let text = res.data.choices[0].text;
		text = text.trim();
		console.log("Completed with: " + text);

		obj.completion = " " + text;
		writeInterface.write(JSON.stringify(obj) + '\n');
	}).catch((err)=>{
		console.log(err);
	})

}