const axios = require('axios');
const randomWords = require('random-words');
const config = require('./config.js');
const { ETwitterStreamEvent, TwitterApi } = require('twitter-api-v2');

const twitterClientUserAuthMilady = new TwitterApi({
	appKey: config.twitter.appKey,
	appSecret: config.twitter.appSecret,
	accessToken: config.twitter.automilady.accessToken,
	accessSecret: config.twitter.automilady.accessSecret
});

const twitterClientUserAuthAngelicism = new TwitterApi({
	appKey: config.twitter.appKey,
	appSecret: config.twitter.appSecret,
	accessToken: config.twitter.angelicism_bk.accessToken,
	accessSecret: config.twitter.angelicism_bk.accessSecret
});

const twitterClientAppAuth = new TwitterApi(
	config.twitter.bearer_token
);

console.log("Running twitter bot")

setInterval(
	tweetMilady,
	1000 * 60 * 60 * 3
)

setInterval(
	tweetAngelicism,
	123456
)

// quality filters

async function tweetHasCompleteSentences(tweet) {
	const res = await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'text-davinci-002', 
			prompt: `Please respond 'A' if this fragment of text begins at the beginning \
			of a sentence and ends at the end of a sentence, and 'B' if it starts in \
			the middle of a sentence or cuts off before it reaches the end of a sentence: \
			${tweet}`, 
			temperature: 0, 
			max_tokens: 54,
		}
	})
	answer = res.data.choices[0].text
	console.log('has complete sentences',answer)
	if (answer.trim() == 'A') {
		return true;
	}
}

async function tweetHasMeaningfulWords(tweet) {
	const res = await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'text-davinci-002', 
			prompt: `Please respond 'A' if this fragment of text contains only meaningful \
			words, and 'B' if it contains nonsense words: \
			${tweet}`, 
			temperature: 0, 
			max_tokens: 54,
		}
	})
	answer = res.data.choices[0].text
	console.log('has nonsense words',answer)
	if (answer.trim() == 'A') {
		return true;
	}
}

/// Milady

async function generateMiladyTweet(prompt) {
	return await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'curie:ft-personal:milady-small-unsplit-stopsequence-2022-08-04-21-47-28', 
			prompt, 
			temperature: .9, 
			max_tokens: 54,
			stop: ['###']
		}
	})
}

async function getMiladyTweetText(prompt) {
	let validTweetFound = false;
	let tweetText = '';
	while(!validTweetFound) {
		const res = await generateMiladyTweet(prompt);
		tweetText = res.data.choices[0].text;
		console.log("Got gpt-3 response", tweetText)
		validTweetFound = (await tweetHasCompleteSentences(tweetText)) 
		&& (await tweetHasMeaningfulWords(tweetText));
	}
	return tweetText;
}

async function tweetMilady() {
	try { 
		console.log("Sending gpt-3 request")
		let tweetText = await getMiladyTweetText(randomWords())
		console.log("Tweeting: " + tweetText);
		return twitterClientUserAuthMilady.v2.tweet(tweetText);
	} catch (err) {
		console.log(err);
	}
}

/// Angelicism

async function generateAngelicismTweet(prompt) {
	return await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'curie:ft-personal:angelicism-2022-08-18-22-45-06', 
			prompt, 
			temperature: .9, 
			max_tokens: 54,
			stop: ['###']
		}
	})
}

async function getAngelicismTweetText(prompt) {
	let validTweetFound = false;
	let tweetText = '';
	while(!validTweetFound) {
		const res = await generateAngelicismTweet(prompt);
		tweetText = res.data.choices[0].text;
		console.log("Got gpt-3 response", tweetText)
		validTweetFound = (await tweetHasCompleteSentences(tweetText)) 
		&& (await tweetHasMeaningfulWords(tweetText));
	}
	return tweetText;
}

async function tweetAngelicism() {
	try { 
		console.log("Sending gpt-3 request")
		let tweetText = await getAngelicismTweetText(randomWords()+'###')
		console.log("Tweeting: " + tweetText);
		return await twitterClientUserAuthAngelicism.v2.tweet(tweetText);
	} catch (err) {
		console.log(err);
	}
}

/// Streaming 

async function startStream(){
	try {
		const rules = await twitterClientAppAuth.v2.streamRules();

		if (rules.data && rules.data.length) {
			await twitterClientAppAuth.v2.updateStreamRules({
				delete: { ids: rules.data.map(rule => rule.id) },
			});
		}

		await twitterClientAppAuth.v2.updateStreamRules({
			add: [
				{ value: `to:automilady`, tag: `to automilady` },
				{ value: `to:angelicism_bk`, tag: `to angelicism_bk` },
			],
		})

		const stream = await twitterClientAppAuth.v2.searchStream({
			'tweet.fields': ['referenced_tweets', 'author_id'],
			expansions: ['referenced_tweets.id'],
		})

		stream.autoReconnect = true;

		stream.on(ETwitterStreamEvent.Data, async tweet => {
			console.log("Got tweet", tweet)	
			let newTweetText = await getMiladyTweetText(
				`Reply to '${tweet.data.text}'`
			)
			console.log('new tweet text', newTweetText)
			if (tweet.matching_rules.find(rule => rule.tag == 'to automilady')) {
				try {
					await twitterClientUserAuthMilady.v2.reply(
						newTweetText, tweet.data.id)
					} catch (err) {
						console.log(err)
					}
			}
			if (tweet.matching_rules.find(rule => rule.tag == 'to angelicism_bk')) {
				try {
					await twitterClientUserAuthAngelicism.v2.reply(
						newTweetText, tweet.data.id)
					} catch (err) {
						console.log(err)
					}
			}
		})
	} catch (e) {
		console.log(e);
	}
}

startStream()
