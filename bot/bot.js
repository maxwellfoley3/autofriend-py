const randomWords = require('random-words');
const config = require('../config.js');
const { TwitterApi } = require('twitter-api-v2');
const { tweetHasCompleteSentences, tweetHasMeaningfulWords } = require('./quality-filters.js')
const { repeatedlyQuery } = require('./helpers.js')	

module.exports = class Bot {
	name
	gpt3Model
	tweetFrequency
	#client

	constructor(name, gpt3Model, tweetFrequency) {
		this.name = name
		this.gpt3Model = gpt3Model
		this.#client = new TwitterApi({
			appKey: config.twitter.appKey,
			appSecret: config.twitter.appSecret,
			accessToken: config.twitter[name].accessToken,
			accessSecret: config.twitter[name].accessSecret
		})	
		this.tweetFrequency = tweetFrequency
	}

	start() {
		this.tweet()
		setInterval(
			()=>this.tweet.call(this),
			this.tweetFrequency
		)
	}

	async tweet() {
		try {
			let validTweetFound = false;
			let tweetText = '';
			let attempts = 0;
			while(!validTweetFound && attempts < 6) {
				attempts++;
				console.log('about to find tweet', this, this.gpt3Model)
				if(!this.gpt3Model) { throw " No gpt model!" }

				const res = await repeatedlyQuery({
					method: 'post',
					url: 'https://api.openai.com/v1/completions',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer ' + config.openAiApiKey,
					}, 
					data: {
						model: this.gpt3Model, 
						prompt: randomWords()+'###', 
						temperature: .9, 
						max_tokens: 54,
						stop: ['###']
					}
				})
				tweetText = res.data.choices[0].text;
				console.log("Got gpt-3 response", tweetText)
				validTweetFound = (await tweetHasCompleteSentences(tweetText)) 
				&& (await tweetHasMeaningfulWords(tweetText));
			}
			console.log('Tweeting:', tweetText)
			return await this.#client.v2.tweet(tweetText)
		} catch(e) {
			console.log('Tweeting failed:', e)
		}
	}

	async reply(replyToTweetText, replyToTweetId) {
		try {
			let validTweetFound = false;
			let tweetText = '';
			let attempts = 0;
			while(!validTweetFound && attempts < 6) {
				attempts++;
				const res = await repeatedlyQuery({
					method: 'post',
					url: 'https://api.openai.com/v1/completions',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer ' + config.openAiApiKey,
					}, 
					data: {
						model: this.gpt3Model, 
						prompt: `Reply to "${replyToTweetText}"###`, 
						temperature: .9, 
						max_tokens: 54,
						stop: ['###']
					}
				})
				tweetText = res.data.choices[0].text;
				console.log("Got gpt-3 response", tweetText)
				validTweetFound = (await tweetHasCompleteSentences(tweetText)) 
				&& (await tweetHasMeaningfulWords(tweetText));
			}
			console.log('Replying:', tweetText)
			return await this.#client.v2.reply(tweetText, replyToTweetId)
		} catch(e) {
			console.log('Tweeting failed:', e)
		}
	}
}
