
const { TwitterApi } = require('twitter-api-v2');
const randomWords = require('random-words');
const config = require('./config.js');
const fs = require('fs');
const { repeatedlyQuery } = require('./bot/helpers.js');

client = new TwitterApi({
	appKey: config.twitter.appKey,
	appSecret: config.twitter.appSecret,
	accessToken: config.twitter.reality__gamer.accessToken,
	accessSecret: config.twitter.reality__gamer.accessSecret
})	

var writeInterface = fs.createWriteStream('data/hivemind-classifier.jsonl', {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

async function getNegatives() {
	const homeTimeline = await client.v2.homeTimeline({ exclude: 'replies' });
	totalSeen = 0;
	while (!homeTimeline.done && totalSeen < 1000) {
		for (let i = 0; i < homeTimeline.data.data.length && totalSeen < 1000; i++) {
			let text = homeTimeline.data.data[i].text;
			text = text.replace(/RT @\S+ /g, '')
			text = text.replace(/@\S+/g, '')
			text = text.replace(/https\S+/g, '')
			let output = {prompt:`${text}###`, completion:' B'}
			writeInterface.write(JSON.stringify(output) + "\n")
			totalSeen++;
		}
		await homeTimeline.fetchNext();
	}
}

async function getPositives() {
	for (let i = 0; i < 400; i++) {
		const res = await repeatedlyQuery({
			method: 'post',
			url: 'https://api.openai.com/v1/completions',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + config.openAiApiKey,
			}, 
			data: {
				model: 'curie:ft-personal:hivemind-2022-08-19-21-28-10', 
				prompt: randomWords()+'###',
				temperature: .9, 
				max_tokens: 54,
				stop: ['###']
			}
		})
		responseText = res.data.choices[0].text
		let output = {prompt:`${responseText}###`, completion:' A'}
		writeInterface.write(JSON.stringify(output) + "\n")
	}
}
getPositives()