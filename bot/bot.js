const randomWords = require('random-words');
const config = require('../config.js');
const { TwitterApi } = require('twitter-api-v2');
const { tweetHasCompleteSentences, tweetHasMeaningfulWords, tweetPassesBadWordCheck } = require('./quality-filters.js')
const { repeatedlyQuery } = require('./helpers.js')

const HOURLY_LIMIT = 20;
const ONE_HOUR = 1000 * 60 * 60;
const TEN_MINUTES = 1000 * 60 * 10;

const twitterClientAppAuth = new TwitterApi(config.twitter.bearer_token)
module.exports = class Bot {
	name
	gpt3Model
	tweetFrequency
	id
	#client
	#hourCount
	followerCount 

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
		this.#hourCount = { hour: Date.now() % ONE_HOUR, count: 0 }
		this.followerCount = 0
	}

	async start() {
		const me = (await this.#client.v2.me())
		this.id = me.data.id

		this.tweet()
		setInterval(
			()=>this.tweet.call(this),
			this.tweetFrequency
		)

		this.checkAndRespondToFollows()
		setInterval(
			()=>this.checkAndRespondToFollows.call(this),
			TEN_MINUTES
		)
	}

	checkAndUpdateHourCount() {
		const now = Date.now();
		if(now % ONE_HOUR > this.#hourCount.hour) {
			this.#hourCount.hour = now & ONE_HOUR;
			this.#hourCount.count = 0;
		}
		this.#hourCount.count++;
		if(this.#hourCount.count > HOURLY_LIMIT) {
			throw "Hourly limit reached!";
		}
	}

	async tweet() {
		try {
			this.checkAndUpdateHourCount()
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
				&& (await tweetHasMeaningfulWords(tweetText))
				&& tweetPassesBadWordCheck(tweetText);
			}
			console.log('Tweeting:', tweetText)
			return await this.#client.v2.tweet(tweetText)
		} catch(e) {
			console.log('Tweeting failed:', e)
		}
	}

	async reply(replyToTweetText, replyToTweetId) {
		this.checkAndUpdateHourCount()
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

	async checkAndRespondToFollows() {
		try { 
			const followersPaginator = await this.#client.v2.followers(this.id, { asPaginator: true })
			let numNewFollowers = followersPaginator.meta.result_count - this.followerCount
			console.log("Checking for new followers: ", this.name)

			// Kind of a hack - it's complicated with our limited v2 access to query a user to see if he already follows the bot
			// So every time the bot boots back up, it will attempt to re-follow everyone who follows it
			// Limit this to ten times
			// Maybe find better way in the future
			if (numNewFollowers > 10) {
				numNewFollowers = 10
			}

			// Only need to get first page of pagination 
			const followersPage = await followersPaginator.next();

			for (let i = 0; i < numNewFollowers && i < followersPage.data.data.length; i++) {
				const follower = followersPage.data.data[i]
				console.log("Following: ", this.name, follower.name)
				await this.#client.v2.follow(this.id, follower.id)
			}
		} catch(e) {
			console.log('Error following accounts back:', e)
		}
	}
}
